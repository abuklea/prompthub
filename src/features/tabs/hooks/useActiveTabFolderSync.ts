/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/hooks/useActiveTabFolderSync.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 14:37 GMT+10
Last modified: 22/10/2026 14:39 GMT+10
---------------
Keeps the folder tree and the document selection in step with the active document tab, but only when that tab changes:
its activation (a click, a new tab, a restore on reload) or its folder changing. The user's own folder selection is
never undone.

Changelog:
22/10/2026 14:39 GMT+10 | Sync keyed on the active tab's id and folder, so a folder click or a tab update no longer
                         snaps the tree back; folder selected before the document; folder fallback from the workspace
                         cache (#95)
22/10/2026 14:37 GMT+10 | Extracted verbatim from PromptList (#95)
*/

"use client"

import { useEffect, useRef } from "react"
import { getPromptFromCache } from "@/features/workspace/cache"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"

/**
 * Selects the active document tab's folder, then its document, whenever the active document tab changes (another tab
 * is activated, or the active tab's folder id changes). A non-document tab leaves the selection alone.
 *
 * Reason: the sync runs once per tab id and folder id, so the user's folder clicks, and updates to the tab such as its
 * dirty flag or title (`updateTab` replaces the tab object), never re-trigger it and undo the user's choice (#95).
 * Re-activating the tab that is already active changes nothing, so it does not re-select the folder either.
 *
 * Mount it once, in a component that stays mounted for the session: the synced key lives in a ref, so each new mount
 * syncs again, and a host that remounts (the documents panel does on every panel switch) would undo the selection.
 */
export function useActiveTabFolderSync(): void {
  const selectFolder = useUiStore((state) => state.selectFolder)
  const selectPrompt = useUiStore((state) => state.selectPrompt)
  // Reason: primitive selectors, so a tab update that changes neither field does not even re-render the host.
  const tabId = useTabStore((state) => state.activeTabId)
  const tabType = useTabStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.type)
  const promptId = useTabStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.promptId)
  const folderId = useTabStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId)?.folderId)
  const syncedKey = useRef<string | null>(null)

  useEffect(() => {
    if (tabType !== "document" || !tabId || !promptId) {
      // Reason: cleared, so returning to a document tab from a settings tab selects its folder again.
      syncedKey.current = null
      return
    }

    const key = `${tabId}:${folderId ?? ""}`
    if (syncedKey.current === key) return
    syncedKey.current = key

    // Reason: a tab opened without a folder id gets one from the loader later (updateTab), which changes the key and
    // syncs again; until then the preloaded workspace cache may know the folder.
    const resolvedFolderId = folderId ?? getPromptFromCache(promptId)?.folder_id ?? null

    // Reason: selectFolder clears selectedPrompt, so the folder is selected first and the document after it.
    if (resolvedFolderId && resolvedFolderId !== useUiStore.getState().selectedFolder) {
      selectFolder(resolvedFolderId)
    }
    selectPrompt(promptId)
  }, [tabId, tabType, promptId, folderId, selectFolder, selectPrompt])
}
