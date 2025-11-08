"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUiStore, FolderSort } from "@/stores/use-ui-store"
import { createFolder, renameFolder, deleteFolder } from "../actions"
import { CreateFolderDialog, RenameFolderDialog, DeleteFolderDialog } from "./FolderDialogs"
import { Plus, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"

export function FolderToolbar() {
  const { selectedFolder, folderSort, folderFilter, setFolderSort, setFolderFilter, triggerFolderRefetch } = useUiStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder(name, null)
      triggerFolderRefetch()
      toast.success("Folder created successfully", { duration: 3000 })
    } catch (error) {
      console.error("Failed to create folder:", error)
      toast.error("Failed to create folder", { duration: 6000 })
    }
  }

  const handleRenameFolder = async (newName: string) => {
    if (!selectedFolder) return
    try {
      await renameFolder(selectedFolder, newName)
      triggerFolderRefetch()
      toast.success("Folder renamed successfully", { duration: 3000 })
    } catch (error) {
      console.error("Failed to rename folder:", error)
      toast.error("Failed to rename folder", { duration: 6000 })
    }
  }

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return
    try {
      await deleteFolder(selectedFolder)
      triggerFolderRefetch()
      toast.success("Folder deleted successfully", { duration: 3000 })
    } catch (error) {
      console.error("Failed to delete folder:", error)
      toast.error("Failed to delete folder", { duration: 6000 })
    }
  }

  const getSortLabel = (sort: FolderSort): string => {
    switch (sort) {
      case 'name-asc':
        return 'Name A-Z'
      case 'name-desc':
        return 'Name Z-A'
      case 'date-asc':
        return 'Date (Oldest)'
      case 'date-desc':
        return 'Date (Newest)'
    }
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="min-w-[32px] shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Create new folder</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRenameDialogOpen(true)}
            disabled={!selectedFolder}
            className="min-w-[32px] shrink-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Rename selected folder</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!selectedFolder}
            className="min-w-[32px] shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Delete selected folder</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-gray-600 mx-1 shrink-0" />

      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="min-w-[80px] shrink-0">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                <span className="text-xs truncate">{getSortLabel(folderSort)}</span>
              </Button>
            </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setFolderSort('name-asc')}>
            Name A-Z
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFolderSort('name-desc')}>
            Name Z-A
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFolderSort('date-asc')}>
            Date (Oldest)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFolderSort('date-desc')}>
            Date (Newest)
          </DropdownMenuItem>
        </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sort folders by name or date</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Input
            type="text"
            placeholder="Filter..."
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            className="h-8 text-sm flex-1 max-w-[200px] min-w-[80px]"
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Filter folders by name</p>
        </TooltipContent>
      </Tooltip>

      {/* Dialogs */}
      <CreateFolderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onConfirm={handleCreateFolder}
      />

      <RenameFolderDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onConfirm={handleRenameFolder}
        currentName={selectedFolder || ""}
      />

      <DeleteFolderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteFolder}
        folderName={selectedFolder || ""}
      />
    </div>
  )
}
