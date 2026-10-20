# PromptHub
## P7S1 Client Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Client Task Briefs | 20/10/2026 13:27 GMT+10 | 20/10/2026 15:45 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Draft Scenarios](#draft-scenarios)
- [Briefs](#briefs)
  - [P7S1T4 Add the sync helpers, the draft store, the cache module and the request timeout](#p7s1t4-add-the-sync-helpers-the-draft-store-the-cache-module-and-the-request-timeout)
  - [P7S1T5 Rewrite the document loader protocol](#p7s1t5-rewrite-the-document-loader-protocol)
  - [P7S1T6 Replace the draft hook and add the autosave baseline](#p7s1t6-replace-the-draft-hook-and-add-the-autosave-baseline)
  - [P7S1T7 Extract the persistence hooks and fix the set-title save](#p7s1t7-extract-the-persistence-hooks-and-fix-the-set-title-save)
  - [P7S1T8 Restore into the editor, fix the history dialog and remove the superseded code](#p7s1t8-restore-into-the-editor-fix-the-history-dialog-and-remove-the-superseded-code)

## Purpose

The briefs of the client tasks T4 to T8 of [the PRP](../P7S1-editor-data-integrity.md). References, trees, gotchas and
the database environment are in [the task context](P7S1-task-context.md), the red-to-green map is in
[P7S1-task-briefs.md](P7S1-task-briefs.md#red-to-green-map), and every interface, protocol and rule is in
[the contract](P7S1-editor-persistence-contracts.md); none is repeated here. Each task has a
reference implementation in `wip/` with passing, type-clean tests: read it, then adapt it as the contract's Purpose
describes.

Rules for every client task. Check each cited path and line against the code before using it. Write the tests first and
run them to see them fail for the stated reason; a module that does not exist yet is created as a stub that compiles and
throws "not implemented", so a test fails on an assertion and not on a missing import. Finish with all six
[validation gates](../../.claude/AGENT-CONTRACT.md#validation-gates) passing (`npx prisma validate`, `npm run lint` with
no warning added, `npx tsc --noEmit`, `npm test`, `bash scripts/audit-code-size.sh --summary`, `npm run build`) and with
no feature disabled, so each commit is a working state. Report the files changed with their line counts, the failing
output of each red, the gates, and what is unverified; browser behaviour is never run by an agent and belongs to
dev-review #38. Split a test file before it passes 450 lines, and share fakes through `src/test/`. EditorPane is edited
only as the brief says. A test asserts what the system under test sent and shows, never what a fake server stored: the
request order and inputs, not the fake's history. Every server action and the document fetch is awaited under
`withTimeout`, and every busy flag resets in a `finally`.

The spikes are looser than the project rules in places. Rewrap their lines at 120 columns (ESLint `max-len` is 160 and
an error), give every exported function and interface complete TSDoc (the line budgets of the module map include it),
and prefer `async` and `await` to `.then` chains. A comment adapted from a spike never names `useLocalStorage`,
`resetLoadedRef`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef` or `titlePromptIdRef`, because the
final search of `src/` would find it. An agent never commits; it deletes a file only when its brief says so (T6 removes
`useLocalStorage.ts` with `rm`), and the main session removes the wip files with `git rm`. T5, T7 and T8 are dispatched
in two halves by default: Step 1 (behaviour-preserving and green, which the main session commits), then Steps 2 and 3.

## Draft Scenarios

The behaviour of the draft protocol in [the contract](P7S1-editor-persistence-contracts.md#draft-protocol), one row per
scenario. Each has a test in the draft spike suite, named by its id, and T6 reproduces them.

| Scenario | Expected |
|---|---|
| S-1 type in a titled document, autosave succeeds | draft gone from storage (`getItem` is null) |
| S-2 type, autosave fails, reload | draft applied with the toast; autosave then writes it |
| S-3 clear to empty, autosave succeeds, reload | empty document, no toast, no draft |
| S-4 clear to empty, autosave fails, reload | the empty content is applied (empty is a valid draft) |
| S-5 untitled document, type, reload | content restored; nothing was autosaved |
| S-6 untitled document, type, rename from the list, reload | content restored, title from the server |
| S-7a legacy raw draft, document never saved | applied, rewritten as v1, legacy value removed |
| S-7b legacy raw draft differs, document saved | not applied, warning toast, text stashed, legacy value removed |
| S-7c legacy raw draft equals the server | removed, no toast |
| S-7d both keys exist | the v1 envelope wins |
| S-7e legacy raw draft, document never saved, the v1 write is refused | applied in memory; the legacy value stays for the next load |
| S-8 v1 draft whose base differs from the server's hash | server wins, warning toast with the action, text stashed under the conflict key, draft removed |
| S-8b the action is used | the stashed text is in the editor and a v1 draft is written against the server content |
| S-8c the action is used after another document opened | nothing changes |
| S-8d the document is left, or the editor unmounts, while the toast is shown | the toast is dismissed |
| S-8e a conflict whose stash the storage refuses | the draft stays where it is; the toast still offers the text |
| S-9 draft equals the server content | no toast, draft removed |
| S-10 autosave committed but its response was lost, reload | no toast (contents equal), draft removed |
| S-10b the same, or a save completed after the editor unmounted, with more typing after it | conflict: the extra text is stashed and offered (accepted limitation) |
| S-11 two tabs, tab 1's autosave succeeds while tab 2 holds a newer draft | tab 2's draft stays |
| S-11b a tab opens a document from its cache while another tab holds a draft for it | that draft stays |
| S-12 restore | draft removed; working copy and `synced` equal the restored row |
| S-13 storage throws on read, write or remove, or is null | the editor works without drafts |
| S-14 a value under the v1 key that is not a v1 envelope | left in place, never applied |
| S-14b envelope-looking text under the legacy key | it is only text |

## Briefs

### P7S1T4 Add the sync helpers, the draft store, the cache module and the request timeout

Agent `senior-frontend-engineer`, 3 hours, no predecessor; run it in a worktree, or after T3, because agents sharing a
checkout would see one another's intentionally failing tests. Node-environment tests only, so it does not need T1.
Reference: the `sync.ts`, `request-timeout.ts` and `draft.ts` parts of `wip/P7S1-draft-spike.ts`, the document-cache
part of `wip/P7S1-loader-spike.ts`, and the storage fakes of `wip/P7S1-test-fakes.ts`.

Step 1, red: CREATE `src/test/storage-fake.ts` (`FakeStorage`, `makeStorage` and `makeBrokenStorage` of the fakes
module: an in-memory `DraftStorage` that logs its writes and can be switched to refuse them, and a storage whose every
call throws), then `sync.test.ts`, `request-timeout.test.ts`, `draft.test.ts` and `document-cache.test.ts` from the
pure-helper blocks of the spike tests, with each module created as a stub. Step 2: implement the four modules from the
spikes (`draft.ts` imports `zod`). No consumer is changed in this task.

Cases. `sameFields` treats a null and an empty title as equal. `needsAutoSave`: no baseline, equal fields, changed
content, changed title, a null title, a whitespace title, and a baseline for another document. `viewState` and
`saveStatus`: every row of their tables, including a failed load (error before loading) and the render where the
document just changed (loading). `withTimeout`, with fake timers: the value passes through before the limit, a rejection
passes through, it rejects with `REQUEST_TIMED_OUT` at the limit, and no timer is left pending after it settles either
way. `hashContent`: deterministic, differs for one changed character and for a different length, no collision across
10,000 generated strings (built from the loop index, not from `Math.random`). `parseDraft` accepts only a v1 envelope:
every other value, including another version, an empty base and a non-string content, returns null. `readDraft`: the v1
envelope first, then the legacy value with `legacy` true, an empty legacy value is no draft, an unreadable v1 value is
ignored, envelope-looking text under the legacy key is only text, and a null or throwing storage reads as no draft.
`resolveDraft`: every row of its table, with null, empty and whitespace titles. `writeDraft`, `removeIfUnchanged`,
`clearDraft`, `stashConflict` (it returns whether it stored the text) and `discardRead`, including a refused write and
compare-and-delete leaving another value alone. `getBrowserStorage` in node by stubbing `window` with `vi.stubGlobal`,
with a throwing getter, and with no window. The cache: the user check, tested with crafted ids (`a-b` and `c` build the
same key as `a` and `b-c`), an update with a function patch, an update of a missing entry does nothing, the anonymous
identity gets no entry (`setDocumentCacheEntry` ignores it), and `clearDocumentCache` empties the cache. No user id is
remembered anywhere.

### P7S1T5 Rewrite the document loader protocol

Agent `senior-frontend-engineer`, 4 hours, after T1 and T4. Reference: `wip/P7S1-loader-spike.ts` and its tests, without
the code marked T6, `useLatest` from the same file, and the loader part of `wip/P7S1-test-fakes.ts`.

Step 1, behaviour-preserving: add the `io` parameter (`fetchPrompt`, `getUserId`, `getStorage`) to the current loader
and remove its imports of `getPromptDetails` and the Supabase client; the kept raw-draft branch reads `io.getStorage()`
in place of `localStorage`. EditorPane defines a module-level `loaderIo`: `fetchPrompt` is
`(promptId) => withTimeout(getPromptDetails({ promptId }))`, `getUserId` wraps `createClient().auth.getUser()` in a try
and returns `ANONYMOUS` on no session or an error (it is looked up on every mount and never remembered), and
`getStorage` is `getBrowserStorage`. Step 2, red: CREATE `src/hooks/use-latest.ts` with its test,
`src/test/loader-world.ts` (the shared ids, `promptRow`, `serverRow`, `makeWorld`, `defer`, `makeDeferredIo`), then the
loader tests from the spike, split by `describe` block, and the probe's scenarios A (identity first) and D (Strict Mode)
written against the `io` seam; scenario B (fetch before identity) becomes "no fetch starts until the identity is known",
and the probe's module mocks are not carried over, because the testing rules forbid mocking a module of this repository.
Against Step 1 they fail in two groups: the behaviours of the old API (a fresh mount ends with the server's title and
content, `loading` while the identity is pending, wipe then load) and the new API (`ready`, `synced`, `markSynced`,
`applyServerState`, the identity timeout, a rejected fetch), which is absent.

Step 3: implement the protocol. CREATE `loader-state.ts` (the reducer), `loader-protocol.ts` (`runLoad`,
`fetchDocument`, `commit`) and rewrite the hook (`useIdentity`, `ready`, `synced`, `markSynced`, `applyServerState`)
from the spike. Adopt `document-cache.ts` and delete the loader's own cache, `hydrateDocumentCache` and the no-op
`clear()`. Remove `isTransitioning`, `contentPromptIdRef`, `titlePromptIdRef`, the transition effect, `loadedRef` and
`resetLoadedRef`, and set `lastSaved` from `updated_at`. `DocumentLoaderIo` lives in `loader-protocol.ts` and the hook
re-exports the type, so the protocol never imports the hook; each constant lives with the module that uses it, as the
module map lists. `promptIdRef` is null after unmount (contract, Loader Protocol). P5 keeps today's raw-draft branch
(`useDocumentLoader.ts:218-228`), because `useLocalStorage` is live until T6. In `Editor.tsx`, `handleMount` reads
`value` through `useLatest` (contract, Editor View); no jsdom test can cover it, so it is a dev-review #38 flow.

EditorPane gets what it needs to compile and behave. It renders from `viewState`; the Monaco guard is
`loader.ready && monacoPromptIdRef.current === promptId`; the footer comes from `saveStatus`; its effects use
`loader.ready` where they used the removed flags; the cache effect passes `loader.synced`, and `handleSave` writes no
cache entry of its own, because `markSynced` updates it. `handleAutoSave` calls
`loader.markSynced({ promptId: pid, title, content })` where it called `setLastSaved`, and `handleSave` calls
`loader.markSynced({ promptId, title, content }, { version: true })` where it called `setPromptData`, `setLastSaved` and
wrote the cache entry; without these the footer would read "Unsaved changes" after every save, because the baseline
would never advance. `handleSave` keeps `clearLocalContent()`, whose hook lives until T6. `setPromptData` and
`setLastSaved` leave the loader's return value and reducer, since nothing calls them any more. `handleVersionRestored`
loses its `resetLoadedRef()` call, which never re-ran the load effect; the re-export line and its false comment are
deleted (DR-1, DR-2, DR-3); and `Header.tsx:23` imports `clearDocumentCache` from `document-cache`. No function in the
loader modules exceeds 80 lines. Documentation sync after this task (main session): DR-19 and the cache half of DR-16.

Cases: the spike's loader tests, which cover every path P0 to P7, a cache hit on a fresh mount, A then uncached B then
cached A, a rapid A B C, atomic readiness checked on every render, Strict Mode with one fetch, a new `io` object during
the fetch, `markSynced` and `applyServerState` for the open document, for another document and after unmount, the
identity timeout and rejection, a rejected fetch (a `withTimeout` rejection takes the same path), the first render
already loading, and an emptied `promptId`; plus one case for the kept raw-draft branch: a differing raw value is
applied with the toast and an equal one is not.

### P7S1T6 Replace the draft hook and add the autosave baseline

Agent `senior-frontend-engineer`, 4 hours, after T5. Reference: `useDraftSync` and the loader's draft calls in
`wip/P7S1-draft-spike.ts` and `wip/P7S1-loader-spike.ts`, and `useAutoSave` in `wip/P7S1-persistence-spike.ts`.

Step 1, red. (a) The loader draft cases against T5's loader, set up by writing the keys into a fake storage and opening
the document: S-2, S-4, S-5, S-6, S-7a to S-7e, S-8, S-8b to S-8e, S-9, S-10b, S-14 and S-14b. (b) The `useAutoSave`
cases against the current hook: no write on mount; one write for a burst; none for an edit reverted to the baseline;
none for a blank or null title, without a baseline, or for another document's baseline; a baseline change cancels a
pending write; a new `onSave` identity does not reset the timer. (c) The `useDraftSync` cases against a compiling stub:
S-1, S-3, S-11, S-11b, S-12, S-13, ownership across a switch, a refused write, and no key of another document written in
the render where the document just changed.

Step 2, green. `getStorage` is already in `DocumentLoaderIo` (T5); add `restoreDraft`, `secure` and `warnConflict` to
`loader-protocol.ts`, replacing T5's raw branch, with the conflict toasts dismissed when the effect cleans up. A stored
value is removed only after its text is safe elsewhere (`secure`), so a refused write leaves it for the next load.
`useAutoSave` takes `promptId`, `baseline` and a ref'd `onSave`. CREATE `useDraftSync.ts`. In EditorPane remove
`useLocalStorage` and call `useDraftSync`; pass `baseline: loader.synced` and `promptId: loader.ready ? promptId : null`
to `useAutoSave`; `handleSave` drops `clearLocalContent()` (the `markSynced` calls it needs were added in T5). DELETE
`useLocalStorage.ts` and its barrel lines. Documentation sync after this task (main session): DR-5 and the rest of
DR-16.

### P7S1T7 Extract the persistence hooks and fix the set-title save

Agent `senior-frontend-engineer`, 4 hours, after T2, T3, T5 and T6. Reference: `wip/P7S1-persistence-spike.ts`, all but
`useVersionRestore`, and the server part of `wip/P7S1-test-fakes.ts`. T2 and T3 are dependencies because EditorPane's
`documentActions` must type-check against the real actions: T2 fixes the save result and T3 changes
`restorePromptVersion` to return `{ title, content }`. The hooks themselves import no server code.

Step 1, behaviour-preserving extraction. Move the cache and tab effect to `useDocumentCacheSync`, the manual save with
the title dialog state and the Ctrl+S listener to `useVersionSave`, and the autosave handler with the `useAutoSave` call
to `useServerAutoSave`, composed by `useDocumentPersistence` together with the `useDraftSync` call. CREATE
`src/features/editor/document-actions.ts` with the `DocumentActions` interface; EditorPane builds `loaderIo` and
`documentActions` (the real `saveNewVersion`, `autoSavePrompt`, `restorePromptVersion` and `getPromptVersionHistory`) as
module-level constants, injects them, and composes the loader with this hook. Move the code as it is, including the
stale-closure `handleSetTitle` and the handlers without `finally`, with no `busy` and no `blocked` parameter: the
current code pauses nothing during a save, so a behaviour-preserving extraction passes none, and Step 3 adds them. The
actions are not yet under a timeout. `useDocumentPersistence` returns no `restoring` and no `handleRestore` yet, and the
old `handleVersionRestored` stays until T8. Take store functions with selectors, not the whole store.

Step 2: CREATE `src/test/editor-env.ts` (the spike's `makeEnv` with its holds, one-shot failures and request log, and
the render helpers the persistence suites share: `open`, `goTo`, `type`, `settle`, `tick`, `pressCtrlS`, `useSession`)
and the persistence tests, with a harness that renders the loader and the hook together over the fake server. Red
against the extraction: one title confirmation saves once with the confirmed title and the working title becomes it
(#36); a rejected save resets `saving`; a rejected autosave resets `autoSaving`; a request that never settles is
abandoned at the limit, its flag resets and the next edit is saved; a second Ctrl+S while one runs is ignored; edits
typed during a save are not autosaved until it completes; a save that completes after a switch patches only its own
cache entry and does not force the other tab's dirty flag; a save that completes after the editor unmounted leaves its
tab's dirty flag alone; a `handleSave` left over from the previous document sends nothing; a loader that is not ready
saves nothing. Regression tests, green on arrival: no write on open (#35); S-1 through the real handlers; the tab and
cache metadata (title, folder, dirty flag, promotion of a preview tab, and the cache holds the working copy so a remount
resumes the autosave); an autosave that completes after a switch; a title typed before the document is ready writes
nothing; Strict Mode.

Step 3: apply the spike's `useVersionSave`, `useServerAutoSave` and `useDocumentCacheSync` (`saveVersion(titleToSave)`
shared by Ctrl+S, the button and the dialog; `finally` blocks; same-document gating through the `markSynced` result;
`busy` pausing and `blocked`), and add `withActionTimeout` to `document-actions.ts`: EditorPane's `documentActions`
becomes `withActionTimeout({ ... })`. Split the test file by `describe` block under 450 lines, and keep every hook
function under 80 lines by hoisting pure helpers out of `useVersionSave`.

### P7S1T8 Restore into the editor, fix the history dialog and remove the superseded code

Agent `senior-frontend-engineer`, 4 hours, after T3 and T7. Reference: `useVersionRestore` and the restore tests of
`wip/P7S1-persistence-spike.ts` and `.test.tsx`, and `wip/P7S1-dialog-spike.tsx` with its test.

Step 1, behaviour-preserving. CREATE `useVersionRestore.ts` whose `handleRestore` calls `actions.restorePromptVersion`,
shows the success toast and calls `triggerPromptRefetch()` on success and returns true, or shows the error toast and
returns false. Change `VersionHistoryDialog` to take `loadHistory(promptId)` and
`onRestore(versionId): Promise<boolean>`: it keeps reading the history inside `onOpenChange` and the clicked-row button
state, and calls `onOpenChange(false)` on `true`. EditorPane passes `documentActions.getPromptVersionHistory` and the
hook's `handleRestore`; remove its `handleVersionRestored` and compose the hook in `useDocumentPersistence`, with
`restoring` feeding `blocked` and `busy`. The editor still shows the old text after a restore, as it does today.

Step 2, red. (a) CREATE `useDocumentPersistence.restore.test.tsx`. After `handleRestore` the loader shows the restored
title and content, `synced` equals them, `promptData` follows, the draft is gone, the cache entry is replaced, the tab
and list titles follow, and a following edit autosaves on top of the restored content. Autosave is paused for the
duration, and nothing queued behind the restore can overwrite it, Ctrl+S included. Unsaved edits of a titled document
are saved first through `autoSavePrompt` (the requests are an autosave and then the restore), and a failed save aborts
the restore and keeps them; with a blank title and unsaved edits the restore is refused with the toast and sends
nothing. A restore that completes after a switch to another document leaves that document alone and replaces the
restored document's cache entry; the same after the editor unmounted. A failed or rejected restore keeps the working
copy, resets `restoring` and resumes autosave; a loader that is not ready restores nothing; a `handleRestore` left over
from the previous document restores and flushes nothing; an unknown version fails without changing the editor. (b)
CREATE `VersionHistoryDialog.test.tsx` from `wip/P7S1-dialog-spike.test.tsx` (it renders the real dialog and Button with
Testing Library; `// @vitest-environment jsdom` on the first line, and JSX works after T1). Against Step 1 the list does
not load when the parent sets `open` (the control case with a bare Radix dialog shows why), a late result is not
dropped, a failed read is not reported, the other Restore buttons stay enabled during a restore, and Escape or a click
on the overlay closes the dialog.

Step 3, green: the spike's `useVersionRestore` (`flushUnsaved` with the blank-title refusal, captured ids, `finally`,
`applyServerState`) and the spike's dialog (`useHistory` in an effect on `open` and `promptId` through `useLatest`,
`HistoryRow`, the close guard, `disabled` on every row while a restore runs); the Save button is disabled while
`restoring`. Acceptance: a search of `src/`, outside the changelog lines of file headers, finds no import, use or
comment naming `useLocalStorage`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef`, `titlePromptIdRef` or
`resetLoadedRef`, and EditorPane is shorter than 329 lines.
The dialog is not exempt from coverage: its suite reaches 80%.
