"use client"

import { useEffect, useState, useMemo } from "react"
import { getRootFolders, createFolder } from "../actions"
import { Folder } from "@prisma/client"
import { FolderItem } from "./FolderItem"
import { useUiStore } from "@/stores/use-ui-store"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"
import { Loader2, Plus } from "lucide-react"
import { CreateFolderDialog } from "./FolderDialogs"
import { getRootFoldersFromCache, hasWorkspaceSnapshot, upsertFolderInCache } from "@/features/workspace/cache"

export function FolderTree() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const { folderSort, folderFilter, folderRefetchTrigger, workspacePreloading } = useUiStore()

  useEffect(() => {
    async function loadFolders() {
      const cachedRoots = getRootFoldersFromCache()
      if (cachedRoots.length > 0) {
        setFolders(cachedRoots)
        setLoading(false)
      }

      try {
        const rootFolders = await getRootFolders()
        setFolders(rootFolders)
        rootFolders.forEach((folder) => upsertFolderInCache(folder))
      } catch (error) {
        console.error("Failed to fetch root folders:", error)
      } finally {
        setLoading(false)
      }
    }

    if (!hasWorkspaceSnapshot()) {
      setLoading(true)
    }

    loadFolders()
  }, [folderRefetchTrigger])

  const handleNewFolder = () => {
    setCreateDialogOpen(true)
  }

  const handleConfirmCreate = async (name: string) => {
    const tempFolder: Folder = {
      id: `temp-${Date.now()}`,
      name,
      parent_id: null,
      created_at: new Date(),
      user_id: folders[0]?.user_id ?? "",
    }

    setFolders((prev) => [...prev, tempFolder].sort((a, b) => a.name.localeCompare(b.name)))

    try {
      const newFolder = await createFolder(name, null)
      setFolders((prev) =>
        prev
          .map((folder) => (folder.id === tempFolder.id ? newFolder : folder))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      upsertFolderInCache(newFolder)
      toast.success("Folder created successfully", { duration: 3000 })
    } catch (error) {
      setFolders((prev) => prev.filter((folder) => folder.id !== tempFolder.id))
      console.error("Failed to create folder:", error)
      toast.error("Failed to create folder", { duration: 6000 })
    }
  }

  const handleFolderUpdate = (folderId: string, updatedFolder: Folder) => {
    setFolders((prev) =>
      prev.map((folder) => (folder.id === folderId ? updatedFolder : folder))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    upsertFolderInCache(updatedFolder)
  }

  const handleFolderDelete = (folderId: string) => {
    setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
  }

  const displayedFolders = useMemo(() => {
    let result = [...folders]

    if (folderFilter) {
      const filterLower = folderFilter.toLowerCase()
      result = result.filter(folder =>
        folder.name.toLowerCase().includes(filterLower)
      )
    }

    switch (folderSort) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'date-asc':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'date-desc':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }

    return result
  }, [folders, folderSort, folderFilter])

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading folders...</div>
  }

  if (folders.length === 0) {
    return (
      <>
        <EmptyState
          icon={Plus}
          title="No folders yet"
          description="Create your first folder to start organizing your prompts. Folders help you keep your work structured and easy to find."
          actionLabel="Create Your First Folder"
          onAction={handleNewFolder}
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
      {workspacePreloading && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Syncing workspace cache…
        </div>
      )}
      <div>
        {displayedFolders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            onUpdate={handleFolderUpdate}
            onDelete={handleFolderDelete}
          />
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
