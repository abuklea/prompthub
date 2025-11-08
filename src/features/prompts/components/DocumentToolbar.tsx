"use client"

import { useState } from "react"
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
import { createPrompt } from "../actions"
import { toast } from "sonner"
import { FilePlus, Edit, Trash2, ArrowUpDown } from "lucide-react"

export function DocumentToolbar() {
  const { selectedFolder, selectedPrompt, docSort, docFilter, setDocSort, setDocFilter, selectPrompt, triggerPromptRefetch } = useUiStore()
  const [creatingDoc, setCreatingDoc] = useState(false)

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
            <FilePlus className="h-4 w-4" />
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
    </div>
  )
}
