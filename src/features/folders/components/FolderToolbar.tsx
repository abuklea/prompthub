/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/components/FolderToolbar.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 07/11/2025 16:21 GMT+10
Last modified: 29/10/2026 20:55 GMT+10
---------------
The folder panel toolbar: creates a root folder, renames and deletes the selected folder, and sets the folder sort and
filter. A delete closes the tabs of every prompt in the deleted tree, drops the tree from the workspace cache, clears
the selection and refetches both panels.

Changelog:
29/10/2026 20:55 GMT+10 | P7S2T5: every folder action call branches on its ActionResult and toasts its error; a
                         delete closes the tabs of every returned prompt id and calls removeFolderTreeFromCache with the
                         returned folder and prompt ids (findings F-2, F-6, issue #113); header added (F-9)
07/11/2025 16:21 GMT+10 | Created (commit 43fd886)
*/

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUiStore, FolderSort } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { createFolder, renameFolder, deleteFolder } from "../actions"
import { CreateFolderDialog, RenameFolderDialog, DeleteFolderDialog } from "./FolderDialogs"
import { Plus, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import { removeFolderTreeFromCache } from "@/features/workspace/cache"

export function FolderToolbar() {
  const { selectedFolder, folderSort, folderFilter, setFolderSort, setFolderFilter, triggerFolderRefetch, triggerPromptRefetch, selectFolder } = useUiStore()
  const { closeTabsByPromptId } = useTabStore()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleCreateFolder = async (name: string) => {
    try {
      const result = await createFolder({ name, parentId: null })
      if (!result.success) {
        toast.error(result.error, { duration: 6000 })
        return
      }
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
      const result = await renameFolder({ folderId: selectedFolder, name: newName })
      if (!result.success) {
        toast.error(result.error, { duration: 6000 })
        return
      }
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
      const result = await deleteFolder({ folderId: selectedFolder })
      if (!result.success) {
        toast.error(result.error, { duration: 6000 })
        return
      }
      // Reason: the ids cover the deleted folder and every descendant folder, and every prompt filed in any of them
      const { folderIds, promptIds } = result.data

      // Reason: close the tabs of every deleted prompt, then drop the whole tree from the workspace cache, so the
      // refetch below does not show the deleted folders from the cache first
      promptIds.forEach((promptId) => {
        closeTabsByPromptId(promptId)
      })
      removeFolderTreeFromCache({ folderIds, promptIds })

      // Reason: Clear folder selection since it's been deleted (P5S4b - folder deletion fix)
      selectFolder(null)
      // Reason: Trigger both folder and prompt refetch to update both panels (P5S4b)
      triggerFolderRefetch()
      triggerPromptRefetch()
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
    <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
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

      {/* Reason: Removed Tooltip wrapper - DropdownMenu already has descriptive text */}
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

      {/* Reason: Removed Tooltip wrapper - Input has clear placeholder text */}
      <Input
        type="text"
        placeholder="Filter..."
        value={folderFilter}
        onChange={(e) => setFolderFilter(e.target.value)}
        className="h-8 text-sm flex-1 max-w-[200px] min-w-[100px] shrink-0"
      />

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
