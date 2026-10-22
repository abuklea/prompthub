/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/EditorPane.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:41 GMT+10
Last modified: 22/10/2026 10:22 GMT+10
---------------
Editor pane component for the right section of the 3-pane layout.
Displays selected prompt details and provides editing interface with Monaco Editor.
Composes the document loader with useDocumentPersistence: autosave against the baseline (500ms debounce), browser
drafts, the cache and tab metadata, and the manual save (Ctrl+S).

Changelog:
22/10/2026 10:22 GMT+10 | documentActions runs each action under the request timeout (withActionTimeout, P7S1T7)
22/10/2026 10:07 GMT+10 | Save, autosave, draft and cache/tab logic moved into useDocumentPersistence and its hooks;
                         module-level documentActions injects the real actions (P7S1T7 step 1)
22/10/2026 09:41 GMT+10 | Drafts written by useDraftSync in place of the old local-storage hook; autosave takes the
                         baseline (P7S1T6)
22/10/2026 09:17 GMT+10 | Renders from viewState and saveStatus, gates on loader.ready, records saves with markSynced;
                         no cache re-exports (P7S1T5 step 3)
22/10/2026 08:57 GMT+10 | Defines the module-level loaderIo and passes it to useDocumentLoader (P7S1T5 step 1)
17/07/2026 10:00 GMT+10 | F5: Extracted VersionHistoryDialog and useDocumentLoader to reduce file size
11/11/2025 21:15 GMT+10 | CRITICAL P0 CACHE CONTAMINATION FIX: Added titlePromptIdRef to prevent cache updates with stale title from previous document
11/11/2025 20:35 GMT+10 | CRITICAL P0 DATA DESTRUCTION FIX #2: Read localStorage directly to prevent stale localContent contamination during restoration
11/11/2025 18:18 GMT+10 | CRITICAL P0 DATA DESTRUCTION FIX: Added monacoPromptIdRef guard to prevent onChange contamination during unmount
09/11/2025 17:20 GMT+10 | CRITICAL RACE CONDITION FIX: Implemented P5S5T1-T5 fixes for document contamination
09/11/2025 16:09 GMT+10 | CRITICAL BUG FIX: Implemented P0/P1 fixes for content cross-contamination (P0T1-P0T3, P1T4-P1T5)
08/11/2025 15:19 GMT+10 | Wrapped console.log statements with development-only guards (P5S4T5)
08/11/2025 15:17 GMT+10 | PERFORMANCE: Added ref guard to prevent duplicate database loads in React Strict Mode (P5S4T4)
08/11/2025 15:15 GMT+10 | SECURITY FIX: Added user-scoped cache with userId validation and logout clearing (P5S4T2)
08/11/2025 13:45 GMT+10 | CRITICAL FIX: Resolved infinite loop in tab update useEffect by removing 'tabs' dependency
08/11/2025 13:40 GMT+10 | Added auto-promotion of preview tabs to permanent when edited (P5S4dT3)
08/11/2025 13:06 GMT+10 | Refactored to accept promptId and tabId props for tab system integration (P5S4cT7)
07/11/2025 16:17 GMT+10 | Integrated auto-save, localStorage, and Ctrl+S manual save (P5S3bT14)
07/11/2025 16:07 GMT+10 | Restructured layout for full-height Monaco editor (P5S3bT3)
07/11/2025 14:21 GMT+10 | Added save functionality with Editor component integration (P5S3T4)
07/11/2025 13:41 GMT+10 | Initial creation with prompt details fetching
*/

"use client"

import { useState, useCallback } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { saveNewVersion, autoSavePrompt } from "@/features/editor/actions"
import { SetTitleDialog } from "@/features/prompts/components/SetTitleDialog"
import { useDocumentLoader, type DocumentLoaderIo } from "@/features/editor/hooks/useDocumentLoader"
import { useDocumentPersistence } from "@/features/editor/hooks/useDocumentPersistence"
import { withActionTimeout } from "@/features/editor/document-actions"
import { getPromptDetails, getPromptVersionHistory, restorePromptVersion } from "@/features/prompts/actions"
import { createClient } from "@/lib/supabase/client"
import { withTimeout } from "@/features/editor/request-timeout"
import { ANONYMOUS } from "@/features/editor/document-cache"
import { getBrowserStorage } from "@/features/editor/draft"
import { saveStatus, viewState } from "@/features/editor/sync"
import { VersionHistoryDialog } from "./VersionHistoryDialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Editor } from "@/features/editor"

