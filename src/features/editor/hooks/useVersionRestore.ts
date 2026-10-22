/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useVersionRestore.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:30 GMT+10
Last modified: 22/10/2026 10:30 GMT+10
---------------
The editor's version restore: sends the restore through the injected `restorePromptVersion`, reports the result with a
toast and asks the prompt list to refetch on success. `restoring` is true while the request runs; the persistence
composition feeds it into the manual save's `blocked` and the autosave's `busy`. The editor keeps showing the text it
had before the restore.

Changelog:
22/10/2026 10:30 GMT+10 | Created from the restore moved out of VersionHistoryDialog, behaviour unchanged (P7S1T8)
*/

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useUiStore } from "@/stores/use-ui-store"
import type { DocumentActions } from "../document-actions"
import type { DocumentLoader } from "./useDocumentLoader"

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
  /** True while a restore request runs. */
  restoring: boolean
  /**
   * Restores the open document to a version.
   * @param versionId - The version to restore.
   * @returns True when the restore succeeded; false when it failed or there is no open document.
   */
  handleRestore(versionId: number): Promise<boolean>
}

/**
 * Provides the version restore for the open document.
 * @param args - The open document, its tab, the loader and the actions.
 * @returns Whether a restore runs, and the restore handler.
 */
export function useVersionRestore({ promptId, actions }: UseVersionRestoreArgs): VersionRestore {
  const [restoring, setRestoring] = useState(false)
  const triggerPromptRefetch = useUiStore((s) => s.triggerPromptRefetch)

  const handleRestore = useCallback(
    async (versionId: number): Promise<boolean> => {
      if (!promptId) return false
      setRestoring(true)
      const result = await actions.restorePromptVersion({ promptId, versionId })
      if (!result.success) {
        toast.error(result.error)
        setRestoring(false)
        return false
      }
      toast.success("Version restored")
      setRestoring(false)
      triggerPromptRefetch()
      return true
    },
    [actions, promptId, triggerPromptRefetch]
  )

  return { restoring, handleRestore }
}
