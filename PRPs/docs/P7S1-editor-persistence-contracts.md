# PromptHub
## P7S1 Editor Persistence Contracts

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P7S1 Editor Persistence Contracts | 20/10/2026 12:36 GMT+10 | 20/10/2026 12:36 GMT+10 |

## Table of Contents
- [Purpose](#purpose)
- [Module Map](#module-map)
- [Types and Interfaces](#types-and-interfaces)
- [Server Shells](#server-shells)
- [Loader Protocol](#loader-protocol)
- [Draft Protocol](#draft-protocol)
- [Write Ordering and Pausing](#write-ordering-and-pausing)
- [Pseudocode](#pseudocode)
- [Budgets and Coverage Scope](#budgets-and-coverage-scope)

## Purpose

This is the shared contract for `PRPs/P7S1-editor-data-integrity.md`. Nine tasks are dispatched to separate agents
that cannot see one another's work, so every interface, state transition and rule they must agree on is written here
once. The task briefs are in `P7S1-task-briefs.md`. Where this document and the code disagree about what exists today,
the code is right; where they disagree about what to build, this document is right. The loader protocol was proved
with a working spike, `wip/P7S1-loader-spike.ts`, and its 12 tests in `wip/P7S1-loader-spike.test.tsx` (run with
`npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-loader-spike.test.tsx`); adapt it in T5 rather than
rewrite it from this text.

## Module Map

Line budgets keep every file GREEN (300 lines) and every function under the 80-line lint limit
(`docs/rules/project.md#architecture-constraints`). A test file stays under 450 lines, because the audit fails an
unregistered RED test file (`scripts/audit-code-size.sh`) and about 500 dense lines reach the 8,000-token band.

| File | Task | Responsibility | Lines |
|---|---|---|---|
| `src/test/db.ts`, `db.test.ts` | T1 | test-database helpers; guard unit tests and a smoke test | 150 each |
| `src/features/editor/service.ts` | T2, T3 | server logic taking `(db, userId, input)`; no `"use server"` | 250 |
| `src/features/editor/sync.ts` | T4 | `DocFields`, `SyncedState`, `sameFields`, `needsAutoSave` | 60 |
| `src/features/editor/draft.ts` | T4 | storage seam, hash, parse, read, write, clear, `resolveDraft` | 200 |
| `src/features/editor/document-cache.ts` | T4, T5 | the module cache, moved out of the loader, with `synced` | 90 |
| `hooks/useDocumentLoader.ts` | T5, T6, T8 | loader protocol, `markSynced`, `applyServerState` | 300 |
| `hooks/useAutoSave.ts` | T6 | debounce with a baseline | 90 |
| `hooks/useDraftSync.ts` | T6 | the only draft writer | 80 |
| `hooks/useDocumentCacheSync.ts` | T7 | cache entry and tab metadata effect | 90 |
| `hooks/useVersionSave.ts` | T7 | manual save, title dialog state, Ctrl+S | 140 |
| `hooks/useServerAutoSave.ts` | T7 | autosave handler wiring and `autoSaving` | 90 |
| `hooks/useVersionRestore.ts` | T8 | the restore call and applying its result | 90 |
| `hooks/useDocumentPersistence.ts` | T7, T8 | composition of the hooks above | 90 |
| `components/EditorPane.tsx` | T5 to T8 | composition and JSX; ends shorter than 329 lines | 329 max |

All `hooks/` paths are under `src/features/editor/`.

## Types and Interfaces

```typescript
// src/features/editor/sync.ts (pure, client-safe)
export interface DocFields { title: string | null; content: string }
export interface SyncedState extends DocFields { promptId: string }   // what the server holds for one document
export function sameFields(a: DocFields, b: DocFields): boolean       // (a.title ?? "") === (b.title ?? "") && contents equal
export function needsAutoSave(working: DocFields, synced: SyncedState | null): boolean
// needsAutoSave: synced !== null && Boolean(working.title?.trim()) && !sameFields(working, synced)
// GOTCHA: null?.trim() is undefined, and undefined !== "" is true: test with Boolean(...), never with !== "".

// src/features/editor/document-cache.ts (pure Map module; moved out of useDocumentLoader.ts)
import type { Prompt } from "@prisma/client"
export type PromptWithFolder = Prompt & { folder: { id: string; name: string } }
export interface CacheEntry {
  userId: string; promptData: PromptWithFolder; title: string | null; content: string
  lastSaved: Date | null; synced: SyncedState
}
export function getCachedDocument(userId: string, promptId: string): CacheEntry | null
//   deletes the entry and returns null when entry.userId !== userId (the P5S4T2 security check)
export function setDocumentCacheEntry(userId: string, promptId: string, entry: Omit<CacheEntry, "userId">): void
export function updateDocumentCacheEntry(userId: string, promptId: string, patch: Partial<Omit<CacheEntry, "userId">>): void
//   merges into an existing entry; a no-op when there is none. Works after the component that wrote it unmounted.
export function clearDocumentCache(): void

// src/features/editor/draft.ts
export interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface StoredDraft { content: string; base: string | null }   // base null: a raw value left by the removed hook
export type DraftDecision = { kind: "none" } | { kind: "apply"; content: string } | { kind: "conflict" }
export const draftKey = (promptId: string) => `prompt-${promptId}`
export function hashContent(content: string): string                    // `${content.length}:${cyrb53(content).toString(36)}`
export function getBrowserStorage(): DraftStorage | null                // window.localStorage, or null (server render, blocked)
export function readDraftRaw(storage: DraftStorage | null, promptId: string): string | null
export function parseDraft(raw: string | null): StoredDraft | null
export function readDraft(storage: DraftStorage | null, promptId: string): StoredDraft | null
export function writeDraft(storage: DraftStorage | null, promptId: string, draft: { content: string; base: string }): string | null
//   returns the raw value written, or null when the storage refused it (quota, blocked); never throws
export function clearDraft(storage: DraftStorage | null, promptId: string, ownedRaw: string | null): void
//   compare-and-delete: removes the key only when its current value === ownedRaw (never another tab's draft)
export function resolveDraft(serverContent: string, draft: StoredDraft | null): DraftDecision

// src/features/editor/hooks/useDocumentLoader.ts
export interface DocumentLoaderIo {
  fetchPrompt(promptId: string): Promise<ActionResult>   // real: (promptId) => getPromptDetails({ promptId })
  getUserId(): Promise<string>                           // real: never rejects; "anonymous" for no session or a failed lookup
  getStorage(): DraftStorage | null                      // added in T6; called inside effects only, never during render
}
export interface DocumentLoader {
  promptData: PromptWithFolder | null; title: string | null; content: string
  loading: boolean; error: string; lastSaved: Date | null; currentUserId: string
  synced: SyncedState | null
  ready: boolean                                         // synced !== null && synced.promptId === promptId (see Loader Protocol)
  monacoPromptIdRef: MutableRefObject<string | null>     // kept: the Monaco onChange guard (P5S5 data destruction fix)
  promptIdRef: MutableRefObject<string | null>
  setPromptData: Dispatch<SetStateAction<PromptWithFolder | null>>
  setTitle: Dispatch<SetStateAction<string | null>>
  setContent: Dispatch<SetStateAction<string>>
  setLastSaved: Dispatch<SetStateAction<Date | null>>
  markSynced(next: SyncedState): boolean   // records a confirmed server write; true when it reached React state
  applyServerState(row: { title: string | null; content: string }): void   // restore: title, content, promptData, synced, lastSaved
  resetLoadedRef(): void                   // kept only until T8, which removes it
}
// REMOVED in T5: isTransitioning, contentPromptIdRef, titlePromptIdRef (replaced by `ready`), hydrateDocumentCache.

// src/features/editor/hooks/useAutoSave.ts (T6)
export interface UseAutoSaveOptions {
  title: string | null; content: string; promptId: string | null   // null disables and cancels a pending write
  baseline: SyncedState | null; delay?: number
  onSave(promptId: string, title: string | null, content: string): void
}

// src/features/editor/hooks/useDraftSync.ts (T6)
export function useDraftSync(args: {
  promptId: string; ready: boolean; content: string; synced: SyncedState | null; getStorage(): DraftStorage | null
}): void

// src/features/editor/hooks/useDocumentPersistence.ts (T7, T8)
export interface DocumentActions {
  saveNewVersion(input: { promptId: string; newTitle: string; newContent: string }): Promise<ActionResult<{ versionId: number }>>
  autoSavePrompt(input: { promptId: string; title: string; content: string }): Promise<ActionResult<void>>
  restorePromptVersion(input: { promptId: string; versionId: number }): Promise<ActionResult<{ title: string | null; content: string }>>
}
export interface UseDocumentPersistenceOptions {
  promptId: string; tabId: string; loader: DocumentLoader; actions: DocumentActions; getStorage(): DraftStorage | null
}
export interface DocumentPersistence {
  saving: boolean; autoSaving: boolean; restoring: boolean
  showSetTitleDialog: boolean; setShowSetTitleDialog(open: boolean): void
  handleSave(): void                              // the Ctrl+S listener and the Save button
  handleSetTitle(title: string): void             // the title dialog's confirm
  handleRestore(versionId: number): Promise<boolean>   // the history dialog; true when the restored row was applied
}
```

`isDirty` is unchanged: `content !== promptData.content`. It ignores title edits, drives the tab's dirty dot, and
promotes a preview tab; `useDocumentCacheSync` computes it exactly as `EditorPane.tsx:138` does today.

## Server Shells

Each action keeps its shell and gains only the call into the service. Nothing is added or removed, so rate limits and
validation do not move; issue #48 owns changing them.

| Action | File | Shell after the change |
|---|---|---|
| `saveNewVersion` | `src/features/editor/actions.ts` | parse `saveNewVersionSchema`, `titleValidationSchema`, authenticate, `checkMutationRateLimit`, `saveVersion` |
| `autoSavePrompt` | `src/features/editor/actions.ts` | parse `autoSaveSchema`, authenticate, `autoSaveDocument` (no rate limit, no title validation) |
| `getPromptVersionHistory` | `src/features/prompts/actions.ts` | parse, authenticate, `listVersions` (no rate limit) |
| `restorePromptVersion` | `src/features/prompts/actions.ts` | parse, authenticate, `restoreVersion` (no rate limit) |

Every shell keeps the `NEXT_REDIRECT` rethrow and a catch that returns a generic failure. Results: `saveNewVersion`
returns `{ versionId }`, `autoSavePrompt` returns nothing as today, `restorePromptVersion` returns `{ title, content }`.
No timestamp is returned: nothing depends on one (the draft base is a content hash, and writes complete in call order,
see [Write Ordering and Pausing](#write-ordering-and-pausing)).

## Loader Protocol

Identity is resolved once per mount (`getUserId` in an effect with no dependencies). Sign-out unmounts the editor, so an
identity change on a mounted editor is not supported and not handled. The load effect depends on `[promptId,
currentUserId]` and reads `io` through a ref, so a caller that builds a new `io` object each render does not re-run it.

`ready` replaces `isTransitioning`, `contentPromptIdRef` and `titlePromptIdRef`. `synced` is set in the same state batch
as the document, so `synced.promptId === promptId` is true only in renders whose title, content and `promptData` belong
to `promptId`. In the render where `promptId` has just changed, the state is still the old document's, `synced.promptId`
differs, and `ready` is false. The spike's every-render test fails if the comparison is dropped. Every consumer that
used the old flags (autosave gating, the draft writer, the cache writer, manual save) uses `ready`.

| Path | Trigger | `loading` | `synced` | loaded mark | other |
|---|---|---|---|---|---|
| P0 | no `promptId` | false | null | cleared | all state reset, `monacoPromptIdRef` null |
| P1 | identity pending | true | untouched | untouched | nothing else changes; no fetch |
| P8 | same document already applied | untouched | untouched | untouched | returns before the wipe |
| P2 | wipe, for a new document | untouched | null | cleared | `promptData` null, title null, content "", error "", `lastSaved` null |
| P3 | cache hit | false | the entry's | `promptId` | `monacoPromptIdRef` = `promptId`; title, content, `promptData`, `lastSaved` from the entry |
| P4 | fetch starts | true | null | cleared | |
| P5 | fetch succeeds | false | server title and content | `promptId` | one batch: `promptData`, title, content, `lastSaved` = `updated_at`, `synced`; T6 adds the draft decision |
| P6 | fetch fails | false | null | cleared | `error` set and a toast |
| P7 | aborted | untouched | untouched | untouched | the run that aborted it owns shared state |

Rules that follow. The loaded mark is set only on apply (P3, P5) and cleared by the wipe (P2); setting it at fetch start
is the flaw that strands a switch back to an applied document. A cache hit always sets `loading` false. A re-run with the
same `promptId` after apply returns at P8 without touching state. The transition effect `[promptId, loading]` and the
three ref flags no longer exist.

## Draft Protocol

The draft covers content only. The title is not drafted, because a rename from the document list changes the title on
the server while the draft would still hold the old one. Stored value: JSON `{"v":1,"base":"<hash>","content":"..."}`
under `prompt-<id>` (the key is unchanged, so issue #44's purge still finds it). `base` is `hashContent(synced.content)`
at write time. `hashContent` is `${content.length}:${cyrb53(content).toString(36)}` with cyrb53 (public domain, by bryc):

```typescript
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
```

`parseDraft(raw)`: null for null or `""`; the v1 shape (checked with Zod: `v` is 1, `base` a non-empty string, `content`
a string) gives `{ content, base }`; anything else, JSON or not, is a legacy raw value and gives `{ content: raw, base:
null }`. Legacy values exist because the removed hook stored raw strings, and an untitled document is never autosaved
(`useAutoSave` skips a blank title), so that draft is the only copy of its text. Deleting it on upgrade would destroy
user content.

`resolveDraft(serverContent, draft)`:

| Draft | Result |
|---|---|
| none | `none` |
| `draft.content === serverContent` | `none` (nothing to restore) |
| legacy (`base` null) and different | `apply` (the old behaviour, once; the writer converts it to v1) |
| v1 and `base === hashContent(serverContent)` and different | `apply` (the server has not moved since the draft began) |
| v1 and `base !== hashContent(serverContent)` and different | `conflict` (the content changed elsewhere) |

The loader applies `apply` with the toast "Restored unsaved changes from browser storage", and reports `conflict` with a
warning toast "Local unsaved changes were not restored because the document changed on the server"; the server copy
wins. `synced` is always the server's fields, so an applied draft makes the working copy differ from `synced`.

`useDraftSync` is the only draft writer. It runs when `ready && synced.promptId === promptId`. On the first ready run
for a `promptId` it records `ownedRaw = readDraftRaw(...)` (what the loader read). Then: if `content === synced.content`,
`clearDraft(storage, promptId, ownedRaw)` and `ownedRaw = null` when the key was removed; otherwise `ownedRaw =
writeDraft(storage, promptId, { content, base: hashContent(synced.content) })`. A successful autosave, a save and a
restore all clear the draft by changing `synced`. Two browser tabs share the key, so a tab removes only a value it wrote
or read itself.

| Scenario | Expected |
|---|---|
| S-1 type in a titled document, autosave succeeds | draft gone from storage (`getItem` is null) |
| S-2 type, autosave fails, reload | draft applied with the toast; autosave then writes it |
| S-3 clear to empty, autosave succeeds, reload | empty document, no toast, no draft |
| S-4 clear to empty, autosave fails, reload | empty content applied (empty is a valid draft) |
| S-5 untitled document, type, reload | content restored; nothing was autosaved |
| S-6 untitled document, type, rename from the list, reload | content restored, title from the server |
| S-7 legacy raw draft present at load | applied once, then rewritten as v1 |
| S-8 draft base differs from the server's content hash | server wins, warning toast, draft removed |
| S-9 draft content equals the server's | no toast, draft removed |
| S-10 autosave committed on the server but its response was lost, reload | no toast (contents equal), draft removed |
| S-11 two tabs, tab 1's autosave succeeds while tab 2 holds a newer draft | tab 2's draft stays |
| S-12 restore | draft removed, working copy and `synced` equal the restored row |
| S-13 storage throws on read, write or remove | the editor works without drafts |
| S-14 stored value is JSON that is not a v1 draft | treated as a legacy raw value: its text is the content; nothing is thrown |

## Write Ordering and Pausing

Verified in the pinned Next 14.2.35: `node_modules/next/dist/shared/lib/router/action-queue.js:112-143` appends any
non-navigation action to a queue and starts it only after the previous one finishes, so within one tab server actions
run one at a time in call order and complete in call order. `markSynced` therefore needs no ordering guard, only the
same-document check. If a later Next version runs actions concurrently, an out-of-order completion can leave `synced`
briefly stale and cost one redundant autosave; revisit then. Two browser tabs or devices are not ordered and stay
last-writer-wins.

`useServerAutoSave` passes `promptId: null` to `useAutoSave` while `saving` or `restoring`, which cancels a pending
write. Without that, the debounce timer could fire during a pending save or restore and queue an autosave of the
pre-restore working copy behind it, overwriting the restore. When the busy state ends the effect re-evaluates: after a
successful restore the working copy equals `synced` and nothing is written; after a failure the unsaved working copy is
autosaved as before.

## Pseudocode

```typescript
// T2 saveVersion. CRITICAL: the scoped update comes first; it is the ownership check and the row lock.
return db.$transaction(async (tx) => {
  const written = await tx.prompt.updateMany({ where: { id: promptId, user_id: userId }, data: { title, content, updated_at: new Date() } })
  if (written.count === 0) return fail("Prompt not found or access denied")
  const newest = await tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: [...NEWEST_FIRST] })
  if (newest && newest.title_snapshot === title && newest.content_snapshot === content) return ok({ versionId: newest.id })
  const created = await tx.promptVersion.create({ data: { prompt_id: promptId, title_snapshot: title, content_snapshot: content } })
  return ok({ versionId: created.id })
})

// T3 restoreVersion. GOTCHA: FOR UPDATE is the first statement; the working copy is read from its result.
const rows = await tx.$queryRaw<{ title: string | null; content: string }[]>`
  SELECT title, content FROM "Prompt" WHERE id = ${promptId} AND user_id = ${userId} FOR UPDATE`
if (rows.length === 0) return fail("Prompt not found or access denied")
const version = await tx.promptVersion.findFirst({ where: { id: versionId, prompt_id: promptId } })
if (!version) return fail("Version not found")
let newest = await findNewest(tx, promptId)
if (!newest || !same(newest, rows[0])) newest = await tx.promptVersion.create({ data: snapshotOf(promptId, rows[0]) })
await tx.prompt.updateMany({ where: { id: promptId, user_id: userId }, data: { title: version.title_snapshot, content: version.content_snapshot, updated_at: new Date() } })
if (!same(newest, version)) await tx.promptVersion.create({ data: snapshotOf(promptId, version) })
return ok({ title: version.title_snapshot, content: version.content_snapshot })

// T5 load effect (the spike is the reference). Order: promptId, identity, same-document check, wipe, cache, fetch.
if (!promptId) { wipe(true); return }
if (!currentUserId) { setLoading(true); return }                  // P1
if (loadedRef.current === promptId) return                        // P8, before the wipe
wipe(false)                                                       // P2, clears loadedRef
const cached = getCachedDocument(currentUserId, promptId)
if (cached) { apply from the entry; loadedRef.current = promptId; setLoading(false); return }   // P3
setLoading(true)                                                  // P4
const result = await ioRef.current.fetchPrompt(promptId)
if (controller.signal.aborted) return                             // P7
if (!result.success) { setError; toast; setLoading(false); return }   // P6
apply in one batch, loadedRef.current = promptId, setLoading(false)   // P5

// T6 loader draft decision, inside P5 before setContent:
const decision = resolveDraft(data.content ?? "", readDraft(ioRef.current.getStorage(), promptId))
content = decision.kind === "apply" ? decision.content : (data.content ?? "")
// toast for apply and conflict as in the Draft Protocol; synced stays the server's fields

// T6 useDraftSync. ownedRaw lives in a ref reset when promptId changes.
if (!ready || synced?.promptId !== promptId) return
if (!initialised) { ownedRaw = readDraftRaw(storage, promptId); initialised = true }
if (content === synced.content) { clearDraft(storage, promptId, ownedRaw); ownedRaw = null }
else ownedRaw = writeDraft(storage, promptId, { content, base: hashContent(synced.content) })

// T7 saveVersion(titleToSave). The Ctrl+S handler and the button call saveVersion(title); the dialog calls saveVersion(newTitle).
if (!loader.ready) return
if (!titleValidationSchema.safeParse(titleToSave).success) { setShowSetTitleDialog(true); return }
const sent = loader.content                                       // what is sent, not what the editor holds later
setSaving(true)
const result = await actions.saveNewVersion({ promptId, newTitle: titleToSave, newContent: sent })
if (result.success) {
  loader.markSynced({ promptId, title: titleToSave, content: sent })
  loader.setPromptData((prev) => prev && { ...prev, title: titleToSave, content: sent, updated_at: new Date() })
  /* working title and content are untouched: edits typed during the request stay and keep their draft */
}
setSaving(false)

// T8 handleRestore(versionId)
if (!loader.ready) return false
setRestoring(true)                                                // pauses useServerAutoSave
const result = await actions.restorePromptVersion({ promptId, versionId })
setRestoring(false)
if (!result.success) { toast.error(result.error); return false }
loader.applyServerState(result.data)                              // working copy and synced become the restored row
updateTab(...); updatePromptTitle(promptId, result.data.title ?? ""); triggerPromptRefetch()   // the list only
return true
```

## Budgets and Coverage Scope

Lint baseline on 20/10/2026 (`npm run lint`, 18 warning lines in all, all `max-lines-per-function`): `Editor.tsx:68`
`Editor` 101 lines; `EditorPane.tsx:64` `EditorPane` 234; `useDocumentLoader.ts:112` `useDocumentLoader` 144, `:137` an
arrow of 89 and `:140` `loadPrompt` 82. The change adds no warning; the loader file ends with none of its three, because
its work moves into functions of at most 80 lines. `EditorPane` ends no longer than its baseline.

Files held to 80% line, function, branch and statement coverage by the per-file command: `sync.ts`, `draft.ts`,
`document-cache.ts`, `service.ts` (with a database), the hooks in the module map, and the guard functions of
`src/test/db.ts`. Exempt, with the reason recorded in the REPORT: the action files (shells; how every action is tested
is issue #45), `EditorPane.tsx` and `VersionHistoryDialog.tsx` (components, no component test environment; covered by
the hook tests and by dev-review #38), and `src/test/db.ts` helpers that need a database.

Tests never import `@/lib/db`, an action file, or `@/lib/supabase/*`: Prisma Client reads the project environment, so
the singleton could connect to a developer's real `DATABASE_URL`. They build their own client from
`TEST_DATABASE_URL` through `src/test/db.ts`.
