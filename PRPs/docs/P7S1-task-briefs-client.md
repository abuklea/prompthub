# PromptHub
## P7S1 Client Task Briefs

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Client Task Briefs | 20/10/2026 13:27 GMT+10 | 20/10/2026 13:31 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Briefs](#briefs)

## Purpose

The briefs of the client tasks T4 to T8 of [the PRP](../P7S1-editor-data-integrity.md). References, trees, gotchas, the
database environment and the red-to-green map are in [P7S1-task-briefs.md](P7S1-task-briefs.md), and every interface,
protocol and rule is in [the contract](P7S1-editor-persistence-contracts.md); neither is repeated here. Each task has a
reference implementation in `wip/` with passing tests: read it, then adapt it as the contract's Purpose describes.

Rules for every client task. Check each cited path and line against the code before using it. Write the tests first and run
them to see them fail for the stated reason; a module that does not exist yet is created as a stub that compiles and throws
"not implemented", so a test fails on an assertion and not on a missing import. Finish with `npm test`, `npx tsc --noEmit`,
`npm run lint` (no warning added) and `bash scripts/audit-code-size.sh --summary` all passing, and with no feature disabled,
so each commit is a working state. Report the files changed with their line counts, the failing output of each red, the
gates, and what is unverified; browser behaviour is never run by an agent and belongs to dev-review #38. Split a test file
before it passes 450 lines, and share fakes through `src/test/`. EditorPane is edited only as the brief says.

## Briefs

### P7S1T4 Add the sync helpers, the draft store and the cache module

Agent `senior-frontend-engineer`, 3 hours, no predecessor; run it in a worktree, or after T3, because agents sharing a
checkout would see one another's intentionally failing tests. Node-environment tests only, so it does not need T1.
Reference: the `sync.ts` and `draft.ts` parts of `wip/P7S1-draft-spike.ts` and the document-cache part of
`wip/P7S1-loader-spike.ts`.

Step 1, red: CREATE `src/test/storage-fake.ts` (an in-memory `DraftStorage` that logs its writes and can be switched to
refuse them, and a storage whose every call throws), then `sync.test.ts`, `draft.test.ts` and `document-cache.test.ts` from
the pure-helper blocks of the spike tests, with each module created as a stub. Step 2: implement the three modules from the
spikes (`draft.ts` imports `zod`). No consumer is changed in this task.

Cases. `sameFields` treats a null and an empty title as equal. `needsAutoSave`: no baseline, equal fields, changed content,
changed title, a null title, a whitespace title, and a baseline for another document. `viewState` and `saveStatus`: every row
of their tables, including a failed load (error before loading) and the render where the document just changed (loading).
`hashContent`: deterministic, differs for one changed character and for a different length, no collision across 10,000
generated strings (built from the loop index, not from `Math.random`). `parseDraft` accepts only a v1 envelope: every other
value, including another version, an empty base and a non-string content, returns null. `readDraft`: the v1 envelope first,
then the legacy value with `legacy` true, an empty legacy value is no draft, an unreadable v1 value is ignored,
envelope-looking text under the legacy key is only text, and a null or throwing storage reads as no draft. `resolveDraft`:
every row of its table, with null, empty and whitespace titles. `writeDraft`, `removeIfUnchanged`, `clearDraft`,
`stashConflict` and `discardRead`, including a refused write and compare-and-delete leaving another value alone.
`getBrowserStorage` in node by stubbing `window` with `vi.stubGlobal`, with a throwing getter, and with no window. The cache:
the user check, tested with crafted ids (`a-b` and `c` build the same key as `a` and `b-c`), an update with a function patch,
an update of a missing entry does nothing, `clearDocumentCache` forgets the remembered id, and `resolveUserId` looks the id up
once and never remembers `ANONYMOUS`.

### P7S1T5 Rewrite the document loader protocol

Agent `senior-frontend-engineer`, 4 hours, after T1 and T4. Reference: `wip/P7S1-loader-spike.ts` and its tests, without the
code marked T6.

Step 1, behaviour-preserving: add the `io` parameter (`fetchPrompt`, `getUserId`) to the current loader and remove its
imports of `getPromptDetails` and the Supabase client. EditorPane defines a module-level `loaderIo`: `fetchPrompt` calls
`getPromptDetails({ promptId })`, and `getUserId` is `resolveUserId` over a lookup that wraps `createClient().auth.getUser()`
in a try and returns `ANONYMOUS` on no session or an error. Step 2, red: CREATE `src/hooks/use-latest.ts` with its test, then
the loader tests from the spike, split by `describe` block, and the scenarios of
`wip/P7S1-loader-race-diagnostic.test.tsx`. Against Step 1 they fail in two groups: the behaviours of the old API (a fresh
mount ends with the server's title and content, `loading` while the identity is pending, wipe then load) and the new API
(`ready`, `synced`, `markSynced`, `applyServerState`, the identity timeout, a rejected fetch), which is absent.

Step 3: implement the protocol. CREATE `loader-state.ts` (the reducer), `loader-protocol.ts` (`runLoad`, `fetchDocument`,
`commit`) and rewrite the hook (`useIdentity`, `ready`, `synced`, `markSynced`, `applyServerState`) from the spike. Adopt
`document-cache.ts` and delete the loader's own cache, `hydrateDocumentCache` and the no-op `clear()`. Remove
`isTransitioning`, `contentPromptIdRef`, `titlePromptIdRef`, the transition effect, `loadedRef` and `resetLoadedRef`, and set
`lastSaved` from `updated_at`. P5 keeps today's raw-draft branch unchanged (`useDocumentLoader.ts:218-228`), because
`useLocalStorage` is live until T6. Keep `setPromptData` and `setLastSaved` in the return value, because EditorPane calls them
until T6.

EditorPane gets what it needs to compile and behave. It renders from `viewState`; the Monaco guard is `loader.ready &&
monacoPromptIdRef.current === promptId`; the footer comes from `saveStatus`; its effects use `loader.ready` where they used the
removed flags; its cache writes pass `synced` (the cache effect passes `loader.synced`, `handleSave` passes `{ promptId,
title, content }`); `handleVersionRestored` loses its `resetLoadedRef()` call, which never re-ran the load effect; the
re-export line and its false comment are deleted (DR-1, DR-2, DR-3); and `Header.tsx:23` imports `clearDocumentCache` from
`document-cache`. No function in the loader modules exceeds 80 lines.

Cases: the spike's loader tests, which cover every path P0 to P7, a cache hit on a fresh mount, A then uncached B then cached
A, a rapid A B C, atomic readiness checked on every render, Strict Mode with one fetch, a new `io` object during the fetch,
`markSynced` and `applyServerState` for the open document, for another document and after unmount, the identity timeout and
rejection, a rejected fetch, the first render already loading, and an emptied `promptId`; plus one case for the kept raw-draft
branch: a differing raw value is applied with the toast and an equal one is not.

### P7S1T6 Replace the draft hook and add the autosave baseline

Agent `senior-frontend-engineer`, 4 hours, after T5. Reference: `useDraftSync` and the loader's draft calls in
`wip/P7S1-draft-spike.ts` and `wip/P7S1-loader-spike.ts`, and `useAutoSave` in `wip/P7S1-persistence-spike.ts`.

Step 1, red. (a) The loader draft cases against T5's loader, set up by writing the keys into a fake storage and opening the
document: S-2, S-4, S-5, S-6, S-7a to S-7d, S-8, S-8b, S-8c, S-9, S-10b, S-14 and S-14b. (b) The `useAutoSave` cases against
the current hook: no write on mount; one write for a burst; none for an edit reverted to the baseline; none for a blank or null
title, without a baseline, or for another document's baseline; a baseline change cancels a pending write; a new `onSave`
identity does not reset the timer. (c) The `useDraftSync` cases against a compiling stub: S-1, S-3, S-11, S-11b, S-12, S-13,
ownership across a switch, a refused write, and no key of another document written in the render where the document just
changed.

Step 2, green. Add `getStorage` to `DocumentLoaderIo` (EditorPane supplies `getBrowserStorage`) and `restoreDraft` and
`warnConflict` to `loader-protocol.ts`, replacing T5's raw branch. `useAutoSave` takes `promptId`, `baseline` and a ref'd
`onSave`. CREATE `useDraftSync.ts`. In EditorPane remove `useLocalStorage` and call `useDraftSync`; pass `baseline:
loader.synced` and `promptId: loader.ready ? promptId : null` to `useAutoSave`; make `handleAutoSave` call
`loader.markSynced({ promptId: pid, title, content })` on success in place of `setLastSaved`; make `handleSave` call
`loader.markSynced({ promptId, title, content }, { version: true })` on success in place of `clearLocalContent()`,
`setPromptData`, `setLastSaved` and its cache write, so the baseline advances after a manual save too. DELETE
`useLocalStorage.ts` and its barrel lines, and remove `setPromptData` and `setLastSaved` from the loader's return value and
reducer, which have no caller left. Documentation sync after this task (main session): DR-5 and DR-16.

### P7S1T7 Extract the persistence hooks and fix the set-title save

Agent `senior-frontend-engineer`, 4 hours, after T2, T5 and T6. Reference: `wip/P7S1-persistence-spike.ts`, all but
`useVersionRestore`. T2 is a dependency only so the fake actions match the service's results; the hooks import no server code.

Step 1, behaviour-preserving extraction. Move the cache and tab effect to `useDocumentCacheSync`, the manual save with the
title dialog state and the Ctrl+S listener to `useVersionSave`, and the autosave handler with the `useAutoSave` call to
`useServerAutoSave`, composed by `useDocumentPersistence` together with the `useDraftSync` call; actions and storage are
injected, EditorPane builds `loaderIo` and `documentActions` as module-level constants and composes the loader with this hook.
Move the code as it is, including the stale-closure `handleSetTitle` and the handlers without `finally`.
`useDocumentPersistence` returns no `restoring` and no `handleRestore` yet; `useVersionSave` gets `blocked: false` and
`useServerAutoSave` gets `busy: version.saving`. The old `handleVersionRestored` stays until T8. Take store functions with
selectors, not the whole store.

Step 2: CREATE the persistence tests with a harness that renders the loader and the hook together over a fake server
(the spike's `makeEnv`, moved to `src/test/editor-world.ts`). Red against the extraction: one title confirmation saves once
with the confirmed title and the working title becomes it (#36); a rejected save resets `saving`; a rejected autosave resets
`autoSaving`; a second Ctrl+S while one runs is ignored; edits typed during a save are not autosaved until it completes; a
save that completes after a switch patches only its own cache entry and does not force the other tab's dirty flag; a loader
that is not ready saves nothing. Regression tests, green on arrival: no write on open (#35); S-1 through the real handlers; the
tab and cache metadata (title, folder, dirty flag, promotion of a preview tab, and the cache holds the working copy so a
remount resumes the autosave); an autosave that completes after a switch; a title typed before the document is ready writes
nothing; Strict Mode.

Step 3: apply the spike's `useVersionSave`, `useServerAutoSave` and `useDocumentCacheSync` (`saveVersion(titleToSave)` shared by
Ctrl+S, the button and the dialog; `finally` blocks; same-document gating through the `markSynced` result; `busy` pausing).
Split the test file by `describe` block under 450 lines, and keep every hook function under 80 lines by hoisting pure
helpers out of `useVersionSave`.

### P7S1T8 Restore into the editor and remove the superseded code

Agent `senior-frontend-engineer`, 3 hours, after T3 and T7. Reference: `useVersionRestore` and the restore tests of
`wip/P7S1-persistence-spike.ts` and `.test.tsx`.

Step 1, behaviour-preserving. CREATE `useVersionRestore.ts` whose `handleRestore` calls `actions.restorePromptVersion`, shows
the success toast and calls `triggerPromptRefetch()` on success and returns true, or shows the error toast and returns false.
Change `VersionHistoryDialog` to take `onRestore(versionId): Promise<boolean>`: it keeps the history fetch and the button
state and calls `onOpenChange(false)` on `true`. Remove EditorPane's `handleVersionRestored` and compose the hook in
`useDocumentPersistence`, with `restoring` feeding `blocked` and `busy`. The editor still shows the old text after a restore, as
it does today.

Step 2, red: CREATE `useDocumentPersistence.restore.test.tsx`. After `handleRestore` the loader shows the restored title and
content, `synced` equals them, `promptData` follows, the draft is gone, the cache entry is replaced, the tab and list titles
follow, and a following edit autosaves on top of the restored content. Autosave is paused for the duration, and nothing
queued behind the restore can overwrite it, Ctrl+S included. Unsaved edits of a titled document are saved first through
`autoSavePrompt` (the requests are an autosave and then the restore, and the fake server's history contains the edits), and a
failed save aborts the restore and keeps them. A restore that completes after a switch to another document leaves that
document alone and replaces the restored document's cache entry; the same after the editor unmounted. A failed or rejected
restore keeps the working copy, resets `restoring` and resumes autosave; a loader that is not ready restores nothing; an
unknown version fails without changing the editor.

Step 3, green: the spike's `useVersionRestore` (`flushUnsaved`, captured ids, `finally`, `applyServerState`), and the dialog
ignores every request to close while a restore runs (a component, so verified by dev-review #38). Acceptance: a search finds no
remaining `useLocalStorage`, `hydrateDocumentCache`, `isTransitioning`, `contentPromptIdRef`, `titlePromptIdRef` or
`resetLoadedRef`, and EditorPane is shorter than 329 lines.
