/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentPersistence.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:07 GMT+10
Last modified: 22/10/2026 10:45 GMT+10
---------------
Composes the editor's persistence hooks over one document loader: the browser draft (useDraftSync), the cache entry
and tab metadata (useDocumentCacheSync), the version restore into the editor (useVersionRestore), the manual save
(useVersionSave), which is ignored while a restore runs, and the server autosave (useServerAutoSave), which pauses
while a manual save or a restore runs.

Changelog:
22/10/2026 10:45 GMT+10 | handleRestore documented as restoring into the editor after saving unsaved edits (P7S1T8)
22/10/2026 10:31 GMT+10 | Composes useVersionRestore; restoring blocks the manual save and pauses the autosave, and
                         the persistence returns restoring and handleRestore (P7S1T8 step 1)
22/10/2026 10:22 GMT+10 | The manual save's saving flag pauses the autosave; useVersionSave takes blocked (P7S1T7)
22/10/2026 10:07 GMT+10 | Created from the persistence logic extracted from EditorPane.tsx (P7S1T7 step 1)
*/

import type { DraftStorage } from "../draft"
import type { DocumentActions } from "../document-actions"
import { useDocumentCacheSync } from "./useDocumentCacheSync"
import type { DocumentLoader } from "./useDocumentLoader"
import { useDraftSync } from "./useDraftSync"
import { useServerAutoSave } from "./useServerAutoSave"
import { useVersionRestore } from "./useVersionRestore"
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
  /** True while any autosave request is in flight. */
  autoSaving: boolean
  /** True while a restore request runs. */
  restoring: boolean
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
  /**
   * Saves the unsaved edits of a titled document, then restores a version into the editor; refuses unsaved edits
   * under a blank title.
   * @param versionId - The version to restore.
   * @returns True when the restore succeeded; false otherwise.
   */
  handleRestore(versionId: number): Promise<boolean>
}

/**
 * Runs the draft, autosave, cache, restore and manual-save logic for the open document.
 * @param options - The open document, its tab, the loader, the actions and the storage seam.
 * @returns The save and restore flags, the set-title dialog state, and the save and restore handlers.
 */
export function useDocumentPersistence(options: UseDocumentPersistenceOptions): DocumentPersistence {
  const { promptId, tabId, loader, actions, getStorage } = options
  useDraftSync({ promptId, ready: loader.ready, content: loader.content, synced: loader.synced, getStorage })
  useDocumentCacheSync({ promptId, tabId, loader })
  // Reason: the restore comes first because its `restoring` blocks the manual save and pauses the autosave: a write
  // queued behind the restore would overwrite the restored row.
  const restore = useVersionRestore({ promptId, tabId, loader, actions })
  const version = useVersionSave({ promptId, tabId, loader, actions, blocked: restore.restoring })
  // Reason: the manual save comes before the autosave because its `saving` pauses the autosave.
  const { autoSaving } = useServerAutoSave({ promptId, loader, actions, busy: version.saving || restore.restoring })

  return {
    saving: version.saving,
    autoSaving,
    restoring: restore.restoring,
    showSetTitleDialog: version.showSetTitleDialog,
    setShowSetTitleDialog: version.setShowSetTitleDialog,
    handleSave: version.handleSave,
    handleSetTitle: version.handleSetTitle,
    handleRestore: restore.handleRestore,
  }
}
