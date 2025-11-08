"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUiStore, type DocSort } from "@/stores/use-ui-store"
import { createPrompt, renamePrompt, deletePrompt, getPromptDetails } from "../actions"
import { toast } from "sonner"
import { Plus, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { CreateDocumentDialog, RenameDocumentDialog, DeleteDocumentDialog } from "./DocumentDialogs"

export function DocumentToolbar() {
  const { selectedFolder, selectedPrompt, docSort, docFilter, setDocSort, setDocFilter, selectPrompt, triggerPromptRefetch } = useUiStore()
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPromptTitle, setSelectedPromptTitle] = useState("")
  const [selectedPromptHasVersions, setSelectedPromptHasVersions] = useState(false)

  // Reason: Fetch selected prompt details to get title for dialogs
  useEffect(() => {
    async function loadPromptTitle() {
      if (!selectedPrompt) {
        setSelectedPromptTitle("")
        setSelectedPromptHasVersions(false)
        return
      }

      const result = await getPromptDetails({ promptId: selectedPrompt })
      if (result.success && result.data) {
        setSelectedPromptTitle(result.data.title)
        // TODO: Check if prompt has versions when version count is available
        setSelectedPromptHasVersions(false)
      }
    }

    loadPromptTitle()
  }, [selectedPrompt])

  // Reason: Map sort values to display labels
  const sortLabels: Record<DocSort, string> = {
    'title-asc': 'Title (A-Z)',
    'title-desc': 'Title (Z-A)',
    'date-asc': 'Date (Oldest)',
    'date-desc': 'Date (Newest)',
    'size-asc': 'Size (Smallest)',
    'size-desc': 'Size (Largest)',
  }

  // Reason: Handle new document creation
  const handleNewDoc = async () => {
    if (!selectedFolder) return

    setCreatingDoc(true)
    const result = await createPrompt({
      folderId: selectedFolder,
      title: "Untitled Prompt"
    })

    if (!result.success) {
      toast.error(result.error, { duration: 6000 })
      setCreatingDoc(false)
      return
    }

    toast.success("Document created successfully", { duration: 3000 })

    // Reason: Auto-select newly created document and trigger list refresh via state change
    if (result.data?.promptId) {
      selectPrompt(result.data.promptId)
      triggerPromptRefetch()
    }
    setCreatingDoc(false)
  }

  const handleRename = () => {
    setRenameDialogOpen(true)
  }

  const handleConfirmRename = async (newTitle: string) => {
    if (!selectedPrompt) return

    const result = await renamePrompt(selectedPrompt, newTitle)
    if (result.success) {
      toast.success("Document renamed successfully", { duration: 3000 })
      setSelectedPromptTitle(newTitle)
      // Reason: Trigger refetch to update PromptList
      triggerPromptRefetch()
    } else {
      toast.error(result.error, { duration: 6000 })
    }
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedPrompt) return

    const result = await deletePrompt(selectedPrompt)
    if (result.success) {
      toast.success("Document deleted successfully", { duration: 3000 })
      // Reason: Clear selection and trigger refetch
      selectPrompt(null)
      triggerPromptRefetch()
    } else {
      toast.error(result.error, { duration: 6000 })
    }
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden">
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
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-w-[80px] shrink-0">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <span className="text-xs truncate">{sortLabels[docSort]}</span>
              </Button>
            </DropdownMenuTrigger>
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
        </TooltipTrigger>
        <TooltipContent>
          <p>Sort documents by title, date, or size</p>
        </TooltipContent>
      </Tooltip>

      {/* Filter Input */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Input
            type="text"
            placeholder="Filter..."
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
            className="h-8 text-sm flex-1 max-w-[200px] min-w-[80px]"
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Filter documents by title</p>
        </TooltipContent>
      </Tooltip>

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
