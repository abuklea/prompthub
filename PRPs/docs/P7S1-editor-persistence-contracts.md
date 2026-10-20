# PromptHub
## P7S1 Editor Persistence Contracts

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Editor Persistence Contracts | 20/10/2026 12:36 GMT+10 | 20/10/2026 14:54 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Module Map](#module-map)
- [Types and Interfaces](#types-and-interfaces)
- [Loader Protocol](#loader-protocol)
- [Draft Protocol](#draft-protocol)
- [Async Completions and Failures](#async-completions-and-failures)
- [Editor View](#editor-view)
- [Write Ordering and Pausing](#write-ordering-and-pausing)
- [Budgets and Coverage Scope](#budgets-and-coverage-scope)

## Purpose

This is the shared contract for [the PRP](../P7S1-editor-data-integrity.md). Nine tasks are dispatched to separate
agents that cannot see one another's work, so every interface, state transition and rule they must agree on is written
here once. The task briefs are in [P7S1-task-briefs.md](P7S1-task-briefs.md) and
[P7S1-task-briefs-client.md](P7S1-task-briefs-client.md). Where this document and the code disagree about what exists
today, the code is right; where they disagree about what to build, this document is right. The server half (the action
shells and the two transactions) is the [Server Contract](P7S1-task-briefs.md#server-contract) of the shared briefs.

The client half is specified by four working reference implementations with 195 passing tests, over shared typed fakes.
`wip/P7S1-mutation-check.py` applies 77 deliberate defects to them, one at a time, and every one is killed by at least
one test (about 5 minutes; `--list` names the mutations). The commands are in
[Level 2](../P7S1-editor-data-integrity.md#level-2-unit-and-postgres-backed-tests) of the PRP's validation loop.

| Spike | Tests | Proves |
|---|---|---|
| `wip/P7S1-draft-spike.ts` | 90 | `sync.ts`, `request-timeout.ts`, `draft.ts`, `useDraftSync` |
| `wip/P7S1-loader-spike.ts` | 24 | `document-cache.ts`, the reducer, `runLoad`, `useDocumentLoader` |
| `wip/P7S1-persistence-spike.ts` | 56 | the six hooks from `useAutoSave` to `useDocumentPersistence`, and `withActionTimeout` |
| `wip/P7S1-dialog-spike.tsx` | 25 | `VersionHistoryDialog`, alone and beside the real hooks |
| `wip/P7S1-test-fakes.ts` | | the typed fakes the four suites share |

Adapt a spike, do not rewrite it from this text. Split its code into the modules of the Module Map, replace its
`./P7S1-*-spike` imports with the real modules and its fake seams with the ones the brief names, and keep the behaviour.
The spike tests become the production tests: split them by `describe` block into files of at most 450 lines and move the
fakes of `wip/P7S1-test-fakes.ts` into `src/test/` (storage in T4, the loader world in T5, the editor environment in
T7). They are type-clean with the test packages installed; the `// @ts-nocheck` line exists only because CI installs
without them until T1, so remove it. A spike test that fails after the adaptation is a regression in the adaptation,
never a reason to edit the test.

## Module Map

Line budgets keep every file GREEN (300 lines) and every function under the 80-line lint limit
([Architecture Constraints](../../docs/rules/project.md#architecture-constraints)). A test file stays under 450 lines:
about 500 dense lines reach the 8,000-token band, and the audit fails an unregistered RED test file
(`scripts/audit-code-size.sh`). A path that does not start with `src/` (`hooks/`, `components/`, `document-actions.ts`)
is under `src/features/editor/`.

| File | Task | Responsibility | Lines |
|---|---|---|---|
| `src/test/db.ts`, `db.test.ts` | T1 | test-database helpers; guard unit tests and a smoke test | 150 each |
| `src/features/editor/service.ts` | T2, T3 | server logic taking `(db, userId, input)`; no `"use server"` | 250 |
| `src/features/editor/sync.ts` | T4 | `DocFields`, `SyncedState`, `sameFields`, `needsAutoSave`, `viewState`, `saveStatus` | 80 |
| `src/features/editor/request-timeout.ts` | T4 | `withTimeout`, `REQUEST_TIMEOUT_MS`, `REQUEST_TIMED_OUT` | 40 |
| `src/features/editor/draft.ts` | T4 | keys, hash, storage seam, read, write, remove, stash, discard, `resolveDraft` | 220 |
| `src/features/editor/document-cache.ts` | T4 | the module cache, `getCachedDocument`, `ANONYMOUS` | 100 |
| `src/test/storage-fake.ts` | T4 | `FakeStorage`, `makeStorage`, `makeBrokenStorage` | 60 |
| `src/hooks/use-latest.ts` | T5 | `useLatest`: the latest value in a ref, written in a passive effect | 20 |
| `src/test/loader-world.ts` | T5 | the shared ids, `promptRow`, `serverRow`, `makeWorld`, `defer`, `makeDeferredIo` | 140 |
| `src/features/editor/loader-state.ts` | T5 | loader state, actions and the reducer | 110 |
| `src/features/editor/loader-protocol.ts` | T5, T6 | `runLoad` (paths P0 to P7), `fetchDocument`, `commit`; T6 adds `restoreDraft`, `warnConflict` | 200 |
| `hooks/useDocumentLoader.ts` | T5 | the hook, `useIdentity`, `DocumentLoader`, `DocumentLoaderIo` | 180 |
| `hooks/useAutoSave.ts` | T6 | debounce with a baseline | 60 |
| `hooks/useDraftSync.ts` | T6 | the only draft writer | 90 |
| `document-actions.ts` | T7 | `DocumentActions` and `withActionTimeout` | 40 |
| `src/test/editor-env.ts` | T7 | `makeEnv`: the fake server with holds, one-shot failures and a request log | 180 |
| `hooks/useDocumentCacheSync.ts` | T7 | cache entry and tab metadata | 60 |
| `hooks/useVersionSave.ts` | T7 | manual save, title dialog state, Ctrl+S | 150 |
| `hooks/useServerAutoSave.ts` | T7 | the autosave handler | 90 |
| `hooks/useVersionRestore.ts` | T8 | restore, with the flush of unsaved edits | 110 |
| `hooks/useDocumentPersistence.ts` | T7, T8 | composition of the hooks above | 70 |
| `components/EditorPane.tsx` | T5 to T8 | composition and JSX; ends shorter than 329 lines | under 329 |
| `components/VersionHistoryDialog.tsx` | T8 | reads its list in an effect; takes `loadHistory` and `onRestore`; single-flight | 180 |

## Types and Interfaces

```typescript
// src/features/editor/sync.ts (pure, client-safe)
export interface DocFields { title: string | null; content: string }
export interface SyncedState extends DocFields { promptId: string }   // what the server holds for one document
export function sameFields(a: DocFields, b: DocFields): boolean   // (a.title ?? "") === (b.title ?? "") && same content
export function needsAutoSave(promptId: string, working: DocFields, synced: SyncedState | null): boolean
// = synced !== null && synced.promptId === promptId && Boolean(working.title?.trim()) && !sameFields(working, synced)
// GOTCHA: null?.trim() is undefined and undefined !== "" is true: test with Boolean(...), never with !== "".
export type ViewState = "empty" | "error" | "loading" | "editor"
export function viewState(s: { promptId: string; error: string; loading: boolean; ready: boolean }): ViewState
export type SaveStatus = "saving" | "unsaved" | "saved"
export function saveStatus(s: { autoSaving: boolean; working: DocFields; synced: SyncedState | null }): SaveStatus

// src/features/editor/request-timeout.ts
export const REQUEST_TIMEOUT_MS = 30_000
export const REQUEST_TIMED_OUT = "The request timed out"
// rejects after ms and clears its timer when the promise settles; the request itself is not cancelled
export function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T>

// src/hooks/use-latest.ts
// written in a passive effect, so it is one commit behind: read it in handlers and effects only
export function useLatest<T>(value: T): MutableRefObject<T>

// src/features/editor/draft.ts
export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
export interface StoredDraft { content: string; base: string | null }   // base null: a raw value of the removed hook
export interface ReadDraft { draft: StoredDraft; raw: string; legacy: boolean }   // raw: only this value is removed
export type DraftDecision = { kind: "none" } | { kind: "apply"; content: string } | { kind: "conflict" }
export const draftKey: (promptId: string) => string        // `prompt-v1-${id}`: the v1 envelope
export const legacyDraftKey: (promptId: string) => string  // `prompt-${id}`: raw text of the removed hook, read once
export const conflictKey: (promptId: string) => string     // `prompt-v1-${id}:conflict`: the text of a draft that lost
export function hashContent(content: string): string       // `${content.length}:${cyrb53(content).toString(36)}`
export function getBrowserStorage(): DraftStorage | null   // window.localStorage, or null (server render, blocked)
export function readRaw(storage: DraftStorage | null, key: string): string | null
export function parseDraft(raw: string | null): StoredDraft | null   // a strict v1 envelope, else null
export function readDraft(storage: DraftStorage | null, promptId: string): ReadDraft | null  // v1 first, then legacy
// returns the raw value written, or null when the storage refused it; never throws
export function writeDraft(
  storage: DraftStorage | null, promptId: string, draft: { content: string; base: string }
): string | null
// best-effort compare-and-delete
export function removeIfUnchanged(storage: DraftStorage | null, key: string, raw: string | null): void
export function clearDraft(storage: DraftStorage | null, promptId: string, ownedRaw: string | null): void
export function stashConflict(storage: DraftStorage | null, promptId: string, content: string): void
export function discardRead(storage: DraftStorage | null, promptId: string, read: ReadDraft): void
export function resolveDraft(server: DocFields, draft: StoredDraft | null): DraftDecision

// src/features/editor/document-cache.ts (a Map module; moved out of useDocumentLoader.ts)
export const ANONYMOUS = "anonymous"
export type PromptWithFolder = Prompt & { folder: { id: string; name: string } }
export interface CacheEntry {
  userId: string; promptData: PromptWithFolder; title: string | null; content: string
  lastSaved: Date | null; synced: SyncedState
}
// drops and returns null for another user's entry
export function getCachedDocument(userId: string, promptId: string): CacheEntry | null
export function setDocumentCacheEntry(userId: string, promptId: string, entry: Omit<CacheEntry, "userId">): void
type CachePatch = Partial<Omit<CacheEntry, "userId">>
// merges into an existing entry; a no-op when there is none; works after the component that wrote it unmounted
export function updateDocumentCacheEntry(
  userId: string, promptId: string, patch: CachePatch | ((entry: CacheEntry) => CachePatch)
): void
export function clearDocumentCache(): void   // empties the cache; sign-out calls it. No user id is remembered anywhere

// src/features/editor/hooks/useDocumentLoader.ts
export interface DocumentLoaderIo {
  // real: (promptId) => withTimeout(getPromptDetails({ promptId }))
  fetchPrompt(promptId: string): Promise<ActionResult>
  // real: the browser lookup, ANONYMOUS on no session; looked up on every mount
  getUserId(): Promise<string>
  // required from T5 (the kept raw-draft branch reads it); real: getBrowserStorage; called inside effects only
  getStorage(): DraftStorage | null
}
export interface DocumentLoader {   // LoaderState plus:
  promptData: PromptWithFolder | null; title: string | null; content: string; lastSaved: Date | null
  synced: SyncedState | null; loading: boolean; error: string; currentUserId: string
  ready: boolean                                         // synced !== null && synced.promptId === promptId
  monacoPromptIdRef: MutableRefObject<string | null>     // the Monaco onChange guard (P5S5 data destruction fix); kept
  promptIdRef: MutableRefObject<string | null>
  setTitle: Dispatch<SetStateAction<string | null>>
  setContent: Dispatch<SetStateAction<string>>
  markSynced(next: SyncedState, options?: { version?: boolean }): boolean
  applyServerState(promptId: string, row: DocFields): boolean
}
// markSynced records a confirmed write (baseline, lastSaved and, with `version`, promptData); applyServerState replaces
// title, content, promptData, baseline and lastSaved with a restored row. Both update the document's cache entry first
// and change React state only when `promptId` is the open document; they return true exactly then.
// REMOVED in T5: isTransitioning, contentPromptIdRef, titlePromptIdRef, resetLoadedRef, hydrateDocumentCache, and
// (because T5 makes the old handlers call markSynced) setPromptData and setLastSaved.

// src/features/editor/document-actions.ts (T7)
// every hook below takes stable inputs (see Async Completions and Failures)
export interface DocumentActions {
  saveNewVersion(
    input: { promptId: string; newTitle: string; newContent: string }
  ): Promise<ActionResult<{ versionId: number }>>
  autoSavePrompt(input: { promptId: string; title: string; content: string }): Promise<ActionResult<void>>
  restorePromptVersion(
    input: { promptId: string; versionId: number }
  ): Promise<ActionResult<{ title: string | null; content: string }>>
  // read by the dialog only
  getPromptVersionHistory(input: { promptId: string }): Promise<ActionResult<PromptVersionHistoryItem[]>>
}
// each action under withTimeout; EditorPane's module-level documentActions
export function withActionTimeout(actions: DocumentActions, ms?: number): DocumentActions
export interface UseAutoSaveOptions {   // null promptId disables the hook and cancels a pending write
  promptId: string | null; title: string | null; content: string; baseline: SyncedState | null; delay?: number
  // read through a ref: its identity never re-arms the timer
  onSave(promptId: string, title: string | null, content: string): void
}
export function useDraftSync(args: {
  promptId: string; ready: boolean; content: string; synced: SyncedState | null; getStorage(): DraftStorage | null
}): void
export function useServerAutoSave(
  args: { promptId: string; loader: DocumentLoader; actions: DocumentActions; busy: boolean }
): { autoSaving: boolean }
export function useVersionSave(
  args: { promptId: string; tabId: string; loader: DocumentLoader; actions: DocumentActions; blocked: boolean }
): VersionSave
export interface VersionSave {
  saving: boolean; showSetTitleDialog: boolean; setShowSetTitleDialog(open: boolean): void
  handleSave(): void; handleSetTitle(title: string): void
}
export function useVersionRestore(
  args: { promptId: string; tabId: string; loader: DocumentLoader; actions: DocumentActions }
): { restoring: boolean; handleRestore(versionId: number): Promise<boolean> }
export function useDocumentCacheSync(args: { promptId: string; tabId: string; loader: DocumentLoader }): void
export interface UseDocumentPersistenceOptions {
  promptId: string; tabId: string; loader: DocumentLoader; actions: DocumentActions; getStorage(): DraftStorage | null
}
export interface DocumentPersistence {
  saving: boolean; autoSaving: boolean; restoring: boolean
  showSetTitleDialog: boolean; setShowSetTitleDialog(open: boolean): void
  handleSave(): void; handleSetTitle(title: string): void
  handleRestore(versionId: number): Promise<boolean>   // true when the restore succeeded
}

// src/features/editor/components/VersionHistoryDialog.tsx (T8)
export interface VersionHistoryDialogProps {
  promptId: string | null; open: boolean; onOpenChange(open: boolean): void
  // read in an effect on [open, promptId], through a ref; EditorPane passes documentActions.getPromptVersionHistory
  loadHistory(promptId: string): Promise<ActionResult<PromptVersionHistoryItem[]>>
  onRestore(versionId: number): Promise<boolean>   // handleRestore: true closes the dialog, false leaves it open
}
```

`isDirty` is unchanged: `content !== promptData.content`. It ignores title edits, drives the tab's dirty dot, and
promotes a preview tab; `useDocumentCacheSync` computes it as `EditorPane.tsx:138` does today. Autosave does not move
`promptData`, so the dot stays after an autosave, as today.

## Loader Protocol

Identity is resolved once per mount by `useIdentity`; the first answer wins. A rejected lookup, or none within 10
seconds, settles as `ANONYMOUS`, and a late answer is ignored, so the identity never changes on a mounted editor. The id
is looked up on every mount (one `getUser()` round trip): a remembered id would outlive a change of session, and the
next user would read the previous user's cache entries; `clearDocumentCache()` empties the cache on sign-out. The state
is one reducer. The document and its baseline arrive in
a single action, so `synced.promptId === promptId` is true only in renders whose title, content and `promptData` belong
to `promptId`. That token is `ready`; it replaces `isTransitioning`, `contentPromptIdRef` and `titlePromptIdRef`, and
the spike's every-render test fails if the comparison is dropped. The first render with a `promptId` already has
`loading` true.

| Path | Trigger | `loading` | Document and `synced` | `monacoPromptIdRef` | Other |
|---|---|---|---|---|---|
| P0 | no `promptId` | false | wiped | null | |
| P1 | identity pending | true | untouched | untouched | no fetch |
| P2 | wipe, for a new document | untouched | wiped | null | |
| P3 | cache hit | false | the entry's | `promptId` | `lastSaved` from the entry |
| P4 | fetch starts | true | wiped | null | |
| P5 | fetch succeeds | false | the server's | `promptId` | one action; `lastSaved` = `updated_at`; T6 adds the draft decision |
| P6 | fetch fails or rejects | false | wiped | null | `error` set and a toast |
| P7 | aborted | untouched | untouched | untouched | the run that aborted it owns shared state |

There is no loaded mark: the identity gate and the abort keep the effect from re-running for an applied document, and if
it ever does, the wipe is followed by the cache entry, which holds the working copy. A cache hit always sets `loading`
false.

T5 keeps the current raw-draft branch in P5 (`useDocumentLoader.ts:218-228`: it applies any non-empty value that differs
from the server, with the toast) and changes only where it reads, from `localStorage` directly to `io.getStorage()`,
which the seam supplies from T5 on. The old `useLocalStorage` writer is still live until T6, and a task must not disable
a feature. T6 replaces that branch with the draft decision below.

## Draft Protocol

The draft covers content only. The title is not drafted, because a rename from the document list changes the title on
the server while the draft would still hold the old one. A draft is the JSON envelope
`{"v":1,"base":"<hash>","content":"..."}` under `prompt-v1-<id>`. It has its own key so that a tab or a rollback still
running the old code never reads JSON as document text; an unknown version is left in place. All three keys start with
`prompt-`, which is what issue #44's purge removes. `base` is
`hashContent(synced.content)` when the draft was written; the cyrb53 source (public domain, by bryc) is in the draft
spike.

`readDraft` returns the v1 envelope, else the raw text under `prompt-<id>` (the removed hook's format), else null; an
empty raw value is no draft, and the v1 envelope wins when both exist. `resolveDraft(server, draft)`:

| Draft | Result |
|---|---|
| none, or `draft.content === server.content` | `none` |
| v1, `base === hashContent(server.content)`, content differs | `apply` (the server has not moved since the draft began) |
| v1, `base` differs, content differs | `conflict` |
| legacy (`base` null), content differs, server title blank | `apply`: the document was never saved, so the draft is the only copy of its text |
| legacy, content differs, server title not blank | `conflict`: the old hook never cleared a draft, so it is usually older than the server |

The loader owns reading and consuming. On `apply` it uses the draft as the working content and toasts "Restored unsaved
changes from browser storage"; `synced` stays the server's fields, so the working copy differs from the baseline and the
autosave writes it. A legacy `apply` first writes the v1 envelope, then removes the legacy value. On `none` and on
`conflict` it removes the value it read with a compare-and-delete, so nothing else has to. A `conflict` never deletes
text: the loader stashes it under `prompt-v1-<id>:conflict` (one slot per document), and shows a warning toast, "Local
unsaved changes were not restored because the document changed on the server", for 20 seconds with the action "Restore
my text", which puts the stashed text into the editor while the same document is still open (the writer and the autosave
then treat it as an edit). The loader dismisses the toast when the document is left or the editor unmounts, because its
action would then dispatch into state nobody renders. Rejected: carrying the hash of every unconfirmed save in the
envelope to prevent a false conflict after a lost response; it needs a channel from three save paths into the writer
for a rare event that the action already recovers from.

`useDraftSync` is the only draft writer. While the document is `ready` it writes `{content, base}` whenever the working
content differs from `synced.content` and removes the draft when they are equal. It owns only the values it wrote, kept
per document in a map that survives a document switch: it removes a value only by compare-and-delete against its own
last write, never one it merely read, and it keeps ownership of an older draft when a newer write is refused (quota).
`localStorage` has no atomic compare-and-delete, so two tabs can still race inside that window; the loss is bounded to
the draft of one tab.

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
| S-8 v1 draft whose base differs from the server's hash | server wins, warning toast with the action, text stashed under the conflict key, draft removed |
| S-8b the action is used | the stashed text is in the editor and a v1 draft is written against the server content |
| S-8c the action is used after another document opened | nothing changes |
| S-8d the document is left, or the editor unmounts, while the toast is shown | the toast is dismissed |
| S-9 draft equals the server content | no toast, draft removed |
| S-10 autosave committed but its response was lost, reload | no toast (contents equal), draft removed |
| S-10b the same, with more typing after the lost response | conflict: the extra text is stashed and offered (accepted limitation) |
| S-11 two tabs, tab 1's autosave succeeds while tab 2 holds a newer draft | tab 2's draft stays |
| S-11b a tab opens a document from its cache while another tab holds a draft for it | that draft stays |
| S-12 restore | draft removed; working copy and `synced` equal the restored row |
| S-13 storage throws on read, write or remove, or is null | the editor works without drafts |
| S-14 a value under the v1 key that is not a v1 envelope | left in place, never applied |
| S-14b envelope-looking text under the legacy key | it is only text |

## Async Completions and Failures

Every request completes after the user may have moved on, so a handler never decides which document a result belongs to
by reading the current one. Each captures `promptId` and `tabId` when it starts; its result is applied through
`markSynced` or `applyServerState`, which take that id and return whether the document is still open, and every other
state side effect (the tab's dirty flag, the list title) follows that boolean or targets the captured ids. A completion
for a document the editor has left updates that document's cache entry only, which a later reopening shows.

Every busy flag (`saving`, `restoring`, `autoSaving`) is reset in a `finally` block. A rejected action (offline, a
deploy skew) is handled exactly like `{ success: false }`: an error toast for a manual save or restore, a console error
for an autosave, no retry (follow-up issue F-3 owns that). The loader maps a rejected fetch to path P6.
`useServerAutoSave` counts requests in flight, so `autoSaving` is true while any is pending. A server action or fetch
that never settles is abandoned after `REQUEST_TIMEOUT_MS` (30 seconds): `withActionTimeout` wraps the four actions and
`loaderIo.fetchPrompt` wraps the fetch, so the promise rejects and the handler takes the path of a rejected action. The
request is not cancelled; its late result is ignored.

A manual save is single-flight: Ctrl+S while one runs is ignored, and so is a save during a restore, because Next queues
the actions in call order and a save queued behind a restore would overwrite the restored row. `handleSetTitle(title)`
makes the confirmed title the working title and passes it to the save, so nothing waits on state. `handleRestore` first
saves unsaved edits of a titled document through `autoSavePrompt` and aborts, keeping the edits, if that fails; the
restore then snapshots the row, so the replaced text is in history. With a blank title and unsaved edits it refuses: it
shows "Give the document a title first, so your changes are saved before a version is restored" and sends nothing,
because a blank title cannot be autosaved, so the edits exist only in the editor and the restore would replace them.

`VersionHistoryDialog` reads its list in an effect on `open` and `promptId`, through a ref to `loadHistory`, so a new
function each render does not re-read it, and a result for an opening or a document that is gone is dropped. While any
restore runs it disables every Restore button, so a second request cannot start, and ignores every request to close,
which also keeps the editor inert behind the modal; it closes itself when `onRestore` resolves true and stays open when
it resolves false. The restore's success toast ("Version restored") moves from the dialog into the hook.

A request slower than the debounce can be followed by a duplicate write of the same content; the write is idempotent and
creates no version, so it is accepted. Hooks receive `actions`, `getStorage` and store functions that are stable:
module-level constants, and store functions taken with a selector (`useTabStore((s) => s.updateTab)`), so no effect
depends on a value that changes every render (an effect that calls `updateTab` has looped before: changelog entry
08/11/2025 13:45 of `EditorPane.tsx`).

## Editor View

`EditorPane` renders from `viewState`: no `promptId` shows the placeholder; an `error` shows it, before the loading
check, because a failed load is neither loading nor ready; `loading` or not `ready` shows "Loading prompt..."; only a
ready document mounts the editor. Monaco's mount handler applies the `value` of its first render, so the editor must
never mount with another document's text, which the old `loading`-only check allowed in the render where `promptId` had
just changed. The Monaco `onChange` guard becomes `loader.ready && monacoPromptIdRef.current === promptId`.

The footer comes from `saveStatus`: "Saving..." while `autoSaving`; "Unsaved changes" while the working copy differs
from the baseline (a restored draft, an untitled document); otherwise "Saved <time>" from `lastSaved`, which the loader
now sets from `updated_at`. `Header.tsx:23` imports `clearDocumentCache` from `EditorPane`, which pulls the lazily
loaded editor into the layout; it imports from `document-cache` instead, and `EditorPane` no longer re-exports it (the
re-export's comment was false and `hydrateDocumentCache` has no caller). `EditorPane` builds two module-level constants:
`loaderIo` (its `fetchPrompt` runs under `withTimeout`) and `documentActions` (the four actions under
`withActionTimeout`). It passes `documentActions.getPromptVersionHistory` to the dialog as `loadHistory` and
`persistence.handleRestore` as `onRestore`.

## Write Ordering and Pausing

Verified in the pinned Next 14.2.35: `node_modules/next/dist/shared/lib/router/action-queue.js:112-143` appends any
non-navigation action to a queue and starts it only after the previous one finishes, so within one tab server actions
run one at a time in call order and complete in call order. `markSynced` therefore needs no ordering guard, only the
same-document check. A router navigation discards the pending action's state update (`action-queue.js:121-135`) and
orphans the actions queued behind it: `handleResult` returns before `runRemainingActions`, so their promises never
settle. Navigation does happen while the editor is mounted: `Header` renders `<Link>`s (`Header.tsx:47` and `:55`),
signing out redirects, and back and forward navigate. Hence the 30-second limit on every request: an orphaned request
rejects, its handler resets its busy flag, and a write whose response is lost leaves the server ahead of the client,
which S-10 and S-10b cover. If a later Next version runs actions concurrently, an out-of-order completion can leave
`synced` briefly stale and cost one redundant autosave. Two browser tabs or devices are not ordered and stay
last-writer-wins.

`useServerAutoSave` passes `promptId: null` to `useAutoSave` while `busy` (a save or a restore runs), which cancels a
pending write; otherwise the debounce timer could fire during a restore and queue an autosave of the pre-restore working
copy behind it. When the busy state ends the effect re-evaluates: after a successful restore the working copy equals
`synced` and nothing is written; after a failure the unsaved working copy is autosaved as before.

## Budgets and Coverage Scope

Lint baseline on 20/10/2026 (`npm run lint`): 18 `max-lines-per-function` warnings, among them `EditorPane` (234
lines) and three in `useDocumentLoader.ts` (144, 89 and 82). The change adds no warning, and the loader file ends with
none: in the spikes the largest functions, counted as the lint rule counts them, are `useDocumentLoader` (65 lines),
`useVersionSave` (64), `VersionHistoryDialog` (49) and the reducer (34). `EditorPane` ends no longer than its baseline.

Files held to 80% line, function, branch and statement coverage by the per-file command: every non-test file of the
module map except the exemptions below (`service.ts` needs a database), the guard functions of `src/test/db.ts`, and
`VersionHistoryDialog.tsx`, which its suite renders with Testing Library once T1 adds the DOM environment and the JSX
transform. Exempt, with the reason recorded in the REPORT: the action files (shells; how every action is tested is
issue #45), `EditorPane.tsx` (composition and JSX; covered by the hook and dialog suites, `viewState`, `saveStatus`
and dev-review #38), and the `src/test/db.ts` helpers that need a database.

Tests never import `@/lib/db`, an action file, or `@/lib/supabase/*`: the Prisma singleton could connect to a
developer's real `DATABASE_URL`, so they build their own client from `TEST_DATABASE_URL` through `src/test/db.ts`. They
may mock `sonner`, which is not a module of this repository ([Rules](../../docs/rules/testing.md#rules)), and they use
the real zustand stores and the real Radix dialog and Button.
