# PromptHub
## P7S1 - Editor Data Integrity

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 - Editor Data Integrity | 20/10/2026 11:52 GMT+10 | 20/10/2026 13:31 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
- [Decisions](#decisions)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Task List](#task-list)
- [Validation Loop](#validation-loop)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Goal

Make every path by which the editor reads or writes a document trustworthy. After this PRP a document opens with the
content the server holds, an edit reaches the server once and only when it differs from what the server already has, the
version history lists the states the user saved, restoring a version replaces what the editor shows, a browser draft can
restore only edits made against the content the server still holds, and a request that completes after the user has moved
to another document changes nothing in that document. The server paths are covered by tests that run against a real
Postgres, and the client paths by hook tests whose server and storage seams are injected.

## Why

Epic #31 states the outcome: saving, autosaving, restoring and browsing history never loses, resurrects or misreports a
user's content. Its five code-review findings (#32 to #36) were checked against the code during this research and every
cited line is accurate. Research found one more defect of the same class that no issue describes: on a fresh mount of
`EditorPane`, `useDocumentLoader` ends with an empty editor, or wipes a document it has just loaded, depending on
whether the browser user-id lookup or the document fetch finishes first. A probe that drives the real hook with
controllable promises reproduces it in both orders and under React Strict Mode, and a control that switches documents on
a mounted instance loads correctly (`wip/P7S1-loader-race-diagnostic.test.tsx`). A second probe shows the current
`useAutoSave` scheduling one write on mount with no edit, which is #35 at hook level
(`wip/P7S1-autosave-timers-probe.test.tsx`). By reading `useAutoSave` and `autoSavePrompt`, typing a title into the empty
editor would make autosave write the empty content over the real document; that is not demonstrated end to end, and the
persistence tests of T7 assert it no longer happens. Both defects are reproduced at hook level only, and the browser
behaviour is unverified and belongs in dev-review #38. A note from November 2025 (`wip/MONACO-FIRST-TAB-EMPTY-BUG.md`)
records an empty editor on the first tab opened from zero tabs and attributes it to Monaco; it says the title input is
correct, so it has not been shown to be the same defect.

The independent reviews of this plan found four more defects of the same class by reading the code, none reproduced end to
end. A save or autosave that completes after the user switched documents is applied to the open one: `handleSave` calls
`setPromptData` with the saved document's data (`EditorPane.tsx:190`) and `handleAutoSave` sets `lastSaved`
(`EditorPane.tsx:103`). A rejected server action leaves "Saving..." or the Save button stuck, because neither handler has a
`finally` (`EditorPane.tsx:98-109`, `173-204`). The editor mounts on `loading` alone (`EditorPane.tsx:244`), and
`Editor.tsx:137-142` applies the `value` of the render that mounted it, so in the render where `promptId` has just changed
it can mount with the previous document's text. And the freshly loaded footer reads "Unsaved" (`lastSaved` is never set on
load), while the obvious fix would read "Saved" for a restored draft that is still unsaved.

The fixes interlock, which is why this is one PRP. A draft is only safe to restore if the editor knows what the server
holds (the autosave baseline of #35). Restore (#32) is only safe if version history records the right states (#33). The
loader fix and the draft fix rewrite the same load path, and the tests for all of them need the same Postgres and
hook-test harness (#37). The editor persistence paths have no automated coverage today: the suite is 29 tests in five
files, all of them schemas and pure helpers. The bug history in `PRPs/P5S5-*` shows what happens when these paths change
without tests: content bled between documents through a hook that kept its own state. One more fact shapes the plan: an
untitled document is never autosaved (`useAutoSave` skips a blank title), so its typed text exists only in the browser
draft and the in-memory cache until the first manual save. Anything that deletes drafts destroys user content.

Out of scope, with the issue that owns it: server-side tenancy and input hardening (P7S2, #39), except that moving
`restorePromptVersion` into a user-scoped service removes its unscoped `update` listed in #41; version-history payload
size and retention (#53, which builds on the model chosen here); rate limiting of autosave and restore (#48); clearing
drafts on sign-out (#44; all three draft keys start with `prompt-`); conflicts between two browser tabs or devices, which
stay last-writer-wins; whether untitled documents should autosave; a rename from the document list not reaching the open
editor, whose next autosave then writes the old title back; a failed autosave that is only logged; and `Prompt.folder_id`
being nullable while the cached document type assumes a folder. The last four become follow-up issues, listed in the REPORT.

## What

| Defect | Today | After | Issue |
|---|---|---|---|
| Empty or wiped editor on a fresh mount | The load effect starts with an empty user id, is aborted when the id resolves, and `loadedRef` stops the reload | Loading waits for the user id (a failed or slow lookup settles as anonymous) and shows "Loading prompt..." meanwhile; the editor mounts only for a ready document; an aborted load owns nothing | new, filed with the INITIAL report |
| Restore does not reload the editor | `handleVersionRestored` resets a ref that no effect watches; the next keystroke autosaves the old content over the restore | `restorePromptVersion` returns the restored row and the editor applies it, replacing the cache entry and clearing the draft; unsaved edits of a titled document are saved first | #32 |
| History records the wrong state | The snapshot is the row as read at save time, which autosave has already overwritten | A version is the saved state; an unchanged save adds nothing; restore snapshots the row it replaces | #33 |
| Stale draft wins | Any non-empty draft that differs from the server wins; empty content is never stored; nothing clears it after an autosave | A draft exists only while the working content differs from the last confirmed server content, carries a hash of the content it was based on, and is applied only when the server content still matches; a draft that loses is kept and offered, not deleted | #34 |
| Autosave writes without an edit | Every input change to the hook schedules a write | A write is scheduled only when title or content differ from the last loaded, saved, restored or autosaved values of that document | #35 |
| Set-title dialog reopens | `setTimeout(() => handleSave())` runs a closure that still holds the blank title | The confirmed title is passed to the save and becomes the working title | #36 |
| A completion changes the wrong document, or a flag sticks | Results are applied to whichever document is open; a rejected action leaves its busy flag set | Each completion is applied by the id it started with and reports whether the document is still open; flags reset in `finally` | found in review |
| No tests for any of this | 29 pure tests | Postgres-backed tests in CI and hook tests; each defect has a test that failed before its fix | #37 |

### Success Criteria
- [ ] On a fresh mount the document shows the server's title and content whichever of the user-id lookup and the
  fetch finishes first, under React Strict Mode too, and the editor shows "Loading prompt..." until then, from the first render
- [ ] The editor never mounts with another document's text, and a failed load shows its error
- [ ] Opening a document, switching to its tab, or reloading performs no write
- [ ] An edit is autosaved once, 500 ms after the last change, and afterwards no draft remains unless newer edits exist
- [ ] Clearing a document, waiting for autosave and reloading yields an empty document and no restore toast
- [ ] A draft whose base hash differs from the server content is not applied: a warning toast says why and offers "Restore
  my text", which puts the kept text back; a draft left by the removed hook is applied only to a document that was never
  saved and migrated to the new format; an untitled document's typed text survives a reload and a rename from the list
- [ ] Save A, autosave B, save C lists C then A, both restorable; saving unchanged content adds no row
- [ ] Restore shows the restored title and content at once, replaces the cache entry, clears the draft, pauses autosave
  while it runs, and a following edit autosaves on top of the restored content; unsaved edits of a titled document are saved
  first, so the saved row it replaces is in history
- [ ] A save, autosave or restore that completes after a switch to another document or an unmount leaves the open document
  unchanged and updates only its own cache entry; a rejected action resets its busy flag
- [ ] The footer reads "Unsaved changes" while the working copy differs from the server and "Saved <time>" otherwise
- [ ] Saving an untitled document needs one confirmation of the title, which then is the document's title
- [ ] `npm test` runs the Postgres-backed tests in CI against a service container and reports them as skipped when
  `TEST_DATABASE_URL` is unset outside CI
- [ ] Every CI gate passes, no file enters the RED band, no lint warning is added and the loader file ends with none, and
  each file in the contract's coverage scope reaches 80% line, function, branch and statement coverage

## Decisions

Four need the developer's confirmation before merge and are marked. They are made here so the executing agents do not
guess; the INITIAL report carries them forward.

D1, version model (confirm: issue #33 delegates this choice to the PRP). A version is the saved state. `saveVersion`
updates the prompt row and records the new title and content as the snapshot in one transaction, skipping the snapshot
when it equals the newest version. `restoreVersion` locks the row, records the row as it stands first when the newest
version differs from it (so a restore never destroys autosaved work), writes the restored state, and records it as a new
version unless it equals the newest one, which matches the stories document ("save it as a new version, preserving the
full history", `docs/project/PromptHub_02_STORIES_01.md:85`). History orders by `id desc`: ids are assigned in write order
under the row lock, while `created_at` is stamped by each app instance's own clock. No schema change; existing rows stay
restorable snapshots. A restore snapshots the saved row, not text only the browser holds, which is why D4 saves unsaved
edits first. Rejected: separate draft columns on `Prompt`, which need a migration and leave every reader of `Prompt.content`
showing a different text from the editor; and keeping snapshot-of-previous, which is the defect. Plan Step 3b already
amended the original spec to "auto-save updates current content, manual save creates versions"
(`docs/project/PromptHub_06_PLAN_01.md:214`), which this model implements.

D2, drafts and the baseline (confirm: the conflict policy, the legacy rule and the new key). The client tracks `synced`, the
title and content last known to be on the server. The draft is content only, `{"v":1,"base":"<hash>","content":"..."}`
under the new key `prompt-v1-<id>`, so a tab or a rollback still running the old code never reads JSON as document text.
`useDraftSync` writes it while the working content differs from `synced.content`, removes it when they are equal, and owns
only the values it wrote; the loader removes the values it read and did not apply. At load a draft is applied when its base
matches the hash of the server content. A draft that does not match is a conflict and its text is never deleted: the server
copy wins, the text is stashed under `prompt-v1-<id>:conflict`, and a 20-second warning toast offers "Restore my text". The
raw value of the removed hook under `prompt-<id>` is read once: applied when the document was never saved (its title is
blank), because it is then the only copy, and treated as a conflict otherwise, because the old hook never cleared a draft and
a saved document's is usually older than the server. The base is a content hash, not `updated_at`, because `renamePrompt`
bumps `updated_at` without changing content and that would discard an untitled document's draft after a rename. Accepted:
typing after an autosave whose response was lost raises a false conflict on reload (the text is offered, not lost); two tabs
still race on one key; a stash holds one conflict per document. Rejected: carrying the hash of every unconfirmed save in the
envelope, which needs a channel from three save paths into the writer to prevent a rare event the action already recovers from.

D3, autosave. `needsAutoSave(promptId, working, synced)` is false without a baseline for that document, without a non-blank
title, or when nothing differs. `useAutoSave` takes the baseline, depends on it, and reads `onSave` through a ref so a new
callback never re-arms the timer. `useServerAutoSave` passes it no `promptId` while a save or a restore is in flight, which
cancels a pending write. Server actions in one tab run one at a time in call order (verified in the pinned Next, see the
contract), so no ordering guard is needed. A request slower than the debounce can be followed by one identical write; it is
idempotent and creates no version.

D4, restore (confirm: the UI document says "prompt the user to save it as a new version",
`docs/project/PromptHub_04_UI_01.md:142`, the stories say save it; this PRP follows the stories and the current button,
which already restores in one click). `useVersionRestore` owns the call, so it can pause autosave and be tested without the
dialog; `VersionHistoryDialog` takes `onRestore(versionId)` and ignores requests to close while a restore runs.
`restorePromptVersion` returns `{ title, content }`, and `applyServerState(promptId, row)` replaces title, content,
`promptData`, `synced` and `lastSaved` of the open document, or only the cache entry of a document the editor has left.
Before the request, `handleRestore` saves unsaved edits of a titled document through `autoSavePrompt` and aborts if that
fails, so the restore snapshots them.

D5, test seams (confirm: adds three devDependencies and departs from the wording of #37 and #45). The rule in
`docs/rules/testing.md#rules` forbids mocking a module of this repository, so the issues' "auth stubbed at the
`createClient` boundary" is not followed. Server logic moves to `src/features/editor/service.ts`, which takes
`(db, userId, input)`; the actions stay thin shells with the same validation, authentication and rate limits they have
today. The tests call the service against a real Postgres and never import an action, `@/lib/db` or Supabase code;
how every action is tested is #45's decision (one option is a fake Auth HTTP server behind `SUPABASE_URL`). The service has
no `"use server"` directive because every export of such a file is a public endpoint and these functions take a
`userId` (issue #40 is the same mistake in `ensure-profile.ts`). Hook tests need a DOM: `jsdom@^26.1.0`,
`@testing-library/react@^16.3.0` and `@testing-library/dom@^10.4.0` as devDependencies, which #37 anticipates ("needs
`*.test.tsx` in the Vitest `include`"); jsdom 26 supports Node 18 and later, while jsdom 30 requires Node 22.22.2. Hooks
take their IO as parameters, and `EditorPane` supplies the real functions. The database helper refuses a
`TEST_DATABASE_URL` that is not on a loopback host or whose database name lacks "test", and throws when it is unset in
GitHub Actions so a misconfigured workflow cannot skip the suites silently.

D6, the loader protocol (proved by a spike). The load effect waits for the user id and shows loading meanwhile (a lookup that
fails or takes more than 10 seconds settles as `anonymous`, and the production lookup is remembered for the page load), lets
an aborted run touch nothing, and reads `io` through a ref. The document and `synced` arrive in one reducer action, so
`ready` (`synced.promptId === promptId`) is true only in renders whose content belongs to that document. It replaces
`isTransitioning`, `contentPromptIdRef` and `titlePromptIdRef`, whose release depended on an effect that a fresh-mount cache
hit never re-ran, and there is no loaded mark. The editor mounts only when `ready`. The loader is a reducer with a
module-level `runLoad`, which keeps every function under 80 lines; the cache moves to `document-cache.ts`.

D7, async completions. Every request completes after the user may have moved on. A handler captures its `promptId` and
`tabId` when it starts, applies its result through `markSynced` or `applyServerState`, which take that id and return whether
the document is still open, resets its busy flag in a `finally`, and treats a rejected action as a failed one.

## All Needed Context

References with the reason each matters, the current and desired trees, the verified gotchas, the database environment and
the red-to-green map are in [the task briefs](docs/P7S1-task-briefs.md) (sections References, Current and Desired Trees, Known
Gotchas, Environment for Database Tests, Red to Green Map); the client briefs T4 to T8 are in
[the client briefs](docs/P7S1-task-briefs-client.md). Read the section for your task, and read the source it cites.

## Implementation Blueprint

The module map with line budgets, every TypeScript interface, the loader, draft and completion protocols, the editor view,
the write-ordering rules and the coverage scope are in [the contract](docs/P7S1-editor-persistence-contracts.md); the server
shells and transactions are its server half, in [the Server Contract](docs/P7S1-task-briefs.md#server-contract). The client
half is specified by three working reference implementations in `wip/` with 153 passing tests (`P7S1-draft-spike`,
`P7S1-loader-spike`, `P7S1-persistence-spike`); the executing agents adapt them. This document and those are one
specification; where they appear to disagree, the contract wins on interfaces and this document wins on decisions.

```mermaid
flowchart LR
  W["Working copy (title, content)"] -- "content differs from synced" --> D["Draft prompt-v1-id, base = hash of synced content"]
  W -- "500 ms debounce, only if title or content differ" --> S[("Server row")]
  S -- "confirmed write: markSynced(id)" --> B["synced baseline"]
  B -- "equals working content" --> X["draft removed"]
  S -- "load: fetch or cache" --> B
  D -- "load: base matches server hash" --> W
  D -- "load: base differs" --> C["server wins; text kept under :conflict and offered"]
  S -- "restore returns the row: applyServerState(id)" --> W
```

The diagram is not rendered (the project has no render step).

Integration points: no schema change and no migration; `TEST_DATABASE_URL` (optional locally, required in CI); three
devDependencies; a Postgres service and a migrate step in `.github/workflows/ci.yml` (T1).

Error handling: actions keep returning `ActionResult` and the `NEXT_REDIRECT` rethrow. Services return `ActionResult` for
expected outcomes and let unexpected database errors throw, so the transaction rolls back and the action reports
"Failed to ...". The draft store never throws into React. A rejected action on the client is handled like a failed one. The
loader reports a failed or rejected fetch through `error` and a toast and leaves `synced` null, which keeps autosave off; the
client never writes when it does not know what the server holds.

## Task List

Nine tasks, each 2 to 4 hours, each ending with every gate green and no feature disabled, so every commit is a working
state. One agent per task writes its tests first and watches them fail for the stated reason (the red-to-green map). The
briefs are in [the task briefs](docs/P7S1-task-briefs.md#briefs) and [the client briefs](docs/P7S1-task-briefs-client.md#briefs).

| Task | Title | Agent | Hours | After | [P] |
|---|---|---|---|---|---|
| P7S1T1 | Add the Postgres and DOM test harness and CI service | `qa-test-automation-engineer` | 3 | none | with T4 |
| P7S1T2 | Move save and autosave into a tested service with commit-style versions | `senior-backend-engineer` | 3 | T1 | with T4 |
| P7S1T3 | Move restore and history into the service | `senior-backend-engineer` | 3 | T2 | with T4 |
| P7S1T4 | Add the sync helpers, the draft store and the cache module | `senior-frontend-engineer` | 3 | none | with T1 to T3 |
| P7S1T5 | Rewrite the document loader protocol | `senior-frontend-engineer` | 4 | T1, T4 | |
| P7S1T6 | Replace the draft hook and add the autosave baseline | `senior-frontend-engineer` | 4 | T5 | |
| P7S1T7 | Extract the persistence hooks and fix the set-title save | `senior-frontend-engineer` | 4 | T2, T5, T6 | |
| P7S1T8 | Restore into the editor and remove the superseded code | `senior-frontend-engineer` | 3 | T3, T7 | |
| P7S1T9 | Sweep the documentation and the wip files | `documentation-manager` | 2 | T8 | |

T4 touches only new files and runs in a worktree, or after T3, because agents sharing a checkout would see one another's
intentionally failing tests. The `documentation-manager` also runs after T1, T3 and T6, dispatched by the main session with
the changed-file list and the drift rows to fix (DR-7, DR-8, DR-9, DR-11 and the rules half of DR-15 after T1; DR-4, DR-6,
DR-12 and DR-18 after T3; DR-5 and DR-16 after T6), so each document is corrected in the same commit as the behaviour that
made it false. The main session provisions the test database before it dispatches T1, T2 or T3, alone creates the issues,
amends dev-review #38 (a cold open, an open after visiting Settings and the conflict toast are the new flows), comments on
#37, #41, #44, #45 and #53, and files the follow-ups.

## Validation Loop

Run from the repository root, never after a `cd`. The Prisma and build steps need the placeholder values CI sets.

### Level 1: syntax and style

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db npx prisma validate
npm run lint
npx tsc --noEmit
bash scripts/audit-code-size.sh --summary
# Expected: no errors. Lint baseline on 20/10/2026 is 18 max-lines-per-function warnings; none is added and the three in useDocumentLoader.ts go.
```

### Level 2: unit and Postgres-backed tests

```bash
npm test
# Without TEST_DATABASE_URL the DB-backed suites are reported as skipped. Baseline before this PRP: 5 files, 29 tests.

# With a database (recipes for Docker, a cloud session and CI: docs/P7S1-task-briefs.md#environment-for-database-tests):
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/prompthub_test npm test

# Per-file coverage (read coverage/coverage-summary.json, not the text table), for each file in the contract's scope:
npx vitest run --coverage --coverage.include=src/features/editor/service.ts --coverage.reporter=json-summary

# The reference implementations, until T9 deletes them (153 tests pass today):
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-draft-spike.test.tsx wip/P7S1-loader-spike.test.tsx wip/P7S1-persistence-spike.test.tsx
```

### Level 3: build and browser

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
```

There is no end-to-end runner and cloud sessions have no browser tooling, so the browser checks are reported as not run
and belong to dev-review #38: untitled save through the dialog; edit and autosave; version save; restore an older version
and edit; Escape during a pending restore does not close the dialog; clear and reload; open documents without editing and
confirm "Recently updated" is unchanged; a cold open and an open after visiting Settings; a draft conflict and its "Restore
my text" action; the same edit in two tabs. They run on `npm run dev` port 3010 or the Docker stack.

## Final Validation Checklist
- [ ] `npm test` passes; the DB-backed suites pass with `TEST_DATABASE_URL` set and show as skipped without it
- [ ] Each defect has a test that failed before its fix, recorded in the REPORT with the failing output
- [ ] `npx tsc --noEmit`, `npm run lint`, `npx prisma validate`, the size audit and `npm run build` pass
- [ ] No file entered the RED band; `EditorPane.tsx` is shorter than 329 lines; the register row for
  `src/features/prompts/actions.ts` has its new line count
- [ ] Per-file coverage at least 80% on every file in the contract's scope, with each exemption and its reason recorded
- [ ] `service.ts` has no `"use server"` directive and no client module imports it
- [ ] A search finds no `useLocalStorage`, `resetLoadedRef`, `hydrateDocumentCache`, `isTransitioning`,
  `contentPromptIdRef` or `titlePromptIdRef`, and `Header.tsx` imports `clearDocumentCache` from `document-cache`
- [ ] Every drift-register row is fixed or filed; every changed file has a header changelog line; README has a Testing
  section; the wip reference implementations and probes are deleted
- [ ] Browser checks are listed as not run and handed to #38

## Anti-Patterns to Avoid
- Do not mock a module of this repository (`vi.mock("@/...")`), import `@/lib/db`, an action or Supabase code in a test, or
  edit an existing test to make a change pass
- Do not export a function that takes `userId` from a `"use server"` file
- Do not use `updated_at` or any server timestamp as a draft base; the base is a hash of the content
- Do not delete a draft this tab did not write except the value the loader read and did not apply; a draft that loses to the
  server is stashed and offered, never discarded; and do not apply a legacy draft to a saved document
- Do not add a second draft writer, and do not reintroduce a hook that holds localStorage state
- Do not reintroduce `isTransitioning`, the ownership ref flags or a loaded mark; consume `ready`
- Do not mount the editor for a document that is not `ready`
- Do not apply a response for document A to the state of document B; pass the id and use the boolean that `markSynced` and
  `applyServerState` return, and do not read the open document at completion time to decide where a result belongs
- Do not leave a busy flag to the success path; reset it in a `finally`
- Do not let a client write when it has no baseline
- Do not add an optional parameter that keeps the old behaviour; change the signature and every caller
- Do not widen into P7S2, #44, #48 or #53; file what you find
- Do not raise a timeout to make a test pass, and do not skip a test to get green
- Do not run `cd` in Bash, write files from Bash, or name env files in Bash or Grep calls

----
**PRP Status**: TODO
**PRP ID**: P7S1
**PRP Document**: P7S1-editor-data-integrity
**Tasks**: 9 tasks (P7S1T1 - P7S1T9)
**Phase**: Phase 7 - Hardening (Editor data integrity)
**Dependencies**: None
**Next PRP**: P7S2 - Server-side security hardening
**Recommendations**:
Agents:
- `qa-test-automation-engineer` (Task 1)
- `senior-backend-engineer` (Tasks 2-3)
- `senior-frontend-engineer` (Tasks 4-8)
- `documentation-manager` (Task 9, plus the syncs after Tasks 1, 3 and 6)
Notes:
- Decisions D1, D2, D4 and D5 need the developer's confirmation before merge
- The reference implementations in wip/ (153 tests, about 50 mutations each killed by a test) specify Tasks 4 to 8; Task 9 deletes them
- Tasks 5 and 7 are the riskiest; if either exhausts an agent's turn budget, split it at its Step 2 and Step 3 boundary
- Browser verification is #38 and cannot be run by an agent
- Accepted: two tabs or devices stay last-writer-wins; a false draft conflict after a lost autosave response is offered, not lost
**Estimated Implementation Time (FTE)**: 26-32 hours (4 days)
