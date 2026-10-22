/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentCacheSync.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:06 GMT+10
Last modified: 22/10/2026 10:22 GMT+10
---------------
Keeps the open document's cache entry and its tab's metadata (title, folder, dirty flag, promotion of a preview tab)
in step with the working copy, while the document is ready.

Changelog:
22/10/2026 10:22 GMT+10 | Adopted the reference form: one readiness guard for the entry and the tab (P7S1T7 step 3)
22/10/2026 10:06 GMT+10 | Extracted unchanged from EditorPane.tsx (P7S1T7 step 1)
*/

import { useEffect } from "react"
import { useTabStore } from "@/stores/use-tab-store"
import { getDisplayTitle } from "@/features/prompts/utils"
import { setDocumentCacheEntry } from "../document-cache"
import type { DocumentLoader } from "./useDocumentLoader"

/** The inputs of `useDocumentCacheSync`. */
export interface UseDocumentCacheSyncArgs {
  /** The open document; "" for none. */
  promptId: string
  /** The tab that shows the document. */
  tabId: string
  /** The document loader; only its fields are read, so a new object each render re-runs nothing. */
  loader: DocumentLoader
}

/**
 * Writes the cache entry and updates the tab whenever the working copy, the baseline or the document changes. The
 * dirty flag is `content !== promptData.content`: it ignores title edits and promotes a preview tab once set.
 * @param args - The open document, its tab and the loader.
 */
export function useDocumentCacheSync({ promptId, tabId, loader }: UseDocumentCacheSyncArgs): void {
  const updateTab = useTabStore((s) => s.updateTab)
  const promotePreviewTab = useTabStore((s) => s.promotePreviewTab)
  const { ready, synced, promptData, title, content, lastSaved, currentUserId } = loader

  useEffect(() => {
    // Reason: only a ready document is written, so the cache never holds one document's text under another's id.
    if (!ready || !promptData || !synced) return
    const isDirty = content !== promptData.content
    setDocumentCacheEntry(currentUserId, promptId, { promptData, title, content, lastSaved, synced })
    // Reason: the tab list is read with getState, never as a dependency: a dependency on `tabs` looped this effect,
    // because updateTab changes the list (EditorPane changelog 08/11/2025 13:45).
    const tab = useTabStore.getState().tabs.find((t) => t.id === tabId)
    if (isDirty && tab?.isPreview) promotePreviewTab(tabId)
    updateTab(tabId, { title: getDisplayTitle(title), folderId: promptData.folder.id, isDirty })
  }, [
    ready, promptData, synced, title, content, lastSaved, currentUserId, promptId, tabId, updateTab, promotePreviewTab,
  ])
}
