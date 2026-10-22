/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentPersistence.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:07 GMT+10
Last modified: 22/10/2026 10:07 GMT+10
---------------
Composes the editor's persistence hooks over one document loader: the browser draft (useDraftSync), the server
autosave (useServerAutoSave), the cache entry and tab metadata (useDocumentCacheSync) and the manual save
(useVersionSave).

Changelog:
22/10/2026 10:07 GMT+10 | Created from the persistence logic extracted from EditorPane.tsx (P7S1T7 step 1)
*/

import type { DraftStorage } from "../draft"
import type { DocumentActions } from "../document-actions"
import { useDocumentCacheSync } from "./useDocumentCacheSync"
import type { DocumentLoader } from "./useDocumentLoader"
import { useDraftSync } from "./useDraftSync"
import { useServerAutoSave } from "./useServerAutoSave"
import { useVersionSave } from "./useVersionSave"

/** The inputs of `useDocumentPersistence`. */
export interface UseDocumentPersistenceOptions {
  /** The open document; "" for none. */
  promptId: string
  /** The tab that shows the document. */
  tabId: string
  /** The document loader; only its fields are read, so a new object each render re-runs nothing. */
  loader: DocumentLoader
  /** The document actions; a module-level constant, because the handlers are built from it. */
  actions: DocumentActions
  /** Returns the draft storage; called inside effects only. */
  getStorage(): DraftStorage | null
}

/** What the editor renders and wires from `useDocumentPersistence`. */
export interface DocumentPersistence {
  /** True while a manual save runs. */
  saving: boolean
  /** True while the last autosave started has not completed. */
  autoSaving: boolean
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
 * Runs the draft, autosave, cache and manual-save logic for the open document.
 * @param options - The open document, its tab, the loader, the actions and the storage seam.
 * @returns The save flags, the set-title dialog state and the save handlers.
 */
export function useDocumentPersistence(options: UseDocumentPersistenceOptions): DocumentPersistence {
  const { promptId, tabId, loader, actions, getStorage } = options
  // Reason: the hooks run in the order EditorPane ran their code (draft, autosave, cache, manual save), so their
  // effects keep the order they had there.
  useDraftSync({ promptId, ready: loader.ready, content: loader.content, synced: loader.synced, getStorage })
  const { autoSaving } = useServerAutoSave({ promptId, loader, actions })
  useDocumentCacheSync({ promptId, tabId, loader })
  const version = useVersionSave({ promptId, tabId, loader, actions })

  return {
    saving: version.saving,
    autoSaving,
    showSetTitleDialog: version.showSetTitleDialog,
    setShowSetTitleDialog: version.setShowSetTitleDialog,
    handleSave: version.handleSave,
    handleSetTitle: version.handleSetTitle,
  }
}
