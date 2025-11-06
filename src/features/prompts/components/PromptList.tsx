"use client"

import { useEffect, useState } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getPromptsByFolder } from "../actions"
import { Prompt } from "@prisma/client"

export function PromptList() {
  const { selectedFolder, selectPrompt } = useUiStore()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(false)

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
    <div>
      <h2 className="text-lg font-semibold mb-2">Prompts</h2>
      {loading ? (
        <div>Loading prompts...</div>
      ) : prompts.length === 0 ? (
        <div className="text-sm text-gray-500">No prompts in this folder.</div>
      ) : (
        prompts.map((prompt) => (
          <div
            key={prompt.id}
            className="p-2 rounded-md cursor-pointer hover:bg-gray-800"
            onClick={() => selectPrompt(prompt.id)}
          >
            {prompt.title}
          </div>
        ))
      )}
    </div>
  )
}
