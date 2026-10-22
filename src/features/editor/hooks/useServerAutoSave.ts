/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useServerAutoSave.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:06 GMT+10
Last modified: 22/10/2026 10:06 GMT+10
---------------
The editor's server autosave: arms `useAutoSave` for the open document while it is ready and sends the write through
the injected `autoSavePrompt`, recording a confirmed write with `markSynced`.

Changelog:
22/10/2026 10:06 GMT+10 | Extracted unchanged from EditorPane.tsx (P7S1T7 step 1)
*/

import { useCallback, useState } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import type { DocumentActions } from "../document-actions"
import { useAutoSave } from "./useAutoSave"
import type { DocumentLoader } from "./useDocumentLoader"

/** The inputs of `useServerAutoSave`. */
export interface UseServerAutoSaveArgs {
  /** The open document; "" for none. */
  promptId: string
  /** The document loader; only its fields are read, so a new object each render re-runs nothing. */
  loader: DocumentLoader
  /** The document actions; a stable object, because the save handler is built from it. */
  actions: DocumentActions
}

/** What `useServerAutoSave` returns. */
export interface ServerAutoSave {
  /** True while the last autosave started has not completed. */
  autoSaving: boolean
}

/**
 * Autosaves the open document's working copy once it differs from the baseline under a non-blank title. A failed
 * write is logged and not retried.
 * @param args - The open document, the loader and the actions.
 * @returns Whether an autosave is running.
 */
export function useServerAutoSave({ promptId, loader, actions }: UseServerAutoSaveArgs): ServerAutoSave {
  const [autoSaving, setAutoSaving] = useState(false)
  const updatePromptTitle = useUiStore((s) => s.updatePromptTitle)
  const { title, content, ready, synced, markSynced } = loader

  const handleAutoSave = useCallback(
    async (pid: string, t: string | null, c: string) => {
      setAutoSaving(true)
      const result = await actions.autoSavePrompt({ promptId: pid, title: t || "", content: c })
      if (result.success) {
        markSynced({ promptId: pid, title: t, content: c })
        updatePromptTitle(pid, t || "")
      } else {
        console.error("[EditorPane] Auto-save FAILED for:", pid, result.error)
      }
      setAutoSaving(false)
    },
    [actions, updatePromptTitle, markSynced]
  )

  useAutoSave({
    title,
    content,
    promptId: ready ? promptId : null,
    baseline: synced,
    onSave: handleAutoSave,
  })

  return { autoSaving }
}
