"use client"

import { useEffect, useState } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getPromptsByFolder, createPrompt } from "../actions"
import { Prompt } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function PromptList() {
  const { selectedFolder, selectPrompt, selectedPrompt } = useUiStore()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingPrompt, setCreatingPrompt] = useState(false)

  // Reason: Load prompts when folder changes
  useEffect(() => {
    async function loadPrompts() {
      if (!selectedFolder) {
        setPrompts([])
        return
      }
      setLoading(true)
      try {
        const folderPrompts = await getPromptsByFolder(selectedFolder)
        setPrompts(folderPrompts)
      } catch (error) {
        console.error("Failed to fetch prompts:", error)
      } finally {
        setLoading(false)
      }
    }
    loadPrompts()
  }, [selectedFolder])

  // Reason: Handle new prompt creation
  const handleNewPrompt = async () => {
    if (!selectedFolder) return

    setCreatingPrompt(true)
    const result = await createPrompt({
      folderId: selectedFolder,
      title: "Untitled Prompt"
    })

    // Reason: Check success field for discriminated union type
    if (!result.success) {
      toast.error(result.error, { duration: 6000 })
      setCreatingPrompt(false)
      return
    }

    toast.success("Prompt created successfully", { duration: 3000 })

    // Reason: Auto-select newly created prompt and refresh list
    if (result.data?.promptId) {
      selectPrompt(result.data.promptId)
      // Refresh the prompt list
      try {
        const folderPrompts = await getPromptsByFolder(selectedFolder)
        setPrompts(folderPrompts)
      } catch (error) {
        console.error("Failed to refresh prompts:", error)
      }
    }
    setCreatingPrompt(false)
  }

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Select a folder to see your prompts.</p>
      </div>
    )
  }

  if (loading) {
    return <div>Loading prompts...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Prompts</h2>
        <Button
          onClick={handleNewPrompt}
          disabled={creatingPrompt || !selectedFolder}
          className="w-full"
          variant="outline"
        >
          {creatingPrompt ? "Creating..." : "+ New Prompt"}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading prompts...</div>
        ) : prompts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No prompts in this folder.</div>
        ) : (
          <div className="space-y-1">
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className={cn(
                  "p-2 rounded-md cursor-pointer transition-colors",
                  selectedPrompt === prompt.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
                onClick={() => selectPrompt(prompt.id)}
              >
                {prompt.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
