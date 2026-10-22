/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useVersionSave.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:06 GMT+10
Last modified: 22/10/2026 10:22 GMT+10
---------------
The editor's manual save: the Save Version button, the Ctrl+S (Cmd+S) listener and the set-title dialog that opens
when the working title is blank or a placeholder. One `saveVersion(title)` serves all three; it is single-flight,
ignored while blocked, sends nothing unless the loader holds the baseline of its own document, and applies its result
to the document it started with. Sends the write through the injected `saveNewVersion`.

Changelog:
22/10/2026 10:22 GMT+10 | Fixed the set-title save (#36): one saveVersion(title) for Ctrl+S, the button and the
                         dialog; single-flight; blocked; same-document gating; finally resets saving (P7S1T7 step 3)
22/10/2026 10:06 GMT+10 | Extracted unchanged from EditorPane.tsx (P7S1T7 step 1)
*/

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"
import { toast } from "sonner"
import { useLatest } from "@/hooks/use-latest"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import { titleValidationSchema } from "@/features/prompts/schemas"
import type { DocumentActions } from "../document-actions"
import type { DocumentLoader } from "./useDocumentLoader"

/** The message shown when a save request rejects or times out. */
export const SAVE_REJECTED_TOAST = "The version could not be saved"

/** The inputs of `useVersionSave`. */
export interface UseVersionSaveArgs {
  /** The open document; "" for none. */
  promptId: string
  /** The tab that shows the document. */
  tabId: string
  /** The document loader; read through a ref in the handlers, so a new object each render re-runs nothing. */
  loader: DocumentLoader
  /** The document actions; a stable object, because the save handler is built from it. */
  actions: DocumentActions
  /** True while a restore runs: a save would be queued behind it and overwrite the restored row, so it is ignored. */
  blocked: boolean
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
   * Makes the confirmed title the working title, closes the dialog and saves with that title.
   * @param title - The title the user confirmed.
   */
  handleSetTitle(title: string): void
}

/**
 * Whether a save for `promptId` may start now.
 * @param loader - The loader of the last committed render.
 * @param promptId - The document the save callback was built for.
 * @param busy - True while a save runs or a restore blocks it.
 * @returns True when the loader is ready with the baseline of `promptId` and nothing else runs.
 */
function maySave(loader: DocumentLoader, promptId: string, busy: boolean): boolean {
  // Reason: `ready` says the loader's document is applied; the baseline must also be THIS callback's document, or a
  // callback left over from another document would store the open document's text under that document's id.
  return loader.ready && loader.synced?.promptId === promptId && !busy
}

/** Registers the Ctrl+S (Cmd+S) listener on the window; it calls the latest handler through the ref. */
function useSaveShortcut(handlerRef: MutableRefObject<() => void>): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handlerRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlerRef])
}

/**
 * Provides the manual save, the set-title dialog state and the Ctrl+S listener for the open document.
 * @param args - The open document, its tab, the loader, the actions and whether a restore blocks saving.
 * @returns The save state, the dialog state and the handlers.
 */
export function useVersionSave({ promptId, tabId, loader, actions, blocked }: UseVersionSaveArgs): VersionSave {
  const [saving, setSaving] = useState(false)
  const [showSetTitleDialog, setShowSetTitleDialog] = useState(false)
  const savingRef = useRef(false)
  const loaderRef = useLatest(loader)
  const blockedRef = useLatest(blocked)
  const updateTab = useTabStore((s) => s.updateTab)
  const triggerPromptRefetch = useUiStore((s) => s.triggerPromptRefetch)

  const saveVersion = useCallback(
    async (titleToSave: string | null) => {
      const current = loaderRef.current
      if (!maySave(current, promptId, savingRef.current || blockedRef.current)) return
      const valid = titleValidationSchema.safeParse(titleToSave)
      if (!valid.success) {
        setShowSetTitleDialog(true)
        return
      }
      const sent = current.content
      savingRef.current = true
      setSaving(true)
      try {
        const result = await actions.saveNewVersion({ promptId, newTitle: valid.data, newContent: sent })
        if (!result.success) {
          toast.error(result.error, { duration: 6000 })
          return
        }
        toast.success("Version saved successfully")
        // Reason: edits typed during the request are not in `sent`; they stay in the editor and keep their draft. The
        // tab's dirty flag follows whether this document is still open; otherwise its next open recomputes it.
        const stillOpen = current.markSynced({ promptId, title: valid.data, content: sent }, { version: true })
        updateTab(tabId, stillOpen ? { isDirty: false, isNewDocument: false } : { isNewDocument: false })
        triggerPromptRefetch()
      } catch (error) {
        console.error("[save] rejected for", promptId, error)
        toast.error(SAVE_REJECTED_TOAST, { duration: 6000 })
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    },
    [actions, blockedRef, loaderRef, promptId, tabId, triggerPromptRefetch, updateTab]
  )

  const handleSave = useCallback(() => {
    void saveVersion(loaderRef.current.title)
  }, [loaderRef, saveVersion])

  const handleSetTitle = useCallback(
    (newTitle: string) => {
      // Reason: the confirmed title becomes the working title and is passed to the save, so nothing waits on state.
      loaderRef.current.setTitle(newTitle)
      setShowSetTitleDialog(false)
      void saveVersion(newTitle)
    },
    [loaderRef, saveVersion]
  )

  const handleSaveRef = useLatest(handleSave)
  useSaveShortcut(handleSaveRef)

  return { saving, showSetTitleDialog, setShowSetTitleDialog, handleSave, handleSetTitle }
}
