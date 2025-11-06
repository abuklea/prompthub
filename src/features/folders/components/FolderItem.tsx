"use client"

import { useState } from "react"
import { Folder } from "@prisma/client"
import { useUiStore } from "@/stores/use-ui-store"
import { getFolderChildren, renameFolder, deleteFolder } from "../actions"
import { ChevronRight, Folder as FolderIcon } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface FolderItemProps {
  folder: Folder
  onUpdate?: (folderId: string, updatedFolder: Folder) => void
  onDelete?: (folderId: string) => void
}

export function FolderItem({ folder, onUpdate, onDelete }: FolderItemProps) {
  const { expandedFolders, toggleFolder, selectFolder, selectedFolder } = useUiStore()
  const [children, setChildren] = useState<Folder[]>([])
  const [loading, setLoading] = useState(false)
  const isExpanded = expandedFolders.has(folder.id)

  const handleToggle = async () => {
    toggleFolder(folder.id)
    if (!isExpanded && children.length === 0) {
      setLoading(true)
      try {
        const childFolders = await getFolderChildren(folder.id)
        setChildren(childFolders)
      } catch (error) {
        console.error("Failed to fetch folder children:", error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleRename = async () => {
    const newName = prompt("Enter new folder name", folder.name)
    if (newName && newName !== folder.name) {
      try {
        const updatedFolder = await renameFolder(folder.id, newName)
        // Update parent's state immediately
        if (onUpdate) {
          onUpdate(folder.id, updatedFolder)
        }
        // Update local state for display
        setChildren((prev) =>
          prev.map((child) => (child.id === folder.id ? updatedFolder : child))
        )
        toast.success("Folder renamed successfully")
      } catch (error) {
        console.error("Failed to rename folder:", error)
        toast.error("Failed to rename folder")
      }
    }
  }

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this folder?")) {
      try {
        await deleteFolder(folder.id)
        // Update parent's state immediately
        if (onDelete) {
          onDelete(folder.id)
        }
        toast.success("Folder deleted successfully")
      } catch (error) {
        console.error("Failed to delete folder:", error)
        toast.error("Failed to delete folder")
      }
    }
  }

  const isSelected = selectedFolder === folder.id

  return (
    <div className="pl-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
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
            <FolderIcon className="h-4 w-4 mr-2" />
            <span>{folder.name}</span>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {loading && <div className="pl-6">Loading...</div>}
      {isExpanded && !loading && (
        <div>
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
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
    </div>
  )
}
