"use client"

import { useState } from "react"
import { Folder } from "@prisma/client"
import { useUiStore } from "@/stores/use-ui-store"
import { getFolderChildren, renameFolder, deleteFolder } from "../actions"
import { ChevronRight, Folder as FolderIcon } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function FolderItem({ folder }: { folder: Folder }) {
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
    if (newName) {
      await renameFolder(folder.id, newName)
    }
  }

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this folder?")) {
      await deleteFolder(folder.id)
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
            <FolderItem key={child.id} folder={child} />
          ))}
        </div>
      )}
    </div>
  )
}
