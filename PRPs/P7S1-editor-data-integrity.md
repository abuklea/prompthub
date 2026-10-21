# PromptHub
## P7S1 - Editor Data Integrity

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 - Editor Data Integrity | 20/10/2026 11:52 GMT+10 | 22/10/2026 07:53 GMT+10 |

## Table of Contents
- [Goal](#goal)
- [Why](#why)
- [What](#what)
  - [Success Criteria](#success-criteria)
- [Decisions](#decisions)
- [All Needed Context](#all-needed-context)
- [Implementation Blueprint](#implementation-blueprint)
- [Task List](#task-list)
- [Validation Loop](#validation-loop)
  - [Level 1: syntax and style](#level-1-syntax-and-style)
  - [Level 2: unit and Postgres-backed tests](#level-2-unit-and-postgres-backed-tests)
  - [Level 3: build and browser](#level-3-build-and-browser)
- [Final Validation Checklist](#final-validation-checklist)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

## Goal

Make every path by which the editor reads or writes a document trustworthy. After this PRP a document opens with the
content the server holds, an edit reaches the server once and only when it differs from what the server already has, the
version history lists the states the user saved, restoring a version replaces what the editor shows, a browser draft can
restore only edits made against the content the server still holds, and a request that completes after the user has
moved to another document changes nothing in that document. The server paths are covered by tests that run against a
real Postgres, and the client paths by hook tests whose server and storage seams are injected.

## Why

Epic #31 states the outcome: saving, autosaving, restoring and browsing history never loses, resurrects or misreports a
user's content. Its five code-review findings (#32 to #36) were checked against the code during this research and every
cited line is accurate. Research found one more defect of the same class that no issue describes: on a fresh mount of
`EditorPane`, `useDocumentLoader` ends with an empty editor, or wipes a document it has just loaded, depending on
whether the browser user-id lookup or the document fetch finishes first. A probe that drives the real hook with
controllable promises reproduces it in both orders and under React Strict Mode, and a control that switches documents on
a mounted instance loads correctly (`wip/P7S1-loader-race-diagnostic.test.tsx`). A second probe shows the current
`useAutoSave` scheduling one write on mount with no edit, which is #35 at hook level
(`wip/P7S1-autosave-timers-probe.test.tsx`). By reading `useAutoSave` and `autoSavePrompt`, typing a title into the
empty editor would make autosave write the empty content over the real document; that is not demonstrated end to end,
and the persistence tests of T7 assert it no longer happens. The browser behaviour is unverified and belongs in
dev-review #38. A November 2025 note
(`wip/MONACO-FIRST-TAB-EMPTY-BUG.md`) blames Monaco for an empty editor on the first tab opened from zero tabs; it has
not been shown to be the same defect.

The independent reviews of this plan found five more defects of the same class by reading the code, none reproduced end
to end; the evidence is in [the register](../wip/P7S1-research-drift.md#findings-that-are-defects-not-drift) (F-2, F-7,
F-8). A save or autosave that completes after the user switched documents is applied to the open one. A rejected server
action leaves "Saving..." or the Save button stuck, because neither handler has a `finally`. The editor mounts on
`loading` alone (`EditorPane.tsx:244`) and `Editor.tsx:137-142` applies the `value` of the render that mounted it, so in
the render where `promptId` has just changed it can mount with the previous document's text. The freshly loaded footer
reads "Unsaved" because `lastSaved` is never set on load, while the obvious fix would read "Saved" for a restored draft
that is still unsaved. And the history dialog never loads its list: `VersionHistoryDialog` reads it inside the dialog's
`onOpenChange` callback, which Radix calls only for a change the dialog makes itself and never when the parent sets
`open`, as `EditorPane` does from its History button. A control test with a bare Radix dialog shows that the callback is
not called (`wip/P7S1-dialog-spike.test.tsx`); what a browser shows is unverified.

The fixes interlock, which is why this is one PRP. A draft is only safe to restore if the editor knows what the server
holds (the autosave baseline of #35). Restore (#32) is only safe if version history records the right states (#33). The
loader fix and the draft fix rewrite the same load path, and the tests for all of them need the same Postgres and
hook-test harness (#37). The editor persistence paths have no automated coverage today: the suite is 29 tests in five
files, all of them schemas and pure helpers; `PRPs/P5S5-*` records content bleeding between documents when these paths
changed without tests. One more fact shapes the plan: an untitled document is never autosaved (`useAutoSave` skips a
blank title), so its typed text exists only in the browser draft and the in-memory cache until the first manual save.
Anything that deletes drafts destroys user content.

Out of scope, with the issue that owns it: server-side tenancy and input hardening (P7S2, #39), except that moving
`restorePromptVersion` into a user-scoped service removes its unscoped `update` listed in #41; version-history payload
size and retention (#53); rate limiting of autosave and restore (#48); clearing drafts on sign-out (#44; all three draft
keys start with `prompt-`); conflicts between two browser tabs or devices, which stay last-writer-wins; whether
untitled documents should autosave; a rename from the document list not reaching the open editor, whose next autosave
then writes the old title back; a failed autosave that is only logged; and `Prompt.folder_id` being nullable while the
cached document type assumes a folder. The last four become follow-up issues, listed in the REPORT. Closing the tab of
a titled, autosaved, never-saved document offers "Discard", which deletes it (register finding F-9, read from the code
and not reproduced): a tab-close path outside this PRP, filed as the bug #74.

## What

| Defect | Today | After | Issue |
|---|---|---|---|
| Empty or wiped editor on a fresh mount | The load effect starts with an empty user id, is aborted when the id resolves, and `loadedRef` stops the reload | Loading waits for the user id (a failed or slow lookup settles as anonymous) and shows "Loading prompt..." meanwhile; the editor mounts only for a ready document; an aborted load owns nothing | #72 |
| Restore does not reload the editor | `handleVersionRestored` resets a ref that no effect watches; the next keystroke autosaves the old content over the restore | `restorePromptVersion` returns the restored row and the editor applies it, replacing the cache entry and clearing the draft; unsaved edits of a titled document are saved first | #32 |
| History records the wrong state | The snapshot is the row as read at save time, which autosave has already overwritten | A version is the saved state; an unchanged save adds nothing; restore snapshots the row it replaces | #33 |
| Stale draft wins | Any non-empty draft that differs from the server wins; empty content is never stored; nothing clears it after an autosave | A draft exists only while the working content differs from the last confirmed server content, carries a hash of the content it was based on, and is applied only when the server content still matches; a draft that loses is stashed, offered once and never deleted | #34 |
| Autosave writes without an edit | Every input change to the hook schedules a write | A write is scheduled only when title or content differ from the last loaded, saved, restored or autosaved values of that document | #35 |
| Set-title dialog reopens | `setTimeout(() => handleSave())` runs a closure that still holds the blank title | The confirmed title is passed to the save and becomes the working title | #36 |
| A completion changes the wrong document, or a flag sticks | Results are applied to whichever document is open; a rejected action leaves its busy flag set; a navigation orphans the queued actions, whose promises never settle | Each completion is applied by the id it started with and reports whether the document is still open; flags reset in `finally`; every request is abandoned after 30 seconds | found in review |
| The history list never loads | The list is read inside the dialog's `onOpenChange`, which Radix does not call when the parent sets `open` | The list is read in an effect when the dialog opens; Restore on a version asks "Restore this version?" first; every Restore button is disabled while a restore runs, and the dialog stays open meanwhile | #73 |
| No tests for any of this | 29 pure tests | Postgres-backed tests in CI and hook and component tests; each defect has a test that failed before its fix | #37 |

### Success Criteria
- [ ] On a fresh mount the document shows the server's title and content whichever of the user-id lookup and the fetch
  finishes first, under React Strict Mode too, and the editor shows "Loading prompt..." until then, from the first
  render
- [ ] The editor never mounts with another document's text, and a failed load shows its error
- [ ] Opening a document, switching to its tab, or reloading performs no write
- [ ] An edit is autosaved once, 500 ms after the last change, and afterwards no draft remains unless newer edits exist
- [ ] Clearing a document, waiting for autosave and reloading yields an empty document and no restore toast
- [ ] A draft whose base hash differs from the server content is not applied: a warning toast says why and offers
  "Restore my text", which puts the kept text back; a draft left by the removed hook is applied only to a document that
  was never saved and migrated to the new format; an untitled document's typed text survives a reload and a rename from
  the list
- [ ] Save A, autosave B, save C lists C then A, both restorable; saving unchanged content adds no row
- [ ] Restore shows the restored title and content at once, replaces the cache entry, clears the draft, pauses autosave
  while it runs, and a following edit autosaves on top of the restored content; unsaved edits of a titled document are
  saved first, so the saved row it replaces is in history
- [ ] A save, autosave or restore that completes after a switch to another document or an unmount leaves the open
  document unchanged and updates only its own cache entry; a rejected action resets its busy flag
- [ ] A server action or document fetch that never settles is abandoned after 30 seconds: its busy flag resets and the
  next edit is saved
- [ ] The History button lists the document's saved versions, newest first; Restore on a version asks "Restore this
  version?" first, and Cancel or Escape drops the question and restores nothing; while a restore runs every Restore
  button is disabled and Escape or the Close button leaves the dialog open
- [ ] The footer reads "Unsaved changes" while the working copy differs from the server and "Saved <time>" otherwise
- [ ] Saving an untitled document needs one confirmation of the title, which then is the document's title
- [ ] `npm test` runs the Postgres-backed tests in CI against a service container and reports them as skipped when
  `TEST_DATABASE_URL` is unset outside CI
- [ ] Every CI gate passes, no file enters the RED band, no lint warning is added and the loader file ends with none,
  and each file in the contract's coverage scope reaches 80% line, function, branch and statement coverage

## Decisions

Seven decisions shape the plan. [The decisions document](docs/P7S1-decisions.md) has the full text of each, with the
alternatives rejected. Four were put to the developer, who on 22/10/2026 confirmed D1, D2 and D5 as written and D4 with
one addition, a question before a restore. They were made here so the executing agents do not guess; a later change
redoes the tasks that build on a decision.

| Decision | What it fixes | Developer, 22/10/2026 |
|---|---|---|
| [D1 Version model](docs/P7S1-decisions.md#d1-version-model) | A version is the saved state; a restore snapshots the row it replaces; history orders by `id desc` | confirmed as written |
| [D2 Drafts](docs/P7S1-decisions.md#d2-drafts-and-the-baseline) | Content-only envelope under `prompt-v1-<id>` with a content-hash base; a losing draft is stashed and offered once; the legacy raw draft is read once | confirmed as written |
| [D3 Autosave](docs/P7S1-decisions.md#d3-autosave) | A write is due only when title or content differ from the baseline of that document; paused during a save or restore | not put to the developer |
| [D4 Restore](docs/P7S1-decisions.md#d4-restore) | `useVersionRestore` owns the call and saves unsaved edits first; Restore asks "Restore this version?" first; the dialog loads its list on open and stays open meanwhile | confirmed, with the question |
| [D5 Test seams](docs/P7S1-decisions.md#d5-test-seams) | `service.ts` takes `(db, userId, input)`; Postgres-backed tests; jsdom; a guarded database URL; no module mocks | confirmed as written |
| [D6 Loader protocol](docs/P7S1-decisions.md#d6-the-loader-protocol) | Identity gate, one reducer, atomic `ready`, editor mounts only when ready; no cache for the anonymous identity | not put to the developer |
| [D7 Async completions](docs/P7S1-decisions.md#d7-async-completions) | Captured ids, the boolean from `markSynced` and `applyServerState`, `finally`, a 30-second limit, stale-callback guards | not put to the developer |

## All Needed Context

References with the reason each matters, the current and desired trees, the verified gotchas and the database
environment are in [the task context](docs/P7S1-task-context.md). The red-to-green map and the briefs of T1, T2, T3 and
T9 are in [the task briefs](docs/P7S1-task-briefs.md), and the client briefs T4 to T8 are in
[the client briefs](docs/P7S1-task-briefs-client.md). Read the section for your task, and read the source it cites.

## Implementation Blueprint

The module map with line budgets, every TypeScript interface, the loader, draft and completion protocols, the editor
view, the write-ordering rules and the coverage scope are in [the contract](docs/P7S1-editor-persistence-contracts.md);
the server shells and transactions are its server half, in
[the Server Contract](docs/P7S1-task-briefs.md#server-contract). The client half is specified by four working reference
implementations in `wip/` with 211 passing tests (`P7S1-draft-spike`, `P7S1-loader-spike`, `P7S1-persistence-spike`,
`P7S1-dialog-spike`) over shared typed fakes (`P7S1-test-fakes`); the executing agents adapt them.
`wip/P7S1-mutation-check.py` applies 90 deliberate defects to them one at a time and reports whether a test fails for
each. This document and those are one specification; where they disagree, the contract wins on interfaces and the
decisions document wins on decisions.

```mermaid
flowchart LR
  W["Working copy (title, content)"] -- "content differs from synced" --> D["Draft prompt-v1-id, base = hash(synced)"]
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

Error handling: actions keep returning `ActionResult` and the `NEXT_REDIRECT` rethrow. Services return `ActionResult`
for expected outcomes and let unexpected database errors throw, so the transaction rolls back and the action reports
"Failed to ...". The draft store never throws into React. On the client a rejected action, or one that never settles
within 30 seconds, is handled like a failed one, and a failed or rejected fetch leaves `synced` null, which keeps
autosave off: the client never writes when it does not know what the server holds.

## Task List

Nine tasks, each 2 to 4 hours, each ending with every gate green and no feature disabled, so every commit is a working
state. One agent per task writes its tests first and watches them fail for the stated reason (the red-to-green map). The
briefs are in [the task briefs](docs/P7S1-task-briefs.md#briefs) and
[the client briefs](docs/P7S1-task-briefs-client.md#briefs). The hours add up to 30. Each client task adapts a working
reference implementation with passing, type-clean tests, which is what keeps T5 to T8 at the 4-hour limit; T5, T7 and T8
are dispatched in two halves, Step 1 (green, committed by the main session) and then Steps 2 and 3, so that no agent
exhausts its turn budget in the middle of a red state.

| Task | Title | Agent | Hours | After | [P] |
|---|---|---|---|---|---|
| P7S1T1 | Add the Postgres and DOM test harness and CI service | `qa-test-automation-engineer` | 3 | none | with T4 |
| P7S1T2 | Move save and autosave into a tested service with commit-style versions | `senior-backend-engineer` | 3 | T1 | with T4 |
| P7S1T3 | Move restore and history into the service | `senior-backend-engineer` | 3 | T2 | with T4 |
| P7S1T4 | Add the sync helpers, the draft store, the cache module and the request timeout | `senior-frontend-engineer` | 3 | none | with T1 to T3 |
| P7S1T5 | Rewrite the document loader protocol | `senior-frontend-engineer` | 4 | T1, T4 | |
| P7S1T6 | Replace the draft hook and add the autosave baseline | `senior-frontend-engineer` | 4 | T5 | |
| P7S1T7 | Extract the persistence hooks and fix the set-title save | `senior-frontend-engineer` | 4 | T2, T3, T5, T6 | |
| P7S1T8 | Restore into the editor, fix the history dialog and remove the superseded code | `senior-frontend-engineer` | 4 | T3, T7 | |
| P7S1T9 | Sweep the documentation and the wip files | `documentation-manager` | 2 | T8 | |

T4 touches only new files and runs in a worktree, or after T3, because agents sharing a checkout would see one another's
intentionally failing tests. The `documentation-manager` also runs after T1, T3, T5 and T6, dispatched by the main
session with the changed-file list and the drift rows that
[the register](../wip/P7S1-research-drift.md#register) assigns to that task, so each document is corrected with the
behaviour that made it false. The main session provisions the test database before it dispatches T1, T2 or T3, and
alone edits issues: it amends dev-review #38 (a cold open, an open after visiting Settings, the conflict toast,
"Restore my text" clicked while the editor is still starting up, the "Restore this version?" question and Cancel on it,
Escape during a restore, and closing the tab of a titled, autosaved, never-saved document to look for "Discard" are the
new flows), comments on #37, #41, #44, #45 and #53, and files the follow-ups. The INITIAL report created the issues:
#72 and #73 under epic #31, the tasks #75 to #83, and #74 beside the epic.

## Validation Loop

Run from the repository root, never after a `cd`. The Prisma and build steps need the placeholder values CI sets.

### Level 1: syntax and style

```bash
# generate: a fresh clone or worktree needs the Prisma client before tsc
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db npx prisma generate
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db npx prisma validate
npm run lint
npx tsc --noEmit
bash scripts/audit-code-size.sh --summary
node -e "require('js-yaml').load(require('fs').readFileSync(process.argv[1], 'utf8'))" .github/workflows/ci.yml   # after T1: parses
# Expected: no errors. Lint baseline on 20/10/2026 is 18 max-lines-per-function warnings;
# none is added and the three in useDocumentLoader.ts go.
```

### Level 2: unit and Postgres-backed tests

```bash
npm test
# Without TEST_DATABASE_URL the DB-backed suites are reported as skipped. Baseline before this PRP: 5 files, 29 tests.

# With a database (credentials and recipes: PRPs/docs/P7S1-task-context.md#environment-for-database-tests):
export TEST_DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@localhost:54322/prompthub_test"
npm test

# Per-file coverage for each file in the contract's scope (read coverage/coverage-summary.json, not the text table);
# a database-backed file needs TEST_DATABASE_URL exported as above:
npx vitest run --coverage --coverage.include=src/features/editor/service.ts --coverage.reporter=json-summary

# The reference implementations, until the main session removes them after T9 (211 tests, type-clean):
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-draft-spike.test.tsx wip/P7S1-loader-spike.test.tsx wip/P7S1-persistence-spike.test.tsx wip/P7S1-dialog-spike.test.tsx
# 90 deliberate defects, one at a time: each must be KILLED by a test (about 5 minutes)
python3 wip/P7S1-mutation-check.py
```

### Level 3: build and browser

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db DIRECT_URL=postgresql://user:pass@localhost:5432/db NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
```

There is no end-to-end runner and cloud sessions have no browser tooling, so the browser checks are reported as not run
and belong to dev-review #38: untitled save through the dialog; edit and autosave; version save; the History list;
restore an older version (Cancel the question once, then confirm) and edit; Escape during a pending restore; clear and
reload; open documents without editing
and confirm "Recently updated" is unchanged; a cold open and an open after visiting Settings; a draft conflict and its
"Restore my text" action, also clicked while the editor is still starting up; the same edit in two tabs; closing the tab
of a titled, autosaved, never-saved document and looking for "Discard" (F-9). They run on `npm run dev` port 3010 or the
Docker stack.

## Final Validation Checklist
- [ ] `npm test` passes; the DB-backed suites pass with `TEST_DATABASE_URL` set and show as skipped without it
- [ ] Each defect has a test that failed before its fix, recorded in the REPORT with the failing output
- [ ] `npx tsc --noEmit`, `npm run lint`, `npx prisma validate`, the size audit and `npm run build` pass
- [ ] No file entered the RED band; `EditorPane.tsx` is shorter than 329 lines; the register row for
  `src/features/prompts/actions.ts` has its new line count
- [ ] Per-file coverage at least 80% on every file in the contract's scope, with each exemption and its reason recorded
- [ ] `service.ts` has no `"use server"` directive and no client module imports it
- [ ] A search of `src/`, outside the changelog lines of file headers, finds no import, use or comment naming
  `useLocalStorage`, `resetLoadedRef`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef` or
  `titlePromptIdRef`, and `Header.tsx` imports `clearDocumentCache` from `document-cache`
- [ ] Every drift-register row is fixed or filed; every changed file that has a header block has a changelog line (T1
  and T3 add one to `vitest.config.ts` and `src/features/prompts/actions.ts`); README has a Testing section; the wip
  reference implementations, the mutation check and the probes are deleted by the main session with `git rm`
- [ ] Browser checks are listed as not run and handed to #38

## Anti-Patterns to Avoid
- Do not mock a module of this repository (`vi.mock("@/...")`), import `@/lib/db`, an action or Supabase code in a test,
  or edit an existing test to make a change pass
- Do not export a function that takes `userId` from a `"use server"` file
- Do not delete a draft this tab did not write except the value the loader read and did not apply; a draft that loses to
  the server is stashed and offered, never discarded; and do not apply a legacy draft to a saved document
- Do not add a second draft writer, and do not reintroduce a hook that holds localStorage state
- Do not reintroduce `isTransitioning`, the ownership ref flags or a loaded mark; consume `ready`
- Do not remember the user id across mounts: a remembered id outlives a change of session
- Do not read the history list inside the dialog's `onOpenChange`; Radix does not call it when the parent sets `open`
- Do not restore on the first click: Restore asks "Restore this version?" first, and a question never outlives its
  opening or its document
- Do not apply a response for document A to the state of document B; pass the id and use the boolean that `markSynced`
  and `applyServerState` return, and do not read the open document at completion time to decide where a result belongs
- Do not leave a busy flag to the success path; reset it in a `finally`, and do not await a server action or the
  document fetch without the 30-second limit
- Do not let a client write when it has no baseline
- Do not widen into P7S2, #44, #48 or #53; file what you find

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
- `documentation-manager` (Task 9, plus the syncs after Tasks 1, 3, 5 and 6)
Notes:
- Decisions D1, D2 and D5 were confirmed as written and D4 with a question before a restore, on 22/10/2026
- The reference implementations in wip/ (211 tests, 90 mutations each killed by a test) specify Tasks 4 to 8; the main
  session deletes them after Task 9
- Tasks 5, 7 and 8 are dispatched in two halves, Step 1 and then Steps 2 and 3; Tasks 5 and 7 are the riskiest
- Browser verification is #38 and cannot be run by an agent
- Accepted: two tabs or devices stay last-writer-wins; a false draft conflict after a lost autosave response is offered,
  not lost
**Estimated Implementation Time (FTE)**: 27-33 hours (4 days)
