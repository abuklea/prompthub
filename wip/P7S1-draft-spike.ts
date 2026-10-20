/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-draft-spike.ts
MIME: text/typescript
Type: TypeScript React hook and helpers (research spike, not imported by the application)

Created: 20/10/2026 12:48 GMT+10
Last modified: 20/10/2026 13:03 GMT+10
---------------
P7S1 research spike. A standalone version of the sync helpers (sync.ts), the draft store (draft.ts) and the draft writer
(hooks/useDraftSync.ts) decided in PRPs/docs/P7S1-editor-persistence-contracts.md. It exists to prove the draft protocol
with wip/P7S1-draft-spike.test.tsx, together with the loader spike (wip/P7S1-loader-spike.ts, whose blocks marked T6 call
into this file), before P7S1T4 writes sync.ts and draft.ts and P7S1T6 writes the hook. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-draft-spike.test.tsx

Changelog:
20/10/2026 13:03 GMT+10 | useDraftSync owns only what it wrote (a map per document); resolveDraft takes the document and applies a legacy draft only to an unsaved one
20/10/2026 12:49 GMT+10 | Corrected the header timestamps to the filesystem record
20/10/2026 12:48 GMT+10 | Created
*/

import { useEffect, useRef } from "react"
import { z } from "zod"

// ---- sync.ts (T4) ----

export interface DocFields {
  title: string | null
  content: string
}

/** What the server holds for one document: the last state a write confirmed or a read returned. */
export interface SyncedState extends DocFields {
  promptId: string
}

export function sameFields(a: DocFields, b: DocFields): boolean {
  return (a.title ?? "") === (b.title ?? "") && a.content === b.content
}

export function needsAutoSave(working: DocFields, synced: SyncedState | null): boolean {
  // Reason: null?.trim() is undefined and undefined !== "" is true, so test truthiness, never inequality with "".
  return synced !== null && Boolean(working.title?.trim()) && !sameFields(working, synced)
}

// ---- draft.ts (T4) ----

export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** `base` is null for a raw value left by the removed useLocalStorage hook. */
export interface StoredDraft {
  content: string
  base: string | null
}

export type DraftDecision = { kind: "none" } | { kind: "apply"; content: string } | { kind: "conflict" }

export const draftKey = (promptId: string) => `prompt-${promptId}`

/** cyrb53 by bryc (public domain): a fast 53-bit string hash. Not cryptographic; it only detects a changed text. */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function hashContent(content: string): string {
  return `${content.length}:${cyrb53(content).toString(36)}`
}

/** window.localStorage, or null on the server and when the browser blocks it (reading the property can throw). */
export function getBrowserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function readDraftRaw(storage: DraftStorage | null, promptId: string): string | null {
  if (!storage) return null
  try {
    return storage.getItem(draftKey(promptId))
  } catch {
    return null
  }
}

const draftV1Schema = z.object({ v: z.literal(1), base: z.string().min(1), content: z.string() })

export function parseDraft(raw: string | null): StoredDraft | null {
  if (raw === null || raw === "") return null
  try {
    const parsed = draftV1Schema.safeParse(JSON.parse(raw))
    if (parsed.success) return { content: parsed.data.content, base: parsed.data.base }
  } catch {
    // Not JSON: a raw string left by the removed hook.
  }
  // Reason: anything that is not a v1 draft is the text itself. An untitled document is never autosaved, so this
  // value can be the only copy of the user's text, and discarding it would destroy content.
  return { content: raw, base: null }
}

export function readDraft(storage: DraftStorage | null, promptId: string): StoredDraft | null {
  return parseDraft(readDraftRaw(storage, promptId))
}

/** Returns the raw value written, or null when the storage refused it. Never throws. */
export function writeDraft(
  storage: DraftStorage | null,
  promptId: string,
  draft: { content: string; base: string }
): string | null {
  if (!storage) return null
  const raw = JSON.stringify({ v: 1, base: draft.base, content: draft.content })
  try {
    storage.setItem(draftKey(promptId), raw)
    return raw
  } catch {
    return null
  }
}

/** Compare-and-delete: removes the key only while it still holds `ownedRaw`, so another tab's draft survives. */
export function clearDraft(storage: DraftStorage | null, promptId: string, ownedRaw: string | null): void {
  if (!storage) return
  try {
    if (storage.getItem(draftKey(promptId)) === ownedRaw) storage.removeItem(draftKey(promptId))
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export function resolveDraft(server: DocFields, draft: StoredDraft | null): DraftDecision {
  if (draft === null || draft.content === server.content) return { kind: "none" }
  if (draft.base === null) {
    // Reason: a raw value from the removed hook has no base, so it cannot be told from a stale one, and the old hook
    // never cleared it. For a document that was never saved (blank title) it is the only copy of the text; for a saved
    // document it is usually older than the server, and applying it would let the autosave overwrite saved text.
    return (server.title ?? "").trim() === "" ? { kind: "apply", content: draft.content } : { kind: "conflict" }
  }
  return draft.base === hashContent(server.content) ? { kind: "apply", content: draft.content } : { kind: "conflict" }
}

// ---- hooks/useDraftSync.ts (T6) ----

export interface UseDraftSyncArgs {
  promptId: string
  /** True only in renders whose content and synced belong to promptId (the loader's `ready`). */
  ready: boolean
  content: string
  synced: SyncedState | null
  getStorage(): DraftStorage | null
}

/**
 * The only draft writer. Invariant: while the open document is ready, a draft this tab wrote exists in the storage
 * exactly while the working content differs from `synced.content`, and its `base` is the hash of the
 * `synced.content` it differs from. The writer owns only values it wrote; the loader removes the values it consumed.
 */
export function useDraftSync({ promptId, ready, content, synced, getStorage }: UseDraftSyncArgs): void {
  const getStorageRef = useRef(getStorage)
  // Reason: ownership is per document and survives a switch, so returning to a document still clears this tab's own
  // draft (an autosave can complete while another document is open), and a value this tab did not write is never
  // removed: another tab may hold a newer draft under the same key.
  const ownedRef = useRef(new Map<string, string>())

  useEffect(() => {
    getStorageRef.current = getStorage
  }, [getStorage])

  useEffect(() => {
    // Reason: `ready` is false in the render where promptId has just changed, so the old document's text is never
    // written under the new document's key (the P5S5 bleed).
    if (!ready || synced === null) return
    const storage = getStorageRef.current()
    const owned = ownedRef.current
    if (content === synced.content) {
      const raw = owned.get(promptId)
      if (raw !== undefined) {
        clearDraft(storage, promptId, raw)
        owned.delete(promptId)
      }
      return
    }
    const written = writeDraft(storage, promptId, { content, base: hashContent(synced.content) })
    // Reason: a refused write leaves the older draft in the storage; keep owning it so the next clear removes it.
    if (written !== null) owned.set(promptId, written)
  }, [promptId, ready, content, synced])
}
