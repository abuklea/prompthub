/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/components/FolderItem.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 06/11/2025 14:33 GMT+10
Last modified: 29/10/2026 20:54 GMT+10
---------------
One folder of the folder tree: expands to load its children, and renames, deletes and adds subfolders through the
folder actions, with optimistic updates that roll back when an action fails. A delete closes the tabs of every prompt
in the deleted tree and drops the tree from the workspace cache.

Changelog:
29/10/2026 20:54 GMT+10 | P7S2T5: every folder action call branches on its ActionResult and toasts its error; a
                         delete closes the tabs of every returned prompt id and calls removeFolderTreeFromCache with the
                         returned folder and prompt ids (findings F-2, F-6, issue #113); header added (F-9)
06/11/2025 14:33 GMT+10 | Created (commit fb2faa7)
*/

"use client"

import { useState } from "react"
import { Folder } from "@prisma/client"
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { getFolderChildren, renameFolder, deleteFolder, createFolder } from "../actions"
import { ChevronRight, Folder as FolderIcon, Loader2, Plus } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CreateFolderDialog, RenameFolderDialog, DeleteFolderDialog } from "./FolderDialogs"
import { OverflowTooltipText } from "@/components/ui/overflow-tooltip-text"
import { getFolderChildrenFromCache, removeFolderTreeFromCache, upsertFolderInCache } from "@/features/workspace/cache"

interface FolderItemProps {
  folder: Folder
  depth?: number
  onUpdate?: (folderId: string, updatedFolder: Folder) => void
  onDelete?: (folderId: string) => void
}

export function FolderItem({ folder, depth = 0, onUpdate, onDelete }: FolderItemProps) {
  const { expandedFolders, toggleFolder, selectFolder, selectedFolder } = useUiStore()
  const { closeTabsByPromptId } = useTabStore()
  const [children, setChildren] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createSubfolderDialogOpen, setCreateSubfolderDialogOpen] = useState(false)
  const isExpanded = expandedFolders.has(folder.id)
  const MAX_DEPTH = 5

  const handleToggle = async () => {
    toggleFolder(folder.id)
    if (!isExpanded && children.length === 0) {
      const cachedChildren = getFolderChildrenFromCache(folder.id)
      if (cachedChildren.length > 0) {
        setChildren(cachedChildren)
        return
      }

      setLoading(true)
      try {
        const result = await getFolderChildren({ parentId: folder.id })
        if (!result.success) {
          console.error("Failed to fetch folder children:", result.error)
          return
        }
        setChildren(result.data)
        result.data.forEach((child) => upsertFolderInCache(child))
      } catch (error) {
        console.error("Failed to fetch folder children:", error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleRename = () => {
    setRenameDialogOpen(true)
  }

  const handleConfirmRename = async (newName: string) => {
    const previousName = folder.name
    const rollback = () => {
      if (onUpdate) {
        onUpdate(folder.id, { ...folder, name: previousName })
      }
    }

    // Optimistic update for snappy UI
    if (onUpdate) {
      onUpdate(folder.id, { ...folder, name: newName })
    }

    try {
      const result = await renameFolder({ folderId: folder.id, name: newName })
      if (!result.success) {
        rollback()
        toast.error(result.error, { duration: 6000 })
        return
      }
      const updatedFolder = result.data
      // Reconcile with server response
      if (onUpdate) {
        onUpdate(folder.id, updatedFolder)
        upsertFolderInCache(updatedFolder)
      }
      // Update local state for display
      setChildren((prev) =>
        prev.map((child) => (child.id === folder.id ? updatedFolder : child))
      )
      toast.success("Folder renamed successfully", { duration: 3000 })
    } catch (error) {
      // Reason: a rejected call (a network failure, say), not a failed result; roll back the optimistic update
      rollback()
      console.error("Failed to rename folder:", error)
      toast.error("Failed to rename folder", { duration: 6000 })
    }
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    try {
      const result = await deleteFolder({ folderId: folder.id })
      if (!result.success) {
        toast.error(result.error, { duration: 6000 })
        return
      }
      // Reason: the ids cover the deleted folder and every descendant folder, and every prompt filed in any of them
      const { folderIds, promptIds } = result.data

      // Reason: close the tabs of every deleted prompt, then drop the whole tree from the workspace cache
      promptIds.forEach((promptId) => {
        closeTabsByPromptId(promptId)
      })
      removeFolderTreeFromCache({ folderIds, promptIds })
      if (onDelete) {
        onDelete(folder.id)
      }
      toast.success("Folder deleted successfully", { duration: 3000 })
    } catch (error) {
      console.error("Failed to delete folder:", error)
      toast.error("Failed to delete folder", { duration: 6000 })
    }
  }

  const handleAddSubfolder = () => {
    setCreateSubfolderDialogOpen(true)
  }

  const handleConfirmCreateSubfolder = async (name: string) => {
    const tempId = `temp-${Date.now()}`
    const optimisticFolder = {
      ...folder,
      id: tempId,
      name,
      parent_id: folder.id,
      created_at: new Date(),
    }

    const rollback = () => setChildren((prev) => prev.filter((child) => child.id !== tempId))

    // Optimistic add to children
    setChildren((prev) => [...prev, optimisticFolder].sort((a, b) => a.name.localeCompare(b.name)))

    try {
      const result = await createFolder({ name, parentId: folder.id })
      if (!result.success) {
        rollback()
        toast.error(result.error, { duration: 6000 })
        return
      }
      const newFolder = result.data
      upsertFolderInCache(newFolder)
      // Reconcile optimistic child with server response
      setChildren((prev) =>
        prev
          .map((child) => (child.id === tempId ? newFolder : child))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      // Expand folder if not already expanded
      if (!isExpanded) {
        toggleFolder(folder.id)
      }
      toast.success("Subfolder created successfully", { duration: 3000 })
    } catch (error) {
      // Reason: a rejected call (a network failure, say), not a failed result; roll back the optimistic add
      rollback()
      console.error("Failed to create subfolder:", error)
      toast.error("Failed to create subfolder", { duration: 6000 })
    }
  }

  const isSelected = selectedFolder === folder.id
  // Calculate indentation based on depth (pl-4, pl-8, pl-12, pl-16)
  const indentClass = depth === 0 ? "pl-4" : `pl-${Math.min(depth, 4) * 4}`

  return (
    <div className={indentClass}>
      <div
        className={`flex items-center p-1 rounded-md cursor-pointer ${
          isSelected ? "bg-gray-700" : "hover:bg-gray-800"
        }`}
        onClick={() => selectFolder(folder.id)}
      >
        <ChevronRight
          className={`h-4 w-4 mr-1 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          onClick={(e) => {
            e.stopPropagation()
            handleToggle()
          }}
        />
        <FolderIcon className="h-4 w-4 mr-2 shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0">
          <OverflowTooltipText text={folder.name} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-1 hover:bg-gray-600 rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs">⋮</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {loading && <div className="pl-6 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading...</div>}
      {isExpanded && !loading && (
        <div>
          {depth < MAX_DEPTH && (
            <div className="pl-4 py-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={handleAddSubfolder}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Subfolder
              </Button>
            </div>
          )}
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              onUpdate={(childId, updatedChild) => {
                setChildren((prev) =>
                  prev.map((c) => (c.id === childId ? updatedChild : c))
                )
              }}
              onDelete={(childId) => {
                setChildren((prev) => prev.filter((c) => c.id !== childId))
              }}
            />
          ))}
        </div>
      )}

      {/* Dialog components */}
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
