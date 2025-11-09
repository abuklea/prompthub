/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/components/PromptList.tsx
MIME: text/typescript
Type: React Component (TypeScript)

Created: 08/11/2025 13:08 GMT+10
Last modified: 08/11/2025 15:16 GMT+10
---------------
Component for displaying and managing the list of prompts in a folder.
Now uses tab system for opening documents instead of selectedPrompt.

Changelog:
08/11/2025 15:16 GMT+10 | Added ErrorBoundary to prevent application crashes from render errors (P5S4T3)
08/11/2025 15:11 GMT+10 | CRITICAL FIX: Moved activeTab calculation outside map using useMemo to prevent infinite render loop (P5S4T1)
08/11/2025 13:39 GMT+10 | Added single-click (preview) vs double-click (permanent) tab behavior
08/11/2025 13:08 GMT+10 | Updated to use tab system instead of selectedPrompt
*/

"use client"

import { useEffect, useState, useMemo } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { getPromptsByFolder } from "../actions"
import { Prompt } from "@prisma/client"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Plus } from "lucide-react"
import { createPrompt } from "../actions"
import { toast } from "sonner"
import { getDisplayTitle } from "../utils"

export function PromptList() {
  const { selectedFolder, docSort, docFilter, promptRefetchTrigger, triggerPromptRefetch, prompts, setPrompts, selectPrompt } = useUiStore()
  const openTab = useTabStore(state => state.openTab)
  const setActiveTab = useTabStore(state => state.setActiveTab)
  const promotePreviewTab = useTabStore(state => state.promotePreviewTab)
  const activeTabId = useTabStore(state => state.activeTabId)
  const tabs = useTabStore(state => state.tabs)
  const [loading, setLoading] = useState(false)
  const [creatingDoc, setCreatingDoc] = useState(false)

  // Reason: Load prompts when folder changes or when refetch is triggered
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
  }, [selectedFolder, promptRefetchTrigger, setPrompts])

  // Reason: Handle new document creation from empty state with auto-generated unique name
  const handleCreateFirstDoc = async () => {
    if (!selectedFolder) return

    setCreatingDoc(true)
    const result = await createPrompt({
      folderId: selectedFolder,
      // Reason: No title provided - server will generate "[Untitled Doc]" or "[Untitled Doc N]"
    })

    if (!result.success) {
      toast.error(result.error, { duration: 6000 })
      setCreatingDoc(false)
      return
    }

    toast.success("Document created successfully", { duration: 3000 })

    // Reason: Auto-open newly created document in tab and trigger list refresh
    if (result.data?.promptId) {
      openTab({
        type: 'document',
        title: "[Untitled Doc]",
        promptId: result.data.promptId,
      })
      triggerPromptRefetch()
    }
    setCreatingDoc(false)
  }

  // Reason: Apply sort and filter to prompts
  const filteredAndSortedPrompts = useMemo(() => {
    let result = [...prompts]

    // Apply filter (case-insensitive title search)
    if (docFilter) {
      result = result.filter(prompt =>
        (prompt.title || "").toLowerCase().includes(docFilter.toLowerCase())
      )
    }

    // Apply sort
    result.sort((a, b) => {
      switch (docSort) {
        case 'title-asc':
          return (a.title || "").localeCompare(b.title || "")
        case 'title-desc':
          return (b.title || "").localeCompare(a.title || "")
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

  // Reason: Calculate activeTab once per render, not for every prompt
  // This prevents infinite re-render loops when tabs state changes
  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId),
    [tabs, activeTabId]
  )

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

  // Show empty state when no documents exist in the folder (and not filtered)
  if (selectedFolder && prompts.length === 0 && !docFilter) {
    return (
      <EmptyState
        icon={Plus}
        title="No documents yet"
        description="This folder is empty. Create your first document to start capturing your prompts and ideas."
        actionLabel="Create Your First Document"
        onAction={handleCreateFirstDoc}
      />
    )
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
          <ErrorBoundary
            fallback={
              <div className="text-sm text-destructive p-2">
                Error loading document list. Please refresh the page.
              </div>
            }
          >
            <div className="space-y-1">
              {filteredAndSortedPrompts.map((prompt) => {
              // Reason: Use the memoized activeTab from above
              const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id

              // Reason: Handle single-click for preview, double-click for permanent tab
              const handleSingleClick = () => {
                // Reason: Set selectedPrompt for toolbar button state
                selectPrompt(prompt.id)

                // Check if this document already has a permanent (non-preview) tab open
                const existingTab = tabs.find(
                  t => t.type === 'document' && t.promptId === prompt.id && !t.isPreview
                )

                if (existingTab) {
                  // If permanent tab exists, just switch to it (don't call openTab to avoid title flicker)
                  setActiveTab(existingTab.id)
                } else {
                  // Open as preview tab (replaces existing preview)
                  openTab({
                    type: 'document',
                    title: getDisplayTitle(prompt.title),
                    promptId: prompt.id,
                    isPreview: true,
                  })
                }
              }

              const handleDoubleClick = () => {
                // Reason: Set selectedPrompt for toolbar button state
                selectPrompt(prompt.id)

                // Find any tab (preview or permanent) with this promptId
                const existingTab = tabs.find(
                  t => t.type === 'document' && t.promptId === prompt.id
                )

                if (existingTab && existingTab.isPreview) {
                  // Promote existing preview tab to permanent
                  promotePreviewTab(existingTab.id)
                } else if (!existingTab) {
                  // Open as permanent tab
                  openTab({
                    type: 'document',
                    title: getDisplayTitle(prompt.title),
                    promptId: prompt.id,
                    isPreview: false,
                  })
                }
              }

              return (
                <div
                  key={prompt.id}
                  className={cn(
                    "p-2 rounded-md cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                  onClick={handleSingleClick}
                  onDoubleClick={handleDoubleClick}
                >
                  {getDisplayTitle(prompt.title)}
                </div>
              )
            })}
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
