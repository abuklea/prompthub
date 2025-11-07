/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/EditorPane.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:41 GMT+10
Last modified: 07/11/2025 13:41 GMT+10
---------------
Editor pane component for the right section of the 3-pane layout.
Displays selected prompt details and provides editing interface.

Changelog:
07/11/2025 13:41 GMT+10 | Initial creation with prompt details fetching
*/

"use client"

import { useEffect, useState } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getPromptDetails } from "@/features/prompts/actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="prompt-title">Title</Label>
        <Input
          id="prompt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter prompt title..."
          className="text-lg font-semibold"
        />
      </div>

      <div className="flex-1 border rounded-md p-4 bg-card">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Monaco Editor (Coming in P5S3)
          </p>
          <div className="mt-4 p-4 bg-muted/20 rounded-md">
            <p className="text-sm text-muted-foreground">
              Current content: {promptData?.content || "(empty)"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Folder: {promptData?.folder?.name || "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
