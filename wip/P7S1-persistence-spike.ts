/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-persistence-spike.ts
MIME: text/typescript
Type: TypeScript React hooks (research spike, not imported by the application)

Created: 20/10/2026 13:12 GMT+10
Last modified: 20/10/2026 14:23 GMT+10
---------------
P7S1 research spike for tasks T6 to T8. The hooks that sit between the document loader (wip/P7S1-loader-spike.ts) and the
server actions: useAutoSave, useServerAutoSave, useVersionSave, useVersionRestore, useDocumentCacheSync and their
composition useDocumentPersistence, over the real zustand stores and injected actions. Every async completion is
gated on the document it started for, every busy flag is reset in a finally block, and a rejected action is handled like
a failed one. It exists to prove the contract in PRPs/docs/P7S1-editor-persistence-contracts.md with
wip/P7S1-persistence-spike.test.tsx before the production hooks are written. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-persistence-spike.test.tsx

Changelog:
20/10/2026 14:23 GMT+10 | getPromptVersionHistory joins DocumentActions and withActionTimeout, for the history dialog
20/10/2026 13:56 GMT+10 | withActionTimeout; the restore flushes through autoSavePrompt and refuses a blank title with unsaved edits
20/10/2026 13:20 GMT+10 | Added the same-document gating of the cache sync after the review; no other change since creation
20/10/2026 13:12 GMT+10 | Created
*/

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/types/actions"
import { titleValidationSchema } from "@/features/prompts/schemas"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"
import { getDisplayTitle } from "@/features/prompts/utils"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import { needsAutoSave, sameFields, useDraftSync, withTimeout, type DraftStorage, type SyncedState } from "./P7S1-draft-spike"
import { setDocumentCacheEntry, useLatest, type DocumentLoader } from "./P7S1-loader-spike"

export const AUTOSAVE_DELAY_MS = 500

export interface DocumentActions {
  saveNewVersion(input: { promptId: string; newTitle: string; newContent: string }): Promise<ActionResult<{ versionId: number }>>
  autoSavePrompt(input: { promptId: string; title: string; content: string }): Promise<ActionResult<void>>
  restorePromptVersion(input: {
    promptId: string
    versionId: number
  }): Promise<ActionResult<{ title: string | null; content: string }>>
  /** Read by the history dialog, not by the hooks below; kept here so one wrapper limits every request. */
  getPromptVersionHistory(input: { promptId: string }): Promise<ActionResult<PromptVersionHistoryItem[]>>
}

/** EditorPane's module-level `documentActions`: the real actions, each limited to the request timeout. */
export function withActionTimeout(actions: DocumentActions, ms?: number): DocumentActions {
  return {
    saveNewVersion: (input) => withTimeout(actions.saveNewVersion(input), ms),
    autoSavePrompt: (input) => withTimeout(actions.autoSavePrompt(input), ms),
    restorePromptVersion: (input) => withTimeout(actions.restorePromptVersion(input), ms),
    getPromptVersionHistory: (input) => withTimeout(actions.getPromptVersionHistory(input), ms),
  }
}

// ---- hooks/useAutoSave.ts (T6) ----

export interface UseAutoSaveOptions {
  /** null disables the hook and cancels a pending write. */
  promptId: string | null
  title: string | null
  content: string
  /** What the server holds; a write is due only while the working copy of `promptId` differs from it. */
  baseline: SyncedState | null
  delay?: number
  onSave(promptId: string, title: string | null, content: string): void
}

export function useAutoSave({ promptId, title, content, baseline, delay = AUTOSAVE_DELAY_MS, onSave }: UseAutoSaveOptions): void {
  // Reason: a caller that builds a new onSave each render must not re-arm the debounce.
  const onSaveRef = useLatest(onSave)
  useEffect(() => {
    if (!promptId || !needsAutoSave(promptId, { title, content }, baseline)) return
    const timer = setTimeout(() => onSaveRef.current(promptId, title, content), delay)
    return () => clearTimeout(timer)
  }, [promptId, title, content, baseline, delay, onSaveRef])
}

// ---- hooks/useServerAutoSave.ts (T7) ----

export interface UseServerAutoSaveArgs {
  promptId: string
  loader: DocumentLoader
  actions: DocumentActions
  /** True while a manual save or a restore runs: a pending write is cancelled and none is armed. */
  busy: boolean
}

export function useServerAutoSave({ promptId, loader, actions, busy }: UseServerAutoSaveArgs): { autoSaving: boolean } {
  const [autoSaving, setAutoSaving] = useState(false)
  const inFlight = useRef(0)
  const updatePromptTitle = useUiStore((s) => s.updatePromptTitle)
  const { markSynced } = loader

  const onSave = useCallback(
    async (id: string, title: string | null, content: string) => {
      inFlight.current += 1
      setAutoSaving(true)
      try {
        const result = await actions.autoSavePrompt({ promptId: id, title: title ?? "", content })
        if (!result.success) {
          console.error("[autosave] failed for", id, result.error)
          return
        }
        markSynced({ promptId: id, title, content })
        updatePromptTitle(id, title ?? "")
      } catch (error) {
        console.error("[autosave] rejected for", id, error)
      } finally {
        inFlight.current -= 1
        setAutoSaving(inFlight.current > 0)
      }
    },
    [actions, markSynced, updatePromptTitle]
  )

  useAutoSave({
    promptId: loader.ready && !busy ? promptId : null,
    title: loader.title,
    content: loader.content,
    baseline: loader.synced,
    onSave,
  })
  return { autoSaving }
}

