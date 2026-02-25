"use client"

import { useMemo, useState } from "react"
import { Folder } from "@prisma/client"
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { renameFolder, deleteFolder, createFolder } from "../actions"
import { ChevronRight, Folder as FolderIcon, Plus } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CreateFolderDialog, RenameFolderDialog, DeleteFolderDialog } from "./FolderDialogs"
import { OverflowTooltipText } from "@/components/ui/overflow-tooltip-text"

interface FolderItemProps {
  folder: Folder
  allFolders: Folder[]
  depth?: number
}

export function FolderItem({ folder, allFolders, depth = 0 }: FolderItemProps) {
  const { expandedFolders, toggleFolder, selectFolder, selectedFolder, upsertFolder, removeFolder } = useUiStore()
  const { closeTabsByPromptId } = useTabStore()
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createSubfolderDialogOpen, setCreateSubfolderDialogOpen] = useState(false)
  const isExpanded = expandedFolders.has(folder.id)
  const MAX_DEPTH = 5

  const children = useMemo(
    () => allFolders.filter((candidate) => candidate.parent_id === folder.id).sort((a, b) => a.name.localeCompare(b.name)),
    [allFolders, folder.id]
  )

  const handleConfirmRename = async (newName: string) => {
    const previousName = folder.name
    upsertFolder({ ...folder, name: newName })

    try {
      const updatedFolder = await renameFolder(folder.id, newName)
      upsertFolder(updatedFolder)
      toast.success("Folder renamed successfully", { duration: 3000 })
    } catch (error) {
      upsertFolder({ ...folder, name: previousName })
      console.error("Failed to rename folder:", error)
      toast.error("Failed to rename folder", { duration: 6000 })
    }
  }

  const handleConfirmDelete = async () => {
    try {
      const promptIds = await deleteFolder(folder.id)
      promptIds.forEach((promptId) => closeTabsByPromptId(promptId))
      removeFolder(folder.id)
      toast.success("Folder deleted successfully", { duration: 3000 })
    } catch (error) {
      console.error("Failed to delete folder:", error)
      toast.error("Failed to delete folder", { duration: 6000 })
    }
  }

  const handleConfirmCreateSubfolder = async (name: string) => {
    const optimisticFolder: Folder = {
      ...folder,
      id: `temp-${Date.now()}`,
      name,
      parent_id: folder.id,
      created_at: new Date(),
    }

    upsertFolder(optimisticFolder)

    try {
      const newFolder = await createFolder(name, folder.id)
      removeFolder(optimisticFolder.id)
      upsertFolder(newFolder)
      if (!isExpanded) toggleFolder(folder.id)
      toast.success("Subfolder created successfully", { duration: 3000 })
    } catch (error) {
      removeFolder(optimisticFolder.id)
      console.error("Failed to create subfolder:", error)
      toast.error("Failed to create subfolder", { duration: 6000 })
    }
  }

  const isSelected = selectedFolder === folder.id
  const indentPx = depth * 14

  return (
    <div style={{ paddingLeft: `${indentPx}px` }}>
      <div
        className={`flex items-center p-1 rounded-md cursor-pointer ${isSelected ? "bg-gray-700" : "hover:bg-gray-800"}`}
        onClick={() => selectFolder(folder.id)}
      >
        <ChevronRight
          className={`h-4 w-4 mr-1 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          onClick={(e) => {
            e.stopPropagation()
            toggleFolder(folder.id)
          }}
        />
        <FolderIcon className="h-4 w-4 mr-2 shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <OverflowTooltipText text={folder.name} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="p-1 hover:bg-gray-600 rounded" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs">⋮</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div>
          {depth < MAX_DEPTH && (
            <div className="pl-4 py-1">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCreateSubfolderDialogOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />
                Add Subfolder
              </Button>
            </div>
          )}
          {children.map((child) => (
            <FolderItem key={child.id} folder={child} allFolders={allFolders} depth={depth + 1} />
          ))}
        </div>
      )}

      <RenameFolderDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        onConfirm={handleConfirmRename}
        currentName={folder.name}
      />

      <DeleteFolderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        folderName={folder.name}
        hasSubfolders={children.length > 0}
        subfolderCount={children.length}
      />

      <CreateFolderDialog
        open={createSubfolderDialogOpen}
        onOpenChange={setCreateSubfolderDialogOpen}
        onConfirm={handleConfirmCreateSubfolder}
      />
    </div>
  )
}
