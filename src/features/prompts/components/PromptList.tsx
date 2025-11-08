"use client"

import { useEffect, useState, useMemo } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getPromptsByFolder } from "../actions"
import { Prompt } from "@prisma/client"
import { cn } from "@/lib/utils"

export function PromptList() {
  const { selectedFolder, selectPrompt, selectedPrompt, docSort, docFilter, promptRefetchTrigger } = useUiStore()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(false)

  // Reason: Load prompts when folder changes or when a new prompt is selected (to refresh list)
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
  }, [selectedFolder, selectedPrompt, promptRefetchTrigger])

  // Reason: Apply sort and filter to prompts
  const filteredAndSortedPrompts = useMemo(() => {
    let result = [...prompts]

    // Apply filter (case-insensitive title search)
    if (docFilter) {
      result = result.filter(prompt =>
        prompt.title.toLowerCase().includes(docFilter.toLowerCase())
      )
    }

    // Apply sort
    result.sort((a, b) => {
      switch (docSort) {
        case 'title-asc':
          return a.title.localeCompare(b.title)
        case 'title-desc':
          return b.title.localeCompare(a.title)
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'size-asc':
          return a.content.length - b.content.length
        case 'size-desc':
          return b.content.length - a.content.length
        default:
          return 0
      }
    })

    return result
  }, [prompts, docSort, docFilter])

  if (!selectedFolder) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Select a folder to see your documents.</p>
      </div>
    )
  }

  if (loading) {
    return <div>Loading documents...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading documents...</div>
        ) : filteredAndSortedPrompts.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {docFilter ? 'No documents match your filter.' : 'No documents in this folder.'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredAndSortedPrompts.map((prompt) => (
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
