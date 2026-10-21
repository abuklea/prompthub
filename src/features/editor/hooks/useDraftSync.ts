/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDraftSync.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 09:34 GMT+10
Last modified: 22/10/2026 09:40 GMT+10
---------------
The editor's only browser draft writer (contract: Draft Protocol, decision D2). While the open document is ready it
keeps a v1 draft of the working content exactly while that content differs from the baseline, and removes only the
values this tab wrote, by compare-and-delete.

Changelog:
22/10/2026 09:40 GMT+10 | Implemented from the P7S1 draft spike (P7S1T6 step 2)
22/10/2026 09:34 GMT+10 | Created as a stub for the red run of P7S1T6 step 1
*/

import { useEffect, useMemo, useRef } from "react"
import { useLatest } from "@/hooks/use-latest"
import { clearDraft, hashContent, writeDraft, type DraftStorage } from "../draft"
import type { SyncedState } from "../sync"

/** The inputs of `useDraftSync`. */
export interface UseDraftSyncArgs {
  /** The open document; "" for none. */
  promptId: string
  /** True only in renders whose content and `synced` belong to `promptId` (the loader's `ready`). */
  ready: boolean
  /** The working content. */
  content: string
  /** What the server holds for the open document, or null before it is known. */
  synced: SyncedState | null
  /** Returns the draft storage; read through a ref and called inside effects only. */
  getStorage(): DraftStorage | null
}

/**
 * Keeps the open document's draft. Invariant: while the document is ready, a draft this tab wrote exists in the storage
 * exactly while the working content differs from `synced.content`, and its `base` is the hash of that `synced.content`.
 * It never removes a value it did not write; the loader removes the values it consumed. The write is not debounced: the
 * draft is the safety net for a tab that closes or crashes, and one `setItem` of a short string is cheap.
 * @param args - The open document, its readiness, working content and baseline, and the storage seam.
 */
export function useDraftSync({ promptId, ready, content, synced, getStorage }: UseDraftSyncArgs): void {
  const getStorageRef = useLatest(getStorage)
  // Reason: ownership is per document and survives a switch, so returning to a document still clears this tab's own
  // draft (an autosave can complete while another document is open), and a value this tab did not write is never
  // removed: another tab may hold a newer draft under the same key.
  const ownedRef = useRef(new Map<string, string>())
  const syncedContent = synced?.content ?? null
  // Reason: hashing the baseline on every keystroke is O(n); it changes only when the baseline does.
  const base = useMemo(() => (syncedContent === null ? null : hashContent(syncedContent)), [syncedContent])

  useEffect(() => {
    // Reason: `ready` is false in the render where promptId has just changed, so the old document's text is never
    // written under the new document's key.
    if (!ready || syncedContent === null || base === null) return
    const storage = getStorageRef.current()
    const owned = ownedRef.current
    if (content === syncedContent) {
      const raw = owned.get(promptId)
      if (raw === undefined) return
      clearDraft(storage, promptId, raw)
      owned.delete(promptId)
      return
    }
    const written = writeDraft(storage, promptId, { content, base })
    // Reason: a refused write leaves the older draft in the storage; keep owning it so the next clear removes it.
    if (written !== null) owned.set(promptId, written)
  }, [promptId, ready, content, syncedContent, base, getStorageRef])
}
