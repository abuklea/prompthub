/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/EditorPane.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:41 GMT+10
Last modified: 17/07/2026 10:00 GMT+10
---------------
Editor pane component for the right section of the 3-pane layout.
Displays selected prompt details and provides editing interface with Monaco Editor.
Features: Auto-save (500ms debounce), localStorage persistence, manual save (Ctrl+S).

Changelog:
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

import { useEffect, useState, useCallback } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { saveNewVersion, autoSavePrompt } from "@/features/editor/actions"
import { titleValidationSchema } from "@/features/prompts/schemas"
import { SetTitleDialog } from "@/features/prompts/components/SetTitleDialog"
import { getDisplayTitle } from "@/features/prompts/utils"
import { useAutoSave } from "@/features/editor/hooks/useAutoSave"
import { useLocalStorage } from "@/features/editor/hooks/useLocalStorage"
import {
  useDocumentLoader,
  setDocumentCacheEntry,
} from "@/features/editor/hooks/useDocumentLoader"
import { VersionHistoryDialog } from "./VersionHistoryDialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Editor } from "@/features/editor"
import { toast } from "sonner"

// Re-export cache utilities used by WorkspacePreloader and logout
export { hydrateDocumentCache, clearDocumentCache } from "@/features/editor/hooks/useDocumentLoader"

interface EditorPaneProps {
  promptId: string
  tabId: string
}

export function EditorPane({ promptId, tabId }: EditorPaneProps) {
  const { triggerPromptRefetch, updatePromptTitle } = useUiStore()
  const { updateTab, promotePreviewTab } = useTabStore()

  const {
    promptData,
    title,
    content,
    loading,
    error,
    lastSaved,
    currentUserId,
    isTransitioning,
    contentPromptIdRef,
    monacoPromptIdRef,
    titlePromptIdRef,
    promptIdRef,
    setPromptData,
    setTitle,
    setContent,
    setLastSaved,
    resetLoadedRef,
  } = useDocumentLoader({ promptId })

  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [showSetTitleDialog, setShowSetTitleDialog] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const [, setLocalContent, clearLocalContent] = useLocalStorage({
    key: promptId ? `prompt-${promptId}` : "prompt-draft",
    initialValue: "",
  })

  const handleAutoSave = useCallback(
    async (pid: string, t: string | null, c: string) => {
      setAutoSaving(true)
      const result = await autoSavePrompt({ promptId: pid, title: t || "", content: c })
      if (result.success) {
        setLastSaved(new Date())
        updatePromptTitle(pid, t || "")
      } else {
        console.error("[EditorPane] Auto-save FAILED for:", pid, result.error)
      }
      setAutoSaving(false)
    },
    [updatePromptTitle, setLastSaved]
  )

  useAutoSave({
    title,
    content,
    promptId: loading || isTransitioning.current ? null : promptId,
    delay: 500,
    onSave: handleAutoSave,
  })

  // Sync content to localStorage
  useEffect(() => {
    if (promptId !== promptIdRef.current) return
    if (content && promptId && contentPromptIdRef.current === promptId) {
      if (!isTransitioning.current) {
        setLocalContent(content)
      }
    }
  }, [content, promptId, setLocalContent, promptIdRef, contentPromptIdRef, isTransitioning])

  // Update cache and tab metadata when title or content changes
  useEffect(() => {
    if (isTransitioning.current) return
    if (contentPromptIdRef.current !== promptId) return
    if (titlePromptIdRef.current !== promptId) return

    if (promptData && promptId) {
      const isDirty = content !== promptData.content

      setDocumentCacheEntry(currentUserId, promptId, {
        promptData,
        title: title ?? null,
        content,
        lastSaved,
      })

      const currentTab = useTabStore.getState().tabs.find((t) => t.id === tabId)
      if (isDirty && currentTab?.isPreview) {
        promotePreviewTab(tabId)
      }

      updateTab(tabId, {
        title: getDisplayTitle(title),
        folderId: promptData.folder.id,
        isDirty,
      })
    }
  }, [
    title, content, promptData, promptId, tabId, updateTab,
    promotePreviewTab, lastSaved, currentUserId,
    contentPromptIdRef, titlePromptIdRef, isTransitioning,
  ])

  const handleSave = useCallback(async () => {
    if (!promptId) return

    const titleResult = titleValidationSchema.safeParse(title)
    if (!titleResult.success) {
      setShowSetTitleDialog(true)
      return
    }

    setSaving(true)
    const result = await saveNewVersion({
      promptId,
      newTitle: title,
      newContent: content,
    })

    if (result.success) {
      toast.success("Version saved successfully")
      clearLocalContent()
      setLastSaved(new Date())

      const updatedData = promptData
        ? { ...promptData, title, content, updated_at: new Date() }
        : null

      if (updatedData) {
        setPromptData(updatedData)
        setDocumentCacheEntry(currentUserId, promptId, {
          promptData: updatedData,
          title,
          content,
          lastSaved: new Date(),
        })
      }

      updateTab(tabId, { isDirty: false, isNewDocument: false })
      triggerPromptRefetch()
    } else {
      toast.error(result.error, { duration: 6000 })
    }
    setSaving(false)
  }, [
    promptId, title, content, clearLocalContent, promptData, tabId,
    updateTab, triggerPromptRefetch, currentUserId, setLastSaved, setPromptData,
  ])

  const handleSetTitle = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      setShowSetTitleDialog(false)
      setTimeout(() => handleSave(), 0)
    },
    [handleSave, setTitle]
  )

  const handleVersionRestored = useCallback(() => {
    resetLoadedRef()
    triggerPromptRefetch()
  }, [resetLoadedRef, triggerPromptRefetch])

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

  if (!promptId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a prompt to edit or create a new one</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{error}</p>
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
                if (monacoPromptIdRef.current === promptId) {
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
              {autoSaving
                ? "Saving..."
                : lastSaved
                  ? `Saved ${lastSaved.toLocaleTimeString()}`
                  : "Unsaved"}
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
