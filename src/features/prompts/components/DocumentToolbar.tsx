"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUiStore, type DocSort } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { assignTagsToPrompt, createPrompt, createTag, deletePrompt, getTags, renamePrompt } from "../actions"
import { toast } from "sonner"
import { Plus, Edit, Trash2, ArrowUpDown, Tag } from "lucide-react"
import { CreateDocumentDialog, RenameDocumentDialog, DeleteDocumentDialog } from "./DocumentDialogs"

export function DocumentToolbar() {
  const { selectedFolder, selectedPrompt, docSort, docFilter, selectedTagIds, setDocSort, setDocFilter, setSelectedTagIds, selectPrompt, triggerPromptRefetch, prompts, addPrompt, removePrompt, updatePromptTitle } = useUiStore()
  const { closeTabsByPromptId, tabs, activeTabId, openTab } = useTabStore()
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPromptHasVersions, setSelectedPromptHasVersions] = useState(false)

  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([])
  const [newTagName, setNewTagName] = useState("")

  // Reason: Sync selectedPrompt with active tab to enable toolbar buttons
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab?.type === 'document' && activeTab.promptId) {
      selectPrompt(activeTab.promptId)
    }
  }, [activeTabId, tabs, selectPrompt])

  // Reason: Get title from Zustand store instead of database fetch (P5S5T2 - Performance optimization)
  // This eliminates 1 database request per document selection (10-50+ requests saved per session)
  const selectedPromptTitle = selectedPrompt
    ? (prompts.find(p => p.id === selectedPrompt)?.title || "")
    : ""

  // Reason: Map sort values to display labels
  const sortLabels: Record<DocSort, string> = {
    'title-asc': 'Title (A-Z)',
    'title-desc': 'Title (Z-A)',
    'date-asc': 'Date (Oldest)',
    'date-desc': 'Date (Newest)',
    'size-asc': 'Size (Smallest)',
    'size-desc': 'Size (Largest)',
  }

  // Reason: Handle new document creation with auto-generated unique untitled name
  const handleNewDoc = async () => {
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

    // Reason: Auto-open newly created document with isNewDocument flag (P5S4eT14)
    // P5S5T4: Use full Prompt object from result to avoid additional database requests
    if (result.data?.id) {
      // P5S5T3: Optimistic update - add document to store immediately (no refetch needed)
      addPrompt(result.data)

      // P5S5 FIX 3: Explicitly set isPreview flag for new documents
      // Reason: Omitting isPreview causes confusion - new docs should be permanent tabs (not preview)
      // Solution: Explicitly set isPreview: false to make intent clear and prevent future bugs
      openTab({
        type: 'document',
        title: "",  // Empty title - will display as "[Untitled Doc]" placeholder
        promptId: result.data.id,
        folderId: result.data.folder_id ?? undefined,
        isNewDocument: true,  // CRITICAL: Mark as new to trigger save confirmation
        isPreview: false,     // EXPLICIT: New documents are permanent tabs, not preview tabs
      })
      selectPrompt(result.data.id)
    }
    setCreatingDoc(false)
  }


  useEffect(() => {
    async function loadTags() {
      const fetched = await getTags({ folderId: selectedFolder || undefined })
      setTags(fetched)
    }
    loadTags()
  }, [selectedFolder, prompts])

  const selectedPromptTagIds = selectedPrompt
    ? (prompts.find((p) => p.id === selectedPrompt)?.tags?.map((tag) => tag.id) ?? [])
    : []

  const toggleTagFilter = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId))
      return
    }
    setSelectedTagIds([...selectedTagIds, tagId])
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const result = await createTag({ name: newTagName.trim() })
    if (!result.success || !result.data) {
      toast.error(!result.success ? result.error : "Failed to create tag")
      return
    }
    setNewTagName("")
    setTags((prev) => {
      if (prev.some((tag) => tag.id === result.data?.id)) return prev
      return [...prev, result.data!].sort((a, b) => a.name.localeCompare(b.name))
    })
    toast.success(`Tag "${result.data.name}" ready`)
  }

  const toggleTagForPrompt = async (tagId: string) => {
    if (!selectedPrompt) return
    const next = selectedPromptTagIds.includes(tagId)
      ? selectedPromptTagIds.filter((id) => id !== tagId)
      : [...selectedPromptTagIds, tagId]

    const result = await assignTagsToPrompt({ promptId: selectedPrompt, tagIds: next })
    if (!result.success) {
      toast.error(result.error)
      return
    }

    triggerPromptRefetch()
  }

  const handleRename = () => {
    setRenameDialogOpen(true)
  }

  const handleConfirmRename = async (newTitle: string) => {
    if (!selectedPrompt) return

    // P5S5T3: Optimistic update - update title in store immediately (no refetch needed)
    updatePromptTitle(selectedPrompt, newTitle)

    const result = await renamePrompt(selectedPrompt, newTitle)
    if (result.success) {
      toast.success("Document renamed successfully", { duration: 3000 })
    } else {
      toast.error(result.error, { duration: 6000 })
      // Reason: Revert optimistic update on error by triggering refetch
      triggerPromptRefetch()
    }
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedPrompt) return

    const promptIdToDelete = selectedPrompt

    // P5S5T3: Optimistic update - remove from store immediately (no refetch needed)
    removePrompt(promptIdToDelete)
    selectPrompt(null)
    closeTabsByPromptId(promptIdToDelete)

    const result = await deletePrompt(promptIdToDelete)
    if (result.success) {
      toast.success("Document deleted successfully", { duration: 3000 })
    } else {
      toast.error(result.error, { duration: 6000 })
      // Reason: Revert optimistic update on error by triggering refetch
      triggerPromptRefetch()
    }
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
      {/* New Doc Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedFolder || creatingDoc}
            onClick={handleNewDoc}
            className="min-w-[32px] shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{!selectedFolder ? "Select a folder first" : creatingDoc ? "Creating document..." : "Create new document"}</p>
        </TooltipContent>
      </Tooltip>

      {/* Rename Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedPrompt}
            onClick={handleRename}
            className="min-w-[32px] shrink-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{!selectedPrompt ? "Select a document first" : "Rename selected document"}</p>
        </TooltipContent>
      </Tooltip>

      {/* Delete Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedPrompt}
            onClick={handleDelete}
            className="min-w-[32px] shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{!selectedPrompt ? "Select a document first" : "Delete selected document"}</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-gray-600 mx-1 shrink-0" />

      {/* Sort Dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-w-[80px] shrink-0">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <span className="text-xs truncate">{sortLabels[docSort]}</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Sort documents by title, date, or size</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={docSort} onValueChange={(value) => setDocSort(value as DocSort)}>
            <DropdownMenuRadioItem value="title-asc">Title (A-Z)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="title-desc">Title (Z-A)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date-asc">Date (Oldest)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date-desc">Date (Newest)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="size-asc">Size (Smallest)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="size-desc">Size (Largest)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter Input */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Input
            type="text"
            placeholder="Filter..."
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
            className="h-8 text-sm flex-1 max-w-[200px] min-w-[100px] shrink-0"
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Filter documents by title</p>
        </TooltipContent>
      </Tooltip>

      {/* Tag Filters */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-w-[70px] shrink-0">
                <Tag className="h-4 w-4 mr-1" />
                <span className="text-xs">Tags ({selectedTagIds.length})</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Filter documents by tags and manage selected document tags</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
          {tags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={`filter-${tag.id}`}
              checked={selectedTagIds.includes(tag.id)}
              onCheckedChange={() => toggleTagFilter(tag.id)}
            >
              {tag.name}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Selected document tags</DropdownMenuLabel>
          {selectedPrompt ? tags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={`prompt-${tag.id}`}
              checked={selectedPromptTagIds.includes(tag.id)}
              onCheckedChange={() => toggleTagForPrompt(tag.id)}
            >
              {tag.name}
            </DropdownMenuCheckboxItem>
          )) : <DropdownMenuItem disabled>Select a document first</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <div className="p-2 flex gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag"
              className="h-8"
            />
            <Button size="sm" onClick={handleCreateTag}>
              Add
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs */}
      <RenameDocumentDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onConfirm={handleConfirmRename}
        currentTitle={selectedPromptTitle}
      />

      <DeleteDocumentDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        documentTitle={selectedPromptTitle}
        hasVersions={selectedPromptHasVersions}
        versionCount={0}
      />
    </div>
  )
}
