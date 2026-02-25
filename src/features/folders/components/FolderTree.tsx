"use client"

import { useMemo, useState } from "react"
import { Folder } from "@prisma/client"
import { createFolder } from "../actions"
import { FolderItem } from "./FolderItem"
import { useUiStore } from "@/stores/use-ui-store"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2, Plus } from "lucide-react"
import { CreateFolderDialog } from "./FolderDialogs"

export function FolderTree() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { folderSort, folderFilter, folders, workspaceReady, upsertFolder, removeFolder } = useUiStore()

  const handleConfirmCreate = async (name: string) => {
    const tempFolder: Folder = {
      id: `temp-${Date.now()}`,
      name,
      parent_id: null,
      created_at: new Date(),
      user_id: folders[0]?.user_id ?? "",
    }

    upsertFolder(tempFolder)

    try {
      const newFolder = await createFolder(name, null)
      removeFolder(tempFolder.id)
      upsertFolder(newFolder)
      toast.success("Folder created successfully", { duration: 3000 })
    } catch (error) {
      removeFolder(tempFolder.id)
      console.error("Failed to create folder:", error)
      toast.error("Failed to create folder", { duration: 6000 })
    }
  }

  const displayedFolders = useMemo(() => {
    let result = folders.filter((folder) => folder.parent_id === null)

    if (folderFilter) {
      const filterLower = folderFilter.toLowerCase()
      result = result.filter((folder) => folder.name.toLowerCase().includes(filterLower))
    }

    switch (folderSort) {
      case 'name-asc':
        result = result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result = result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'date-asc':
        result = result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'date-desc':
        result = result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }

    return result
  }, [folders, folderSort, folderFilter])

  if (!workspaceReady) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading folders...
      </div>
    )
  }

  if (displayedFolders.length === 0) {
    return (
      <>
        <EmptyState
          icon={Plus}
          title="No folders yet"
          description="Create your first folder to start organizing your prompts."
          actionLabel="Create Your First Folder"
          onAction={() => setCreateDialogOpen(true)}
        />

        <CreateFolderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onConfirm={handleConfirmCreate}
        />
      </>
    )
  }

  return (
    <>
      <div>
        {displayedFolders.map((folder) => (
          <FolderItem key={folder.id} folder={folder} allFolders={folders} />
        ))}
      </div>

      <CreateFolderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onConfirm={handleConfirmCreate}
      />
    </>
  )
}
