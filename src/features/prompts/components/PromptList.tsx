"use client"

import { useEffect, useMemo, useState } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { getPromptsByFolder, createPrompt } from "../actions"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { getDisplayTitle } from "../utils"
import { OverflowTooltipText } from "@/components/ui/overflow-tooltip-text"

export function PromptList() {
  const {
    selectedFolder,
    docSort,
    docFilter,
    promptRefetchTrigger,
    prompts,
    promptsByFolder,
    workspaceReady,
    setPrompts,
    setPromptsForFolder,
    addPrompt,
    removePrompt,
    selectPrompt,
    selectFolder,
  } = useUiStore()

  const openTab = useTabStore((state) => state.openTab)
  const setActiveTab = useTabStore((state) => state.setActiveTab)
  const promotePreviewTab = useTabStore((state) => state.promotePreviewTab)
  const activeTabId = useTabStore((state) => state.activeTabId)
  const tabs = useTabStore((state) => state.tabs)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadPrompts() {
      if (!selectedFolder) {
        setPrompts([])
        return
      }

      const cached = promptsByFolder[selectedFolder]
      if (cached) {
        setPrompts(cached)
      }

      if (cached && workspaceReady && promptRefetchTrigger === 0) {
        return
      }

      setLoading(true)
      try {
        const folderPrompts = await getPromptsByFolder(selectedFolder)
        setPromptsForFolder(selectedFolder, folderPrompts)
      } catch (error) {
        console.error("Failed to fetch prompts:", error)
      } finally {
        setLoading(false)
      }
    }
    loadPrompts()
  }, [selectedFolder, promptRefetchTrigger, promptsByFolder, workspaceReady, setPrompts, setPromptsForFolder])

  const handleCreateFirstDoc = async () => {
    if (!selectedFolder) return

    const optimisticId = `temp-${Date.now()}`
    const now = new Date()
    addPrompt({
      id: optimisticId,
      title: null,
      content: "",
      created_at: now,
      updated_at: now,
      user_id: prompts[0]?.user_id ?? "",
      folder_id: selectedFolder,
    })

    const result = await createPrompt({ folderId: selectedFolder })

    if (!result.success || !result.data) {
      removePrompt(optimisticId)
      toast.error(result.error, { duration: 6000 })
      return
    }

    removePrompt(optimisticId)
    addPrompt(result.data)
    toast.success("Document created successfully", { duration: 3000 })

    openTab({
      type: 'document',
      title: getDisplayTitle(result.data.title),
      promptId: result.data.id,
      folderId: result.data.folder_id ?? undefined,
    })
  }

  const filteredAndSortedPrompts = useMemo(() => {
    let result = [...prompts]

    if (docFilter) {
      result = result.filter((prompt) =>
        (prompt.title || "").toLowerCase().includes(docFilter.toLowerCase())
      )
    }

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

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  )

  useEffect(() => {
    if (activeTab?.type !== 'document' || !activeTab.promptId) return

    selectPrompt(activeTab.promptId)
    const promptFromStore = prompts.find((prompt) => prompt.id === activeTab.promptId)
    const resolvedFolderId = activeTab.folderId || promptFromStore?.folder_id

    if (resolvedFolderId && resolvedFolderId !== selectedFolder) {
      selectFolder(resolvedFolderId)
    }
  }, [activeTab, prompts, selectedFolder, selectFolder, selectPrompt])

  if (!selectedFolder) {
    return <div className="flex items-center justify-center h-full"><p>Select a folder to see your documents.</p></div>
  }

  if (loading && prompts.length === 0) {
    return <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading documents...</div>
  }

  if (prompts.length === 0 && !docFilter) {
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
        {filteredAndSortedPrompts.length === 0 ? (
          <div className="text-sm text-muted-foreground">{docFilter ? 'No documents match your filter.' : 'No documents in this folder.'}</div>
        ) : (
          <ErrorBoundary fallback={<div className="text-sm text-destructive p-2">Error loading document list. Please refresh the page.</div>}>
            <div className="space-y-1">
              {filteredAndSortedPrompts.map((prompt) => {
                const isActive = activeTab?.type === 'document' && activeTab?.promptId === prompt.id

                const handleSingleClick = () => {
                  selectPrompt(prompt.id)
                  const existingTab = tabs.find((t) => t.type === 'document' && t.promptId === prompt.id && !t.isPreview)
                  if (existingTab) {
                    setActiveTab(existingTab.id)
                  } else {
                    openTab({
                      type: 'document',
                      title: getDisplayTitle(prompt.title),
                      promptId: prompt.id,
                      folderId: prompt.folder_id ?? undefined,
                      isPreview: true,
                    })
                  }
                }

                const handleDoubleClick = () => {
                  selectPrompt(prompt.id)
                  const existingTab = tabs.find((t) => t.type === 'document' && t.promptId === prompt.id)

                  if (existingTab && existingTab.isPreview) {
                    promotePreviewTab(existingTab.id)
                  } else if (!existingTab) {
                    openTab({
                      type: 'document',
                      title: getDisplayTitle(prompt.title),
                      promptId: prompt.id,
                      folderId: prompt.folder_id ?? undefined,
                      isPreview: false,
                    })
                  }
                }

                return (
                  <div
                    key={prompt.id}
                    className={cn(
                      "p-2 rounded-md cursor-pointer transition-colors whitespace-nowrap",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                    onClick={handleSingleClick}
                    onDoubleClick={handleDoubleClick}
                  >
                    <OverflowTooltipText text={getDisplayTitle(prompt.title)} />
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
