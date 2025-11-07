"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useUiStore, FolderSort } from "@/stores/use-ui-store"
import { createFolder, renameFolder, deleteFolder } from "../actions"
import { Plus, Edit, Trash2, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function FolderToolbar() {
  const { selectedFolder, folderSort, folderFilter, setFolderSort, setFolderFilter } = useUiStore()
  const router = useRouter()

  const handleNewFolder = async () => {
    const newName = prompt("Enter folder name")
    if (newName) {
      try {
        await createFolder(newName, null)
        router.refresh()
        toast.success("Folder created successfully", { duration: 3000 })
      } catch (error) {
        console.error("Failed to create folder:", error)
        toast.error("Failed to create folder", { duration: 6000 })
      }
    }
  }

  const handleRenameFolder = async () => {
    if (!selectedFolder) return
    const newName = prompt("Enter new folder name")
    if (newName) {
      try {
        await renameFolder(selectedFolder, newName)
        router.refresh()
        toast.success("Folder renamed successfully", { duration: 3000 })
      } catch (error) {
        console.error("Failed to rename folder:", error)
        toast.error("Failed to rename folder", { duration: 6000 })
      }
    }
  }

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return
    if (confirm("Are you sure you want to delete this folder?")) {
      try {
        await deleteFolder(selectedFolder)
        router.refresh()
        toast.success("Folder deleted successfully", { duration: 3000 })
      } catch (error) {
        console.error("Failed to delete folder:", error)
        toast.error("Failed to delete folder", { duration: 6000 })
      }
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
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNewFolder}
        title="New Folder"
        className="min-w-[32px] shrink-0"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRenameFolder}
        disabled={!selectedFolder}
        title="Rename Folder"
        className="min-w-[32px] shrink-0"
      >
        <Edit className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteFolder}
        disabled={!selectedFolder}
        title="Delete Folder"
        className="min-w-[32px] shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <div className="h-4 w-px bg-gray-600 mx-1 shrink-0" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" title="Sort" className="min-w-[80px] shrink-0">
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

      <Input
        type="text"
        placeholder="Filter..."
        value={folderFilter}
        onChange={(e) => setFolderFilter(e.target.value)}
        className="h-8 text-sm flex-1 max-w-[200px] min-w-[80px]"
      />
    </div>
  )
}
