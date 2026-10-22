/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useServerAutoSave.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 22/10/2026 10:06 GMT+10
Last modified: 22/10/2026 10:22 GMT+10
---------------
The editor's server autosave: arms `useAutoSave` for the open document while it is ready and no save or restore runs,
and sends the write through the injected `autoSavePrompt`, recording a confirmed write with `markSynced` for the
document the write started with.

Changelog:
22/10/2026 10:22 GMT+10 | busy pauses the autosave; requests in flight are counted; a rejected write is handled like a
                         failed one and the flag resets in a finally block (P7S1T7 step 3)
22/10/2026 10:06 GMT+10 | Extracted unchanged from EditorPane.tsx (P7S1T7 step 1)
*/

import { useCallback, useRef, useState } from "react"
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
  /** True while a manual save or a restore runs: a pending write is cancelled and none is armed. */
  busy: boolean
}

/** What `useServerAutoSave` returns. */
export interface ServerAutoSave {
  /** True while any autosave request is in flight. */
  autoSaving: boolean
}

/**
 * Autosaves the open document's working copy once it differs from the baseline under a non-blank title. A failed or
 * rejected write is logged and not retried; a write that completes after a switch updates only its own document.
 * @param args - The open document, the loader, the actions and whether a save or restore runs.
 * @returns Whether an autosave is in flight.
 */
export function useServerAutoSave({ promptId, loader, actions, busy }: UseServerAutoSaveArgs): ServerAutoSave {
  const [autoSaving, setAutoSaving] = useState(false)
  const inFlight = useRef(0)
  const updatePromptTitle = useUiStore((s) => s.updatePromptTitle)
  const { title, content, ready, synced, markSynced } = loader

  const handleAutoSave = useCallback(
    async (id: string, savedTitle: string | null, savedContent: string) => {
      inFlight.current += 1
      setAutoSaving(true)
      try {
        const result = await actions.autoSavePrompt({ promptId: id, title: savedTitle ?? "", content: savedContent })
        if (!result.success) {
          console.error("[autosave] failed for", id, result.error)
          return
        }
        // Reason: `id` is the document the write started with; markSynced applies to React state only while it is
        // still open, and the list title targets it whichever document is open now.
        markSynced({ promptId: id, title: savedTitle, content: savedContent })
        updatePromptTitle(id, savedTitle ?? "")
      } catch (error) {
        console.error("[autosave] rejected for", id, error)
      } finally {
        inFlight.current -= 1
        setAutoSaving(inFlight.current > 0)
      }
    },
    [actions, updatePromptTitle, markSynced]
  )

  useAutoSave({
    title,
    content,
    // Reason: a null promptId while busy cancels a pending write, so no autosave of the pre-save or pre-restore
    // working copy is queued behind the request; the effect re-evaluates when the busy state ends.
    promptId: ready && !busy ? promptId : null,
    baseline: synced,
    onSave: handleAutoSave,
  })

  return { autoSaving }
}
