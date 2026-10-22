# PromptHub
## P7S1 - Editor Data Integrity - COMPLETION REPORT

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 - Editor Data Integrity - COMPLETION REPORT | 22/10/2026 11:11 GMT+10 | 22/10/2026 11:48 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Implementation Summary](#implementation-summary)
  - [Server](#server)
  - [Client modules](#client-modules)
  - [Hooks and components](#hooks-and-components)
  - [Test harness and CI](#test-harness-and-ci)
  - [Documentation](#documentation)
- [Process](#process)
- [Commits](#commits)
- [Verification Results](#verification-results)
  - [Gates](#gates)
  - [Coverage](#coverage)
  - [Red runs](#red-runs)
  - [Feature verification](#feature-verification)
  - [Not verified](#not-verified)
- [Files Changed](#files-changed)
- [Notes](#notes)
  - [Deviations from the PRP and the contract](#deviations-from-the-prp-and-the-contract)
  - [Limitations and accepted behaviour](#limitations-and-accepted-behaviour)
  - [Drift register and documents that were wrong](#drift-register-and-documents-that-were-wrong)
  - [Issues](#issues)
  - [Left for the main session](#left-for-the-main-session)

## Overview

[The PRP](../complete/P7S1-editor-data-integrity.md) set out to make every path by which the editor reads or writes a document
trustworthy: nine tasks (P7S1T1 to P7S1T9, issues #75 to #83) under epic #31. The code for all nine is written, tested
and committed on branch `ccr-788f6ed9-dwd9ms`, and every CI gate that can run in this environment passes. No browser
flow has been run, because the cloud session has no browser tooling; those flows are dev-review #38 and decide whether
the epic closes. The PRP Status in the footer is `COMPLETE` and the PRP is archived, at the developer's instruction
on 22/10/2026; the rules tie `COMPLETE` to a closed epic, and #31 stays open until #38 passes.

Delivered, by part:

1. A Postgres-backed and DOM test harness: `src/test/db.ts` with a guard that refuses any database that is not
   disposable, jsdom and Testing Library as devDependencies, the automatic JSX transform, and a `postgres:17-alpine`
   service plus a migrate step in `.github/workflows/ci.yml` (T1).
2. A server service, `src/features/editor/service.ts`, in which a version is the saved state, an unchanged save adds no
   version, a restore snapshots the row it replaces and returns the restored row, and history orders by `id` descending
   (T2, T3). No schema change and no migration.
3. Pure client modules: the sync helpers, a content-hash draft store, a user-checked document cache and a 30-second
   request limit (T4).
4. A document loader that waits for the user id, applies a document and its baseline in one reducer action, and mounts
   the editor only for a ready document, so a fresh mount no longer ends empty or wipes what it loaded (T5).
5. A draft hook that keeps a draft only while the working content differs from the server's, stashes a draft that lost
   instead of applying or deleting it, and an autosave that writes only when title or content differ from the baseline
   (T6).
6. Persistence hooks that apply each completion by the document it started with, reset every busy flag in a `finally`,
   and a manual save whose set-title dialog no longer reopens (T7).
7. A restore that replaces what the editor shows, a history dialog that loads its list when it opens and asks "Restore
   this version?" before it restores, and the removal of the superseded code (T8).
8. A documentation and `wip/` sweep and a README Testing section (T9, plus the syncs that followed T1, T3, T5 and T6).

The gate figures below were measured on 22/10/2026 on the final tree, after the last two tests were added (a review
follow-up: the Ctrl+S default is prevented, and a version with no title restores).

## Implementation Summary

### Server

`src/features/editor/service.ts` (208 lines, no `"use server"` directive, imported only by the two action files) holds
four functions that take `(db, userId, input)`. `saveVersion` runs in one transaction. It starts with a user-scoped
`updateMany`, which is the ownership check and takes the row lock, then reads the newest version by `id` descending and
adds a version only when the newest one differs from the saved title and content. `autoSaveDocument` is the unchanged
user-scoped `updateMany`, with no version. `restoreVersion` locks the row with `SELECT ... FOR UPDATE` scoped by user,
looks the version up by `id` and `prompt_id`, records the row as it stands when the newest version differs from it,
writes the restored state with a user-scoped `updateMany`, records the restored state unless the newest version already
holds it, and returns `{ title, content }`. `listVersions` checks ownership first and then reads at most 50 versions by
`id` descending. Unexpected database errors throw, so the transaction rolls back and the action reports its generic
failure.

The actions in `src/features/editor/actions.ts` and `src/features/prompts/actions.ts` keep their validation,
authentication and rate limits and delegate. `restorePromptVersion` now returns `ActionResult<{ title, content }>`
instead of `ActionResult<void>`, and its former unscoped `tx.prompt.update` (listed in issue #41) is gone. The write
also no longer sets the `diff` column, which has a schema default of `""`. The row for `src/features/prompts/actions.ts`
in the code-size register changed from 699 to 674 lines, and `wc -l` prints 674; the file stays RED with a recorded
`split` decision (#51).

### Client modules

All are new and pure of React, except `use-latest.ts`. `sync.ts` (80 lines) holds `sameFields`, `needsAutoSave`,
`viewState` and `saveStatus`. `request-timeout.ts` (40) holds `withTimeout` and `REQUEST_TIMEOUT_MS` of 30,000.
`draft.ts` (220) holds the keys (`prompt-v1-<id>`, the legacy `prompt-<id>` and the stash
`prompt-v1-<id>:conflict`), the content hash, the storage seam, `readDraft`, `writeDraft`, the compare-and-delete
helpers, `stashConflict` and `resolveDraft`. `document-cache.ts` (98) is the module cache moved out of the loader: it
drops another user's entry, and `setDocumentCacheEntry` returns without writing for the `ANONYMOUS` identity.
`src/hooks/use-latest.ts` (34) keeps the latest value in a ref written in a passive effect.

### Hooks and components

The loader is three files. `loader-state.ts` (128) holds the reducer, whose actions are `wipe`, `loading`, `apply`,
`fail`, `title`, `content`, `synced` and `serverState`. `loader-protocol.ts` (229) holds `runLoad`, the paths P0 to P7
of the contract, the draft decision at load (apply, or stash and offer by a warning toast with the action "Restore my
text"), and the `DocumentLoaderIo` seam. `hooks/useDocumentLoader.ts` (203) holds `useIdentity` (looked up on every
mount, settled as `ANONYMOUS` on a rejection or after `IDENTITY_TIMEOUT_MS` of 10,000), the load effect, `ready`
(`synced.promptId === promptId`), and `markSynced` and `applyServerState`. Both update the document's cache entry first
and change React state only when the id is the open document and its content is applied (`promptIdRef` and
`monacoPromptIdRef`), and both return whether they did.

The persistence composition is `hooks/useDocumentPersistence.ts` (104) over `useDraftSync` (the only draft writer),
`useDocumentCacheSync`, `useVersionRestore`, `useVersionSave` and `useServerAutoSave`, with `useAutoSave` (rewritten
with a baseline) beneath the last. `useVersionSave` has one `saveVersion(title)` behind the button, Ctrl+S and the
set-title dialog, so the confirmed title is passed to the save instead of being read from state a `setTimeout` later;
it is single-flight and ignored while a restore runs. `useVersionRestore` saves unsaved edits of a titled document
through `autoSavePrompt` first, refuses a blank title with unsaved edits, applies the restored row with
`applyServerState`, and sets the list and tab titles of its own document. `useServerAutoSave` passes no `promptId` to
`useAutoSave` while a save or restore runs, which cancels a pending write.

`document-actions.ts` (75) defines `DocumentActions` and `withActionTimeout`. `components/VersionHistoryDialog.tsx`
(254) reads its list in an effect on `open` and `promptId` through a ref to `loadHistory`, shows the question "Restore
this version?" in an `AlertDialog` (`RestoreQuestion`), disables every Restore button and ignores requests to close
while a restore runs, and closes itself only when `onRestore` resolves true. `components/EditorPane.tsx` shrank from
329 to 206 lines: it renders from `viewState` and `saveStatus`, mounts `Editor` only for a ready document, and builds
the module-level `loaderIo` and `documentActions`. `Editor.tsx` reads `value` through `useLatest` in `handleMount`.
`Header.tsx` imports `clearDocumentCache` from `document-cache`. `hooks/useLocalStorage.ts` is deleted.

### Test harness and CI

`src/test/db.ts` (161) refuses a `TEST_DATABASE_URL` unless the host is loopback, the database name contains "test", and
no `host`, `hostaddr` or `port` parameter is present, and it throws when the URL is unset in GitHub Actions. The
suites use it through `describeDb`, which skips them when the URL is unset elsewhere. `vitest.config.ts` includes
`*.test.tsx`, applies `esbuild: { jsx: "automatic" }` and lists the coverage scope. `package.json` gains
`@testing-library/dom`, `@testing-library/react` and `jsdom`. `ci.yml` gains the `postgres:17-alpine` service, a
`prisma migrate deploy` step against the test database, and `TEST_DATABASE_URL`. `.env.example` lists the variable. The
shared fakes in `src/test/` are `storage-fake.ts`, `loader-world.ts`, `draft-world.ts`, `editor-env.ts`,
`editor-session.ts`, `history-dialog.tsx` and `failing-db.ts`.

### Documentation

The syncs after T1, T3, T5 and T6 and the T9 sweep corrected: `docs/rules/project.md` (stack, layout, files, environment
variables), `docs/rules/testing.md`, `docs/rules/code-size-register.md`, the four `docs/project/` specifications,
`README.md` (a Testing section and the version-model sentence), the QA and frontend agents and `AGENT-CONTRACT.md` in
`.claude/` with identical edits in `.gemini/`, the three `.serena/memories/` files, and the contract. The drift register
carries the disposition of every row (see [the notes](#drift-register-and-documents-that-were-wrong)).

## Process

Nine tasks ran in two sessions. Session A built T1 to T4 (the Postgres and DOM harness and CI service; save and autosave
in `service.ts`; restore and history in the service; the pure client modules) and merged them to master through PR #88.
Session B built T5 to T9 on this branch, merged master into it (`33cdef3`) and wrote this report. On 22/10/2026 the
developer confirmed decisions D1, D2 and D5 as written and D4 with a question before a restore; D3, D6 and D7 were not
put to the developer. The developer also approved, on 22/10/2026, every test edit the task agents made after their first
red runs.

Every task was test-first. T5 to T8 were dispatched in halves: Step 1 was behaviour-preserving and committed by the main
session, then an agent in an isolated git worktree committed a red state and a green state, and the two were squashed on
merge, so every commit on the branch is green. The main session re-ran each red commit itself. The squashed red commits
are not in the history, so the figures and messages in [Red runs](#red-runs) come from the dispatching prompt and cannot
be re-derived from git. The red runs of T1 to T4 were recorded by session A on issues #75 to #78, which I did not read.

Reviews. Session A reviewed T5 and T6 read-only. Its mutation checks of 32 and 26 defects found one real gap, a
completion landing while the open document re-fetches, fixed in `3923698` with two tests plus one that `loading` ends
when `promptId` empties. The main session ran a 26-defect mutation check on the final dialog and restore hook: 24 were
killed, one gap was closed by a new test (a restore that fails after its edits were saved leaves them as the baseline),
and one survivor is equivalent (the `open &&` guard on the restore question). The reference implementations' own
90-defect mutation check ran during planning. I re-ran none of these mutation checks.

Test edits made after a first red run, all approved by the developer: in T1 `src/test/db.test.ts` (the `describeDb`
check was rewritten because `describe.skip` is a new function on each access); in T2 `service.save.test.ts` (three
edge-case tests added after a mutation check, two long lines wrapped, and the local failing-transaction helper
replaced by an import of `src/test/failing-db.ts`); in T3 `service.restore.test.ts` (one test for "newest means highest
id"); in T4 `sync.test.ts` (the `it.each` titles) and `document-cache.test.ts` (a cross-user test strengthened); in T5
(three titles shortened to 120 columns, one test added after a mutation finding, assertions unchanged); in T6 (two T5
tests that applied a legacy draft to a saved document were removed before the first red run, because decision D2
replaces them with the S-7 cases); in T7 and T8 (a harness slip fixed before the red commit, a title shortened, one
test added after the mutation check).

## Commits

`git log --oneline 19209f4..HEAD` lists 25 commits since the commit before T1 (`19209f4`, "plan: P7S1 decisions D1, D2,
D4 and D5 confirmed"). Two are not P7S1 work and touch no file in the diff: `4ef3067`, an empty commit by a bot, and
`25351ad`, the merge of PR #87. This report's own commit is not in the list.

| Hash | Task | Message |
|---|---|---|
| `4ef3067` | none | Answered questions about the .gemini folder format |
| `5377a86` | T1 | test: add the Postgres and DOM test harness and the CI database service (P7S1T1) |
| `35ab2ed` | T1 | docs: test harness rules after P7S1T1 (drift rows DR-7, DR-8, DR-9, DR-11, DR-15, DR-20) |
| `893669c` | T4 | feat: add the sync helpers, the draft store, the document cache and the request timeout (P7S1T4) |
| `d22b160` | T4 | merge: P7S1T4 sync helpers, draft store, document cache and request timeout |
| `49a70e8` | T2 | fix: record the saved state in version history; move save and autosave into a tested service (P7S1T2) |
| `6ef77f0` | T5 | refactor: give the document loader an injectable io seam (P7S1T5 step 1) |
| `51d6f8b` | T3 | fix: restore records the working copy and the restored state; move restore and history into the service (P7S1T3) |
| `ffa14ed` | T3 | docs: version history, restore and the service layer after P7S1T2 and T3 (drift rows DR-4, DR-6, DR-18, DR-21) |
| `85aa391` | T3 | refactor: share the failing-transaction test seam between the service suites (P7S1T3) |
| `78389b2` | T5 | feat: rewrite the document loader on the identity-gate protocol (P7S1T5) |
| `d2a3038` | T5 | docs: loader protocol and document cache after P7S1T5 (drift rows DR-16 cache sentence, DR-19 flags; DR-1 to DR-3 confirmed) |
| `af67df3` | T1 to T4 | Merge pull request #88 from abuklea/ccr-4f467a82-1axffn |
| `25351ad` | none | Merge pull request #87 from abuklea/answer-gemini-skills-question-12254340895215169783 |
| `f0b6fc0` | T6 | feat: replace the draft hook with the v1 draft protocol and give autosave a baseline (P7S1T6) |
| `33cdef3` | T5, T6 | merge: master (P7S1T1 to T4 and the T2/T3 server chain) into the loader and draft chain |
| `3923698` | T5 | fix: a completion that lands while the open document re-fetches changes nothing (P7S1T5 review) |
| `9a1933b` | T6 | docs: drafts, autosave and the footer after P7S1T6 (drift rows DR-5, DR-16, DR-19) |
| `d6661d6` | T6 | docs: mirror the P7S1 agent and contract edits into .gemini; drop stale state from the project overview |
| `87770f9` | T7 | refactor: extract the save, autosave and cache logic from EditorPane into persistence hooks (P7S1T7 step 1) |
| `1412b0f` | T7 | feat: fix the set-title save and apply every async completion by the document it started with (P7S1T7) |
| `eb1eb22` | T8 | refactor: move the restore call into useVersionRestore and give the history dialog loadHistory and onRestore (P7S1T8 step 1) |
| `4f1822e` | T8 | feat: restore into the editor, load the history list when it opens and ask before restoring (P7S1T8) |
| `851479d` | T9 | docs: README Testing section, memory files and the drift register closing notes after P7S1 (drift row DR-13 and the DR-19 remainder) |
| `9f7caf4` | T9 | docs: the contract's module map names the test helpers P7S1 added, and the raw-draft note is past tense |

The task column for `d6661d6` and the merges is my reading of each message, not a recorded fact.

## Verification Results

### Gates

All commands ran from the repository root with the CI placeholder values for `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The database run used a disposable local Postgres 16
cluster through `TEST_DATABASE_URL`; the URL is not recorded here.

| Gate | Result |
|---|---|
| `npx prisma validate` | `The schema at prisma/schema.prisma is valid` |
| `npm run lint` | 0 errors, 15 `max-lines-per-function` warnings |
| `npx tsc --noEmit` | exit 0, no output |
| `npm test` without `TEST_DATABASE_URL` | `Test Files  29 passed \| 2 skipped (31)`, `Tests  329 passed \| 29 skipped (358)` |
| `npm test` with `TEST_DATABASE_URL` | `Test Files  31 passed (31)`, `Tests  358 passed (358)` |
| `bash scripts/audit-code-size.sh --summary` | source GREEN 96, YELLOW 3, RED 1; test GREEN 37, YELLOW 2, RED 0; `RESULT: PASS - every RED file has a recorded decision.` |
| `npm run build` | exit 0; all routes compiled; First Load JS shared by all 87.5 kB |
| gitleaks | not run: CI only |

The PRP gives a lint baseline of 18 warnings, which I did not re-measure at the base commit. None of the 15 is in
`useDocumentLoader.ts`, where the PRP counted three, so 18 less those three is 15. Three of the 15 are in files this
PRP edited: `EditorPane` (99 lines, down from the 234 the PRP records), `Editor` (103) and `Header` (85). The one RED
source file is `src/features/prompts/actions.ts` (674 lines, registered). The two YELLOW test files are `draft.test.ts`
(322 lines) and `useDocumentPersistence.restore.test.tsx` (398). The largest new source file is
`VersionHistoryDialog.tsx` (254 lines) and the largest helper is `src/test/loader-world.ts` (257).

The suite had 29 tests in five files before this PRP; it now has 358 tests in 31 files. The 29 skipped tests without a
database are the 26 in `service.save.test.ts` and `service.restore.test.ts` (both files skipped) and 3 in
`src/test/db.test.ts`, which otherwise runs (`40 passed | 3 skipped`). I did not run the CI service container: it ran
for the first time on PR #88, where, per the dispatching prompt, migrations applied and 182 tests passed with the
database suites running. The present tree has not been through CI.

### Coverage

Measured per file with `npx vitest run --coverage --coverage.include=<file> --coverage.reporter=json-summary` and read
from `coverage/coverage-summary.json`, with `TEST_DATABASE_URL` set. Each cell is the percentage; the target is 80 on
each measure.

| File | Lines | Functions | Branches | Statements |
|---|---|---|---|---|
| `src/features/editor/sync.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/request-timeout.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/draft.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/document-cache.ts` | 100 | 100 | 100 | 100 |
| `src/hooks/use-latest.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/loader-state.ts` | 100 | 100 | 95.23 | 100 |
| `src/features/editor/loader-protocol.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/hooks/useDocumentLoader.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/hooks/useAutoSave.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/hooks/useDraftSync.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/document-actions.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/hooks/useDocumentCacheSync.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/hooks/useVersionSave.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/hooks/useServerAutoSave.ts` | 100 | 100 | 84.61 | 100 |
| `src/features/editor/hooks/useVersionRestore.ts` | 100 | 100 | 92.85 | 100 |
| `src/features/editor/hooks/useDocumentPersistence.ts` | 100 | 100 | 100 | 100 |
| `src/features/editor/components/VersionHistoryDialog.tsx` | 100 | 100 | 100 | 100 |
| `src/features/editor/service.ts` | 100 | 100 | 100 | 100 |
| `src/test/db.ts` | 97.18 | 100 | 87.87 | 97.18 |

Every file in the contract's scope meets 80 on every measure. The low points are the branches of `useServerAutoSave.ts`
(11 of 13) and `useVersionRestore.ts` (26 of 28), and `src/test/db.ts` (69 of 71 lines, 29 of 33 branches). I did not
read which branches those are. Without a database the two database-backed files fall to the figures below, which is the
exemption the contract allows for functions that need a database.

| File, no `TEST_DATABASE_URL` | Lines | Functions | Branches | Statements |
|---|---|---|---|---|
| `src/features/editor/service.ts` | 4.9 | 0 | 100 | 4.9 |
| `src/test/db.ts` | 61.97 | 60 | 95.23 | 61.97 |

Exempt from the per-file measure, with the reason: the action files `src/features/editor/actions.ts` and
`src/features/prompts/actions.ts` are shells (validate, authenticate, rate-limit, delegate), and how every action is
tested is issue #45's decision; `EditorPane.tsx` is composition and JSX, covered through the hook and dialog suites,
`viewState`, `saveStatus` and dev-review #38. `Editor.tsx` (the `useLatest` change in `handleMount`) is not in the
scope: Monaco does not run in jsdom, and I found no test of that change.

### Red runs

The main session ran each red commit before the green one. The counts and messages are from the dispatching prompt.
T1 to T4 are recorded on issues #75 to #78.

| Task | New tests | Failed on the first red run | Notes |
|---|---|---|---|
| T5 | 34 | 33 | 1 regression test passed on arrival |
| T6 | 52 | 40 | 17 writer tests failed on the stub's throw, not an assertion; four were later shown by mutation to catch real defects |
| T7 | 41 | 19 | 22 regression tests were green on arrival |
| T8 | 51 | 46 | 5 regression tests |

The failing messages tie each defect to its red evidence.

| Defect | Failing assertion on the red run | Suite that holds the test now |
|---|---|---|
| Fresh-mount race, #72 | `expected null to be 'Server title'` | `useDocumentLoader.fresh-mount.test.tsx` |
| A fetch before the identity is known, #72 | `expected [ { …(2) } ] to have a length of +0 but got 1` | `useDocumentLoader.fresh-mount.test.tsx` |
| Autosave on mount, #35 | `expected [ {…} ] to deeply equal []` | `useAutoSave.test.tsx`, `useServerAutoSave.test.tsx` |
| Stale legacy draft wins, #34 | `expected 'stale legacy text' to be 'server'` | `useDocumentLoader.draft*.test.tsx`, `useDraftSync.test.tsx` |
| Set-title dialog reopens, #36 | `expected [] to deeply equal [ { name: 'save', … } ]` | `useVersionSave.test.tsx` |
| Busy flags stick, F-7 | `expected true to be false` | `useVersionSave.completions.test.tsx`, `useServerAutoSave.test.tsx` |
| History list never loads, #73 | `history read 0 was requested: expected 0 to be greater than 0` | `VersionHistoryDialog.test.tsx` |
| Restore does not flush edits first, #32 | `expected [ 'restore' ] to deeply equal [ 'autosave', 'restore' ]` | `useDocumentPersistence.restore.test.tsx` |

The suite named for each row is my mapping from file names and test titles, not a recorded fact. The red evidence for
#33 (a version holds the saved state), the server half of #32 and the draft-store, cache and timeout modules is on
issues #75 to #78 and was not read.

### Feature verification

The status "covered by tests" means the named suites pass in the runs above and that their `describe` titles cover the
area. I did not map every test to every clause of a criterion. "Browser" means the behaviour in a real browser, which
nobody has verified.

| Success criterion | Evidence | Status |
|---|---|---|
| Fresh mount shows the server's document in either order, under Strict Mode, with "Loading prompt..." meanwhile | `useDocumentLoader.fresh-mount.test.tsx`, `sync.test.ts` | covered by tests; browser not run |
| The editor never mounts with another document's text; a failed load shows its error | `useDocumentLoader.switching.test.tsx`, `failures.test.tsx`, `viewState` | covered by tests; browser not run |
| Opening, switching or reloading performs no write | `useAutoSave.test.tsx`, `useServerAutoSave.test.tsx` | covered by tests; browser not run |
| An edit autosaves once, 500 ms after the last change, then no draft remains | `useAutoSave.test.tsx`, `useDraftSync.test.tsx` | covered by tests; browser not run |
| Clearing a document and reloading yields an empty document and no restore toast | `useDraftSync.test.tsx`, `useDocumentLoader.draft.test.tsx` | covered by tests; browser not run |
| A draft with a different base is not applied; "Restore my text" puts the kept text back | `useDocumentLoader.draft-conflict.test.tsx`, `draft.test.ts` | covered by tests; the click while Monaco starts not run |
| Save A, autosave B, save C lists C then A; an unchanged save adds no row | `service.save.test.ts`, `service.restore.test.ts` | covered by tests against Postgres |
| Restore shows the restored state at once, clears the draft, pauses autosave, saves edits first | `useDocumentPersistence.restore.test.tsx`, `service.restore.test.ts` | covered by tests; browser not run |
| A completion after a switch or unmount leaves the open document unchanged; a rejected action resets its flag | `useDocumentLoader.completions.test.tsx`, `useVersionSave.completions.test.tsx`, `useDocumentPersistence.restore.test.tsx` | covered by tests |
| A request that never settles is abandoned after 30 seconds | `request-timeout.test.ts`, `document-actions.test.ts` | covered by tests; the navigation-orphan case rests on code reading |
| The History button lists versions newest first; the question; Cancel and Escape; buttons disabled during a restore | `VersionHistoryDialog.test.tsx`, `.restore.test.tsx`, `.editor.test.tsx` | covered by tests in jsdom; browser not run |
| The footer reads "Unsaved changes" while the working copy differs, else "Saved <time>" | `sync.test.ts` (`saveStatus`) | covered by tests; the rendered text is in `EditorPane.tsx`, which is exempt; browser not run |
| Saving an untitled document needs one title confirmation | `useVersionSave.test.tsx` | covered by tests; browser not run |
| `npm test` runs the Postgres tests in CI and reports them as skipped without a URL | `src/test/db.ts`, `db.test.ts`, `ci.yml` | skipped without a URL: shown above; CI run on the present tree: not run |
| Every CI gate passes, no RED file, no new lint warning, 80% per file | [Gates](#gates), [Coverage](#coverage) | passes locally; gitleaks not run |

The Final Validation Checklist items that are searches were run and hold. A search of `src/` for `useLocalStorage`,
`resetLoadedRef`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef` and `titlePromptIdRef` matches only
two changelog lines in file headers (`EditorPane.tsx` for `titlePromptIdRef`, `hooks/index.ts` for `useLocalStorage`).
`Header.tsx` imports `clearDocumentCache` from `document-cache`. `service.ts` has no `"use server"` directive and is
imported by `editor/actions.ts` and `prompts/actions.ts` only. The only `vi.mock` in the suites is `sonner`; no test
imports `@/lib/db`, an action file or Supabase code. Every changed source file that has a header block has a changelog
line dated 22/10/2026, and every new `src/` file's `Source:` line names its own path.

### Not verified

Nothing in this report was checked in a browser, and no browser tooling exists in the cloud session
(`.claude/AGENT-CONTRACT.md#browser-checks`). Every flow below belongs to dev-review #38: a cold open; an open after
visiting Settings; the footer text; Monaco `handleMount` with `useLatest`, and the "Restore my text" click while Monaco
starts; the conflict toast; the restore question and its focus; Escape during a restore; the three layouts; the same
edit in two tabs; and closing the tab of a titled, autosaved, never-saved document to look for "Discard" (finding F-9,
#74). Also not verified: the CI run of the service container on the present tree, and the gitleaks scan. The browser
behaviour that issue #73 describes (the history list never loading) was shown only by a control test with a bare Radix
dialog, never in the browser.

## Files Changed

`git diff --name-status 19209f4 9f7caf4` lists 83 files: 49 added, 33 modified, 1 deleted, with 9,285 insertions and
1,028 deletions. The commits after `9f7caf4` add this report, edit the PRP footer, delete the 13 `wip/` files and add two
tests. All 49 additions are under `src/` (26 test files, 8 test helpers and 15 source files). Line counts are from
`wc -l` at HEAD.

Server and API (3):

| Status | File | Lines |
|---|---|---|
| NEW | `src/features/editor/service.ts` | 208 |
| UPDATE | `src/features/editor/actions.ts` | 121 |
| UPDATE | `src/features/prompts/actions.ts` | 674 |

Client modules and hooks (18):

| Status | File | Lines |
|---|---|---|
| NEW | `src/features/editor/sync.ts` | 80 |
| NEW | `src/features/editor/request-timeout.ts` | 40 |
| NEW | `src/features/editor/draft.ts` | 220 |
| NEW | `src/features/editor/document-cache.ts` | 98 |
| NEW | `src/features/editor/loader-state.ts` | 128 |
| NEW | `src/features/editor/loader-protocol.ts` | 229 |
| NEW | `src/features/editor/document-actions.ts` | 75 |
| NEW | `src/hooks/use-latest.ts` | 34 |
| NEW | `src/features/editor/hooks/useDocumentCacheSync.ts` | 58 |
| NEW | `src/features/editor/hooks/useDocumentPersistence.ts` | 104 |
| NEW | `src/features/editor/hooks/useDraftSync.ts` | 73 |
| NEW | `src/features/editor/hooks/useServerAutoSave.ts` | 92 |
| NEW | `src/features/editor/hooks/useVersionRestore.ts` | 135 |
| NEW | `src/features/editor/hooks/useVersionSave.ts` | 162 |
| UPDATE | `src/features/editor/hooks/useDocumentLoader.ts` | 203 |
| UPDATE | `src/features/editor/hooks/useAutoSave.ts` | 63 |
| UPDATE | `src/features/editor/hooks/index.ts` | 21 |
| DELETE | `src/features/editor/hooks/useLocalStorage.ts` | |

Components (4):

| Status | File | Lines |
|---|---|---|
| UPDATE | `src/features/editor/components/EditorPane.tsx` | 206 |
| UPDATE | `src/features/editor/components/VersionHistoryDialog.tsx` | 254 |
| UPDATE | `src/features/editor/components/Editor.tsx` | 202 |
| UPDATE | `src/components/layout/Header.tsx` | 126 |

Test helpers, all NEW and not measured for coverage (8):

| File | Lines |
|---|---|
| `src/test/db.ts` | 161 |
| `src/test/storage-fake.ts` | 60 |
| `src/test/loader-world.ts` | 257 |
| `src/test/draft-world.ts` | 172 |
| `src/test/editor-env.ts` | 219 |
| `src/test/editor-session.ts` | 186 |
| `src/test/history-dialog.tsx` | 197 |
| `src/test/failing-db.ts` | 56 |

Tests, all NEW (26 files, 329 tests; the 29 earlier tests are unchanged):

| File | Tests | Lines |
|---|---|---|
| `src/test/db.test.ts` | 43 | 172 |
| `src/features/editor/service.save.test.ts` | 12 | 214 |
| `src/features/editor/service.restore.test.ts` | 14 | 290 |
| `src/features/editor/sync.test.ts` | 25 | 88 |
| `src/features/editor/request-timeout.test.ts` | 5 | 78 |
| `src/features/editor/draft.test.ts` | 45 | 322 |
| `src/features/editor/document-cache.test.ts` | 9 | 141 |
| `src/features/editor/document-actions.test.ts` | 10 | 125 |
| `src/hooks/use-latest.test.tsx` | 4 | 74 |
| `src/features/editor/hooks/useDocumentLoader.fresh-mount.test.tsx` | 9 | 153 |
| `src/features/editor/hooks/useDocumentLoader.switching.test.tsx` | 8 | 185 |
| `src/features/editor/hooks/useDocumentLoader.failures.test.tsx` | 4 | 96 |
| `src/features/editor/hooks/useDocumentLoader.completions.test.tsx` | 10 | 227 |
| `src/features/editor/hooks/useDocumentLoader.editing.test.tsx` | 1 | 56 |
| `src/features/editor/hooks/useDocumentLoader.draft.test.tsx` | 10 | 157 |
| `src/features/editor/hooks/useDocumentLoader.draft-conflict.test.tsx` | 8 | 167 |
| `src/features/editor/hooks/useAutoSave.test.tsx` | 10 | 142 |
| `src/features/editor/hooks/useDraftSync.test.tsx` | 17 | 252 |
| `src/features/editor/hooks/useDocumentCacheSync.test.tsx` | 3 | 83 |
| `src/features/editor/hooks/useServerAutoSave.test.tsx` | 11 | 213 |
| `src/features/editor/hooks/useVersionSave.test.tsx` | 13 | 278 |
| `src/features/editor/hooks/useVersionSave.completions.test.tsx` | 4 | 132 |
| `src/features/editor/hooks/useDocumentPersistence.restore.test.tsx` | 18 | 398 |
| `src/features/editor/components/VersionHistoryDialog.test.tsx` | 14 | 213 |
| `src/features/editor/components/VersionHistoryDialog.editor.test.tsx` | 8 | 208 |
| `src/features/editor/components/VersionHistoryDialog.restore.test.tsx` | 12 | 206 |

CI, configuration and dependencies, all UPDATE (5): `.github/workflows/ci.yml`, `.env.example`, `vitest.config.ts` (63
lines), `package.json` and `package-lock.json`.

Documentation, all UPDATE (19): `README.md`; `docs/rules/project.md`, `docs/rules/testing.md` and
`docs/rules/code-size-register.md`; `docs/project/PromptHub_01_MVP_01.md`, `PromptHub_02_STORIES_01.md`,
`PromptHub_04_UI_01.md` and `PromptHub_05_TECH_01.md`; `.claude/AGENT-CONTRACT.md`,
`.claude/agents/qa-test-automation-engineer.md` and `.claude/agents/senior-frontend-engineer.md`, and the same three
paths under `.gemini/`; `.serena/memories/code_style_conventions.md`, `codebase_structure.md` and
`project_overview.md`; `PRPs/docs/P7S1-editor-persistence-contracts.md`; and `wip/P7S1-research-drift.md` (the closing
notes).

Files the main session removes with `git rm` right after this report is committed (13, all under `wip/`, all
reference implementations, probes or tooling for the PRP): `P7S1-autosave-timers-probe.test.tsx`,
`P7S1-dialog-spike.test.tsx`, `P7S1-dialog-spike.tsx`, `P7S1-draft-spike.test.tsx`, `P7S1-draft-spike.ts`,
`P7S1-loader-race-diagnostic.test.tsx`, `P7S1-loader-spike.test.tsx`, `P7S1-loader-spike.ts`,
`P7S1-mutation-check.py`, `P7S1-persistence-spike.test.tsx`, `P7S1-persistence-spike.ts`, `P7S1-test-fakes.ts` and
`P7S1-vitest.diag.config.ts`. `wip/P7S1-research-drift.md` stays: it is reconciled, not deleted.

## Notes

### Deviations from the PRP and the contract

The editor test environment is spread over `src/test/editor-env.ts` and `src/test/editor-session.ts`, with
`draft-world.ts`, `history-dialog.tsx` and `failing-db.ts` beside them, where the PRP and the contract planned one
file. The contract's module map was amended in `9f7caf4` to name them. Its line budgets were not. Against `wc -l`,
these files exceed their budget (the budget in brackets): `db.ts` 161 (150), `db.test.ts` 172 (150), `loader-world.ts`
257 (140), `loader-state.ts` 128 (110), `loader-protocol.ts` 229 (220), `useDocumentLoader.ts` 203 (160),
`useAutoSave.ts` 63 (60), `draft-world.ts` 172 (170), `document-actions.ts` 75 (40), `useVersionSave.ts` 162 (150),
`useServerAutoSave.ts` 92 (90), `useVersionRestore.ts` 135 (110), `useDocumentPersistence.ts` 104 (70),
`VersionHistoryDialog.tsx` 254 (230) and `use-latest.ts` 34 (20). Every one is GREEN (at most 300 lines) in the size
audit, so the overrun costs nothing in the gates; the map no longer predicts file sizes.

`markSynced` and `applyServerState` require the document to be applied (`monacoPromptIdRef`), not only open, so a
completion that lands while the open document re-fetches changes nothing; this came from the T5 review.
`useDocumentPersistence` needed `restoring` from `useVersionRestore` to feed the manual save's `blocked` and the
autosave's `busy`, so the restore hook is composed before the other two. The `.gemini/` agent mirrors received the
same edits as their `.claude/` originals (I compared the changed lines of the three pairs and they are identical).
The rejected-save toast "The version could not be saved" and the restore toasts `NEEDS_TITLE_TOAST`,
`FLUSH_FAILED_TOAST` and "The version could not be restored" are new text; "Version restored" existed in the dialog
and moved into the hook. After a switch or unmount a completed restore still sets its own document's tab title and
list title, and never the open document's tab. Decision D3 stands as built: `needsAutoSave` requires a non-blank
title, so an untitled document is not autosaved (see issue #91).

### Limitations and accepted behaviour

Two browser tabs or devices stay last-writer-wins. A draft left behind when the editor unmounts between a draft write
and the autosave that clears it removes itself on the next load, because by then the draft equals the server content.
The draft is written on every keystroke, by design: it is the safety net for a tab that closes or crashes. A false
draft conflict after a lost autosave response is offered, not lost, and so is an unsaved edit typed after one: on
reload it is a conflict, stashed under `prompt-v1-<id>:conflict` and offered once by the toast. The stash is not
re-offered after that toast, and nothing purges it until another conflict replaces it or the purge of #44 removes it.
Restoring a stashed text is a last-writer-wins write that autosave sends without recording a version.

A failed autosave is only logged and not retried (#89). A request that never settles is abandoned after 30 seconds,
but the request itself is not cancelled, and the navigation-orphan case that motivates the limit was established by
reading `action-queue.js`, not by running it. The legacy `prompt-<id>` draft is still read once, a bounded exception
to the rule against backwards compatibility (decision D2). Decision D2 plans a follow-up issue to remove that read;
it is filed as #93.

### Drift register and documents that were wrong

`wip/P7S1-research-drift.md` carries a closing note for every row. DR-1 to DR-16 and DR-18 to DR-22 are fixed, each
note naming the commit or file that fixed it. DR-17 (issues #37 and #45 say "auth stubbed at `createClient`") is GitHub
text, not a repository file: the register assigns the comments on #37 and #45 to the main session, which commented on
both as planned, and the edit of #45's acceptance to the developer, which I cannot confirm was made. Findings F-1,
F-2, F-7 and F-8 are fixed in code. F-3, F-4, F-5 and F-6 are filed as #89, #90, #91 and #92, and F-9 is #74.

Documents that turned out to be wrong, beyond the rows the register lists: the PRP and the contract planned a single
`editor-env.ts` and line budgets that fifteen files exceed (above), and the contract's module map still carries those
budgets. The INITIAL report says the reference implementations have 204 tests and 83 mutations, where the PRP and the
contract say 211 and 90 after later reviews. The INITIAL report is a historical record and I left it alone. The PRP
footer read `PRP Status: TODO` until the commit that adds this report, which set it to `REVIEW`, and it was set to
`COMPLETE` afterwards (see [Issues](#issues)).

After the main session deletes the 13 `wip/` files, seven documents still cite them: the PRP, the INITIAL report,
`PRPs/docs/P7S1-task-briefs.md`, `P7S1-task-briefs-client.md`, `P7S1-task-context.md`, the contract, and the drift
register itself (F-1 and F-8 cite the probe and the dialog spike). The INITIAL report is a record. The others describe
the specification the tasks were built from, and git history still holds the files they point at; the register's F-1
and F-8 evidence column would then name files that no longer exist. I changed none of them.

### Issues

State as given in the dispatching prompt; I did not read or change any issue. Epic #31 stays open until dev-review #38
passes. Tasks #75 to #83 (T1 to T9) are `status: in-review`, once the main session updates #83. Bugs #32 to #36, #72 and
#73 are fixed in code on this branch and stay open until merged and verified in #38. #37 is delivered by the harness and
the suites. #38 is open and blocked. #74 (finding F-9) is open and outside this epic. Follow-ups filed after the work:
#89 (a failed autosave is only logged), #90 (a rename from the list does not reach the open editor), #91 (spike:
should untitled documents autosave), #92 (a nullable folder breaks the cache and tab sync) and #93 (remove the
legacy draft read, decision D2). Comments were posted on
#37, #41, #44, #45 and #53 by the two sessions, as the PRP planned.

The PRP Status is `COMPLETE`, and the PRP is in `PRPs/complete/`, because the developer said so on 22/10/2026 (the
answer was "Footer values only"). `docs/rules/documentation-prp.md#field-formats` ties `COMPLETE` to a closed epic, and
epic #31 is still open: it closes after the browser checks in #38 pass, so the footer and the epic disagree until then.
The tasks and the epic remain `status: in-review` on the tracker; nothing was closed.

### Left for the main session

Remove the 13 `wip/` files (done after this report) and decide what to do with the citations above; set #83 to `status: in-review`; keep #31
and the bug issues open for #38; close #31 when #38 passes; open a pull request so that CI
runs the 29 database-backed tests on this tree; and run the board sync from a local login (GraphQL is blocked in cloud
sessions).

----
**Report Status**: FINAL
**PRP Status**: COMPLETE
**PRP ID**: P7S1
**GitHub Issues**: #31 (PRP epic); tasks #75-#83 (P7S1T1-P7S1T9), in review; bugs #32-#36, #72, #73 fixed in code, open until #38; #37 delivered; #74 open outside the epic; dev-review #38 open, blocked; follow-ups #89-#93
**PRP Document**: P7S1-editor-data-integrity
**Tasks**: 9 of 9 complete (P7S1T1 - P7S1T9)
**Phase**: Phase 7 - Hardening (Editor data integrity)
**Dependencies**: None
**Implementation Status**: COMPLETE (P7S1)
**Testing Status**: COMPLETE (358/358 tests passed with a database; 329 passed and 29 skipped without; no browser run)
**Next PRP**: P7S2 - Server-side security hardening
**Notes**:
- Code and tests complete; every browser flow is unverified and belongs to dev-review #38, which keeps epic #31 open
- PRP Status is COMPLETE and the PRP is archived at the developer's instruction (22/10/2026) although epic #31 stays open for #38
- Lint 15 warnings (baseline 18, none added); size audit PASS with the one registered RED file; build passes
- Per-file coverage at least 84.61% on every measure for all 19 files in scope; lines 100% for 18 of the 19
- Accepted: two tabs or devices stay last-writer-wins; a false draft conflict is offered, not lost
- Follow-ups #89-#93 filed; F-9 is #74; the 13 wip reference files were removed after this report (last commit holding them: 9f7caf4)
**Completed**: 22/10/2026 11:11 GMT+10