interface EditorPaneProps {
  promptId: string
  tabId: string
}

/**
 * The loader's real io. Module-level, so its identity never changes and a re-render cannot re-run the load effects.
 * The user id is looked up on every mount and never remembered.
 */
const loaderIo: DocumentLoaderIo = {
  fetchPrompt: (promptId) => withTimeout(getPromptDetails({ promptId })),
  getUserId: async () => {
    try {
      const { data } = await createClient().auth.getUser()
      return data.user?.id ?? ANONYMOUS
    } catch {
      // Reason: a failed lookup must not leave the identity unset; it falls back to the uncached anonymous identity.
      return ANONYMOUS
    }
  },
  getStorage: getBrowserStorage,
}

/**
 * The real document actions, each under the request timeout, injected into the persistence hooks. Module-level, so
 * its identity never changes and the handlers built from it are not rebuilt on every render.
 */
const documentActions = withActionTimeout({
  saveNewVersion, autoSavePrompt, restorePromptVersion, getPromptVersionHistory,
})

export function EditorPane({ promptId, tabId }: EditorPaneProps) {
  const triggerPromptRefetch = useUiStore((s) => s.triggerPromptRefetch)
  const loader = useDocumentLoader({ promptId, io: loaderIo })
  const { title, content, loading, error, lastSaved, synced, ready, monacoPromptIdRef, setTitle, setContent } = loader
  const [historyOpen, setHistoryOpen] = useState(false)
  const { saving, autoSaving, showSetTitleDialog, setShowSetTitleDialog, handleSave, handleSetTitle } =
    useDocumentPersistence({ promptId, tabId, loader, actions: documentActions, getStorage: getBrowserStorage })

  const handleVersionRestored = useCallback(() => {
    triggerPromptRefetch()
  }, [triggerPromptRefetch])

  const view = viewState({ promptId, error, loading, ready })
  const status = saveStatus({ autoSaving, working: { title, content }, synced })

  if (view === "empty") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a prompt to edit or create a new one</p>
      </div>
    )
  }

  if (view === "error") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  // Reason: only a ready document mounts the editor, so Monaco never first renders another document's text.
  if (view === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt...</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Title Section */}
        <div className="flex-none p-4 space-y-2 border-b overflow-hidden">
          <Label htmlFor="prompt-title">Title</Label>
          <Input
            id="prompt-title"
            value={title || ""}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter prompt title..."
            className="text-lg font-semibold w-full"
          />
        </div>

        {/* Editor Section */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 h-full">
            <Editor
              key={promptId}
              value={content}
              onChange={(value) => {
                if (ready && monacoPromptIdRef.current === promptId) {
                  setContent(value || "")
                }
              }}
              language="markdown"
              height="100%"
            />
          </div>
        </div>

        {/* Footer Section */}
        <div className="flex-none p-4 border-t bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {status === "saving"
                ? "Saving..."
                : status === "unsaved"
                  ? "Unsaved changes"
                  : lastSaved
                    ? `Saved ${lastSaved.toLocaleTimeString()}`
                    : "Saved"}
            </span>
            <div className="flex gap-2">
              <Button onClick={() => setHistoryOpen(true)} disabled={!promptId} variant="outline">
                History
              </Button>
              <Button onClick={handleSave} disabled={saving || !promptId} variant="default">
                {saving ? "Saving..." : "Save Version (Ctrl+S)"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SetTitleDialog
        open={showSetTitleDialog}
        onOpenChange={setShowSetTitleDialog}
        onConfirm={handleSetTitle}
        currentTitle={title}
      />

      <VersionHistoryDialog
        promptId={promptId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestored={handleVersionRestored}
      />
    </>
  )
}
