/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useVersionRestore.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:30 GMT+10
Last modified: 22/10/2026 10:44 GMT+10
---------------
The editor's version restore (contract: Async Completions and Failures, decision D4). Unsaved edits of a titled
document are saved first through `autoSavePrompt`, so the restore snapshots them; a failed save aborts the restore and
keeps them, and a blank title with unsaved edits is refused, because those edits exist only in the editor. The
restored row is applied with `applyServerState`, which replaces the working copy, the baseline, `promptData` and the
cache entry of the open document, or only the cache entry of a document the editor has left. `restoring` is true while
the restore runs; the persistence composition feeds it into the manual save's `blocked` and the autosave's `busy`.

Changelog:
22/10/2026 10:44 GMT+10 | Restores into the editor: flushes unsaved edits first, refuses a blank title with edits,
                         applies the row through applyServerState, gates on the captured document, resets restoring
                         in a finally and handles a rejected restore like a failed one (P7S1T8 step 3)
22/10/2026 10:30 GMT+10 | Created from the restore moved out of VersionHistoryDialog, behaviour unchanged (P7S1T8)
*/

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { useLatest } from "@/hooks/use-latest"
import { getDisplayTitle } from "@/features/prompts/utils"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { DocumentActions } from "../document-actions"
import { sameFields } from "../sync"
import type { DocumentLoader } from "./useDocumentLoader"

/** Shown when a restore is refused because unsaved edits under a blank title cannot be saved first. */
export const NEEDS_TITLE_TOAST =
  "Give the document a title first, so your changes are saved before a version is restored"
/** Shown when the save of the unsaved edits failed, so the restore was not sent. */
export const FLUSH_FAILED_TOAST = "Your current changes could not be saved, so nothing was restored"

/** The inputs of `useVersionRestore`. */
export interface UseVersionRestoreArgs {
  /** The open document; "" for none. */
  promptId: string
  /** The tab that shows the document. */
  tabId: string
  /** The document loader. */
  loader: DocumentLoader
  /** The document actions; a stable object, because the restore handler is built from it. */
  actions: DocumentActions
}

/** What `useVersionRestore` returns. */
export interface VersionRestore {
  /** True while a restore runs, including the save of unsaved edits before it. */
  restoring: boolean
  /**
   * Restores the open document to a version, after saving its unsaved edits.
   * @param versionId - The version to restore.
   * @returns True when the restore succeeded; false when it was refused, failed or rejected, or when the loader does
   *   not hold this document's baseline.
   */
  handleRestore(versionId: number): Promise<boolean>
}

/**
 * Saves the unsaved edits of the working copy so the restore snapshots them.
 * @returns False when the restore must not run: the title is blank, or the save failed. Rejects when the save rejects.
 */
async function flushUnsaved(id: string, loader: DocumentLoader, actions: DocumentActions): Promise<boolean> {
  const { title, content, synced } = loader
  if (synced === null || sameFields({ title, content }, synced)) return true
  if (!title?.trim()) {
    toast.error(NEEDS_TITLE_TOAST)
    return false
  }
  const saved = await actions.autoSavePrompt({ promptId: id, title, content })
  if (!saved.success) {
    toast.error(FLUSH_FAILED_TOAST)
    return false
  }
  loader.markSynced({ promptId: id, title, content })
  return true
}

/**
 * Provides the version restore for the open document.
 * @param args - The open document, its tab, the loader and the actions.
 * @returns Whether a restore runs, and the restore handler.
 */
export function useVersionRestore({ promptId, tabId, loader, actions }: UseVersionRestoreArgs): VersionRestore {
  const [restoring, setRestoring] = useState(false)
  const restoringRef = useRef(false)
  const loaderRef = useLatest(loader)
  const updateTab = useTabStore((s) => s.updateTab)
  const updatePromptTitle = useUiStore((s) => s.updatePromptTitle)
  const triggerPromptRefetch = useUiStore((s) => s.triggerPromptRefetch)

  const handleRestore = useCallback(
    async (versionId: number): Promise<boolean> => {
      const current = loaderRef.current
      // Reason: the same guards as a save; a callback left over from another document (or a render in which
      // `loaderRef` still holds the previous document's loader) must neither flush nor restore.
      if (!current.ready || current.synced?.promptId !== promptId || restoringRef.current) return false
      restoringRef.current = true
      setRestoring(true)
      try {
        if (!(await flushUnsaved(promptId, current, actions))) return false
        const result = await actions.restorePromptVersion({ promptId, versionId })
        if (!result.success) {
          toast.error(result.error)
          return false
        }
        // Reason: false when the editor has moved on; the cache entry is replaced either way, so a later open shows
        // it. The tab and list entries named by the captured ids belong to the restored document, so they follow.
        current.applyServerState(promptId, result.data)
        toast.success("Version restored")
        updatePromptTitle(promptId, result.data.title ?? "")
        updateTab(tabId, { title: getDisplayTitle(result.data.title), isDirty: false })
        triggerPromptRefetch()
        return true
      } catch (error) {
        console.error("[restore] rejected for", promptId, error)
        toast.error("The version could not be restored")
        return false
      } finally {
        restoringRef.current = false
        setRestoring(false)
      }
    },
    [actions, loaderRef, promptId, tabId, triggerPromptRefetch, updatePromptTitle, updateTab]
  )

  return { restoring, handleRestore }
}
