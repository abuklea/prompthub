/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useVersionSave.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:06 GMT+10
Last modified: 22/10/2026 10:06 GMT+10
---------------
The editor's manual save: the Save Version button, the Ctrl+S (Cmd+S) listener and the set-title dialog that opens
when the working title is blank or a placeholder. Sends the write through the injected `saveNewVersion`.

Changelog:
22/10/2026 10:06 GMT+10 | Extracted unchanged from EditorPane.tsx (P7S1T7 step 1)
*/

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import { titleValidationSchema } from "@/features/prompts/schemas"
import type { DocumentActions } from "../document-actions"
import type { DocumentLoader } from "./useDocumentLoader"

/** The inputs of `useVersionSave`. */
export interface UseVersionSaveArgs {
  /** The open document; "" for none. */
  promptId: string
  /** The tab that shows the document. */
  tabId: string
  /** The document loader; only its fields are read, so a new object each render re-runs nothing. */
  loader: DocumentLoader
  /** The document actions; a stable object, because the save handler is built from it. */
  actions: DocumentActions
}

/** What `useVersionSave` returns. */
export interface VersionSave {
  /** True while a manual save runs. */
  saving: boolean
  /** Whether the set-title dialog is open. */
  showSetTitleDialog: boolean
  /**
   * Opens or closes the set-title dialog.
   * @param open - True to open it.
   */
  setShowSetTitleDialog(open: boolean): void
  /** Saves a version of the working copy, or opens the set-title dialog when the working title is not valid. */
  handleSave(): void
  /**
   * Makes the confirmed title the working title, closes the dialog and starts a save.
   * @param title - The title the user confirmed.
   */
  handleSetTitle(title: string): void
}

/**
 * Provides the manual save, the set-title dialog state and the Ctrl+S listener for the open document.
 * @param args - The open document, its tab, the loader and the actions.
 * @returns The save state, the dialog state and the handlers.
 */
export function useVersionSave({ promptId, tabId, loader, actions }: UseVersionSaveArgs): VersionSave {
  const [saving, setSaving] = useState(false)
  const [showSetTitleDialog, setShowSetTitleDialog] = useState(false)
  const updateTab = useTabStore((s) => s.updateTab)
  const triggerPromptRefetch = useUiStore((s) => s.triggerPromptRefetch)
  const { title, content, setTitle, markSynced } = loader

  const handleSave = useCallback(async () => {
    if (!promptId) return

    const titleResult = titleValidationSchema.safeParse(title)
    if (!titleResult.success) {
      setShowSetTitleDialog(true)
      return
    }

    setSaving(true)
    const result = await actions.saveNewVersion({
      promptId,
      // Reason: the schema has no transform, so its output is `title` itself, narrowed to a string.
      newTitle: titleResult.data,
      newContent: content,
    })

    if (result.success) {
      toast.success("Version saved successfully")
      markSynced({ promptId, title, content }, { version: true })
      updateTab(tabId, { isDirty: false, isNewDocument: false })
      triggerPromptRefetch()
    } else {
      toast.error(result.error, { duration: 6000 })
    }
    setSaving(false)
  }, [actions, promptId, title, content, tabId, updateTab, triggerPromptRefetch, markSynced])

  const handleSetTitle = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      setShowSetTitleDialog(false)
      // Reason: known defect #36, kept by this extraction: the timer calls this render's handleSave, whose closure
      // still holds the previous title, so the confirmed title is not the one validated and sent.
      setTimeout(() => handleSave(), 0)
    },
    [handleSave, setTitle]
  )

  // Keyboard listener for Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave])

  return { saving, showSetTitleDialog, setShowSetTitleDialog, handleSave, handleSetTitle }
}