// ---- hooks/useVersionSave.ts (T7) ----

export interface UseVersionSaveArgs {
  promptId: string
  tabId: string
  loader: DocumentLoader
  actions: DocumentActions
  /** True while a restore runs: a save would be queued behind it and overwrite the restored row. */
  blocked: boolean
}

export interface VersionSave {
  saving: boolean
  showSetTitleDialog: boolean
  setShowSetTitleDialog(open: boolean): void
  handleSave(): void
  handleSetTitle(title: string): void
}

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
      // Reason: a save while the document is not ready would store the previous document's text under this id.
      if (!current.ready || savingRef.current || blockedRef.current) return
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
        // Reason: edits typed during the request are not in `sent`; they stay in the editor and keep their draft.
        const stillOpen = current.markSynced({ promptId, title: valid.data, content: sent }, { version: true })
        updateTab(tabId, stillOpen ? { isDirty: false, isNewDocument: false } : { isNewDocument: false })
        triggerPromptRefetch()
      } catch (error) {
        console.error("[save] rejected for", promptId, error)
        toast.error("The version could not be saved", { duration: 6000 })
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
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleSaveRef])

  return { saving, showSetTitleDialog, setShowSetTitleDialog, handleSave, handleSetTitle }
}

// ---- hooks/useVersionRestore.ts (T8) ----

export interface UseVersionRestoreArgs {
  promptId: string
  tabId: string
  loader: DocumentLoader
  actions: DocumentActions
}

export const NEEDS_TITLE_TOAST = "Give the document a title first, so your changes are saved before a version is restored"
export const FLUSH_FAILED_TOAST = "Your current changes could not be saved, so nothing was restored"

/**
 * Saves the unsaved edits of the working copy so the restore snapshots them. False aborts the restore and keeps them:
 * a blank title cannot be autosaved, so the edits would exist only in the editor and a restore would replace them.
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

export function useVersionRestore({ promptId, tabId, loader, actions }: UseVersionRestoreArgs) {
  const [restoring, setRestoring] = useState(false)
  const restoringRef = useRef(false)
  const loaderRef = useLatest(loader)
  const updateTab = useTabStore((s) => s.updateTab)
  const updatePromptTitle = useUiStore((s) => s.updatePromptTitle)
  const triggerPromptRefetch = useUiStore((s) => s.triggerPromptRefetch)

  const handleRestore = useCallback(
    async (versionId: number): Promise<boolean> => {
      const current = loaderRef.current
      if (!current.ready || restoringRef.current) return false
      restoringRef.current = true
      setRestoring(true)
      try {
        if (!(await flushUnsaved(promptId, current, actions))) return false
        const result = await actions.restorePromptVersion({ promptId, versionId })
        if (!result.success) {
          toast.error(result.error)
          return false
        }
        // Reason: false when the editor has moved on; the cache entry is replaced either way, so a later open shows it.
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

// ---- hooks/useDocumentCacheSync.ts (T7) ----

export function useDocumentCacheSync({ promptId, tabId, loader }: { promptId: string; tabId: string; loader: DocumentLoader }): void {
  const updateTab = useTabStore((s) => s.updateTab)
  const promotePreviewTab = useTabStore((s) => s.promotePreviewTab)
  const { ready, promptData, synced, title, content, lastSaved, currentUserId } = loader

  useEffect(() => {
    // Reason: only a ready document is written, so the cache never holds one document's text under another's id.
    if (!ready || !promptData || !synced) return
    const isDirty = content !== promptData.content
    setDocumentCacheEntry(currentUserId, promptId, { promptData, title, content, lastSaved, synced })
    const tab = useTabStore.getState().tabs.find((t) => t.id === tabId)
    if (isDirty && tab?.isPreview) promotePreviewTab(tabId)
    updateTab(tabId, { title: getDisplayTitle(title), folderId: promptData.folder.id, isDirty })
  }, [ready, promptData, synced, title, content, lastSaved, currentUserId, promptId, tabId, updateTab, promotePreviewTab])
}

// ---- hooks/useDocumentPersistence.ts (T7, T8) ----

export interface UseDocumentPersistenceOptions {
  promptId: string
  tabId: string
  loader: DocumentLoader
  /** A module-level constant: a new object each render would rebuild every callback built from it. */
  actions: DocumentActions
  getStorage(): DraftStorage | null
}

export interface DocumentPersistence {
  saving: boolean
  autoSaving: boolean
  restoring: boolean
  showSetTitleDialog: boolean
  setShowSetTitleDialog(open: boolean): void
  handleSave(): void
  handleSetTitle(title: string): void
  handleRestore(versionId: number): Promise<boolean>
}

export function useDocumentPersistence({ promptId, tabId, loader, actions, getStorage }: UseDocumentPersistenceOptions): DocumentPersistence {
  useDraftSync({ promptId, ready: loader.ready, content: loader.content, synced: loader.synced, getStorage })
  useDocumentCacheSync({ promptId, tabId, loader })
  const restore = useVersionRestore({ promptId, tabId, loader, actions })
  const version = useVersionSave({ promptId, tabId, loader, actions, blocked: restore.restoring })
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
