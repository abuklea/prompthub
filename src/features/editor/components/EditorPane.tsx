/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/EditorPane.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:41 GMT+10
Last modified: 07/11/2025 16:17 GMT+10
---------------
Editor pane component for the right section of the 3-pane layout.
Displays selected prompt details and provides editing interface with Monaco Editor.
Features: Auto-save (500ms debounce), localStorage persistence, manual save (Ctrl+S).

Changelog:
07/11/2025 16:17 GMT+10 | Integrated auto-save, localStorage, and Ctrl+S manual save (P5S3bT14)
07/11/2025 16:07 GMT+10 | Restructured layout for full-height Monaco editor (P5S3bT3)
07/11/2025 14:21 GMT+10 | Added save functionality with Editor component integration (P5S3T4)
07/11/2025 13:41 GMT+10 | Initial creation with prompt details fetching
*/

"use client"

import { useEffect, useState, useCallback } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getPromptDetails } from "@/features/prompts/actions"
import { saveNewVersion, autoSavePrompt } from "@/features/editor/actions"
import { useAutoSave } from "@/features/editor/hooks/useAutoSave"
import { useLocalStorage } from "@/features/editor/hooks/useLocalStorage"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Editor } from "@/features/editor"
import { toast } from "sonner"
import type { Prompt, Folder } from "@prisma/client"

type PromptWithFolder = Prompt & {
  folder: {
    id: string
    name: string
  }
}

export function EditorPane() {
  const { selectedPrompt } = useUiStore()
  const [promptData, setPromptData] = useState<PromptWithFolder | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Reason: localStorage for unsaved changes (P5S3bT14)
  const [localContent, setLocalContent, clearLocalContent] = useLocalStorage({
    key: selectedPrompt ? `prompt-${selectedPrompt}` : 'prompt-draft',
    initialValue: ''
  })

  // Reason: Fetch prompt details when selection changes
  useEffect(() => {
    async function loadPrompt() {
      if (!selectedPrompt) {
        setPromptData(null)
        setTitle("")
        setError("")
        return
      }

      setLoading(true)
      setError("")

      const result = await getPromptDetails({ promptId: selectedPrompt })

      // Reason: Check success field for discriminated union type
      if (!result.success) {
        setError(result.error)
        toast.error(result.error, { duration: 6000 })
        setLoading(false)
        return
      }

      if (result.data) {
        setPromptData(result.data as PromptWithFolder)
        setTitle(result.data.title)
      }
      setLoading(false)
    }

    loadPrompt()
  }, [selectedPrompt])

  // Reason: Sync content state when prompt data loads
  useEffect(() => {
    if (promptData?.content) {
      // Reason: Check localStorage first for unsaved changes
      if (localContent && localContent !== promptData.content) {
        setContent(localContent)
        toast.info("Restored unsaved changes from browser storage")
      } else {
        setContent(promptData.content)
      }
    }
  }, [promptData, localContent])

  // Reason: Auto-save callback (P5S3bT14)
  const handleAutoSave = useCallback(async (promptId: string, content: string) => {
    setAutoSaving(true)
    const result = await autoSavePrompt({ promptId, content })

    if (result.success) {
      setLastSaved(new Date())
    }
    setAutoSaving(false)
  }, [])

  // Reason: Enable auto-save with 500ms debounce (P5S3bT14)
  useAutoSave({
    content,
    promptId: selectedPrompt,
    delay: 500,
    onSave: handleAutoSave
  })

  // Reason: Sync content to localStorage
  useEffect(() => {
    if (content && selectedPrompt) {
      setLocalContent(content)
    }
  }, [content, selectedPrompt, setLocalContent])

  // Reason: Handle manual save with version creation and localStorage clear (P5S3bT14)
  const handleSave = useCallback(async () => {
    if (!selectedPrompt) return

    setSaving(true)
    const result = await saveNewVersion({
      promptId: selectedPrompt,
      newTitle: title,
      newContent: content,
    })

    if (result.success) {
      toast.success("Version saved successfully")
      // Reason: Clear localStorage after successful manual save
      clearLocalContent()
      setLastSaved(new Date())
    } else {
      toast.error(result.error, { duration: 6000 })
    }
    setSaving(false)
  }, [selectedPrompt, title, content, clearLocalContent])

  // Reason: Keyboard listener for Ctrl+S manual save (P5S3bT14)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Reason: Ctrl+S or Cmd+S for manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault() // CRITICAL: Prevent browser default save dialog
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // No prompt selected
  if (!selectedPrompt) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Select a prompt to edit or create a new one
        </p>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  // Prompt loaded
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Title Section - Fixed Height */}
      <div className="flex-none p-4 space-y-2 border-b overflow-hidden">
        <Label htmlFor="prompt-title">Title</Label>
        <Input
          id="prompt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter prompt title..."
          className="text-lg font-semibold w-full"
        />
      </div>

      {/* Editor Section - Takes Remaining Space */}
      <div className="flex-1 overflow-hidden relative">
        {/* Reason: Absolute wrapper gives Monaco measurable dimensions for height="100%" */}
        <div className="absolute inset-0 h-full">
          <Editor
            value={content}
            onChange={(value) => setContent(value || "")}
            language="markdown"
            height="100%"
          />
        </div>
      </div>

      {/* Footer Section - Fixed Height */}
      <div className="flex-none p-4 border-t bg-muted/30">
        <div className="flex justify-between items-center">
          {/* Reason: Auto-save status indicator (P5S3bT14) */}
          <span className="text-xs text-muted-foreground">
            {autoSaving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Unsaved"}
          </span>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !selectedPrompt}
              variant="default"
            >
              {saving ? "Saving..." : "Save Version (Ctrl+S)"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
