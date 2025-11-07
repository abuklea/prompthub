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
import { useUiStore, type DocSort } from "@/stores/use-ui-store"
import { createPrompt } from "../actions"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"

export function DocumentToolbar() {
  const { selectedFolder, selectedPrompt, docSort, docFilter, setDocSort, setDocFilter, selectPrompt } = useUiStore()
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
    }
    setCreatingDoc(false)
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {/* New Doc Button */}
      <Button
        size="sm"
        disabled={!selectedFolder || creatingDoc}
        onClick={handleNewDoc}
        title={!selectedFolder ? "Select a folder first" : "Create new document"}
        className="min-w-[80px] shrink-0"
      >
        {creatingDoc ? "Creating..." : "New Doc"}
      </Button>

      {/* Rename Button */}
      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPrompt}
        title={!selectedPrompt ? "Select a document first" : "Rename document"}
        className="min-w-[70px] shrink-0"
      >
        Rename
      </Button>

      {/* Delete Button */}
      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPrompt}
        title={!selectedPrompt ? "Select a document first" : "Delete document"}
        className="min-w-[60px] shrink-0"
      >
        Delete
      </Button>

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1 min-w-[120px] shrink-0">
            <span className="truncate">{sortLabels[docSort]}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
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

      {/* Filter Input */}
      <Input
        type="text"
        placeholder="Filter documents..."
        value={docFilter}
        onChange={(e) => setDocFilter(e.target.value)}
        className="flex-1 max-w-[200px] min-w-[80px]"
      />
    </div>
  )
}
