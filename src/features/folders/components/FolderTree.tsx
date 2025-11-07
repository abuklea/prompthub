"use client"

import { useEffect, useState, useMemo } from "react"
import { getRootFolders, createFolder } from "../actions"
import { Folder } from "@prisma/client"
import { FolderItem } from "./FolderItem"
import { useUiStore } from "@/stores/use-ui-store"
import { toast } from "sonner"

export function FolderTree() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const { folderSort, folderFilter } = useUiStore()

  useEffect(() => {
    async function loadFolders() {
      try {
        const rootFolders = await getRootFolders()
        setFolders(rootFolders)
      } catch (error) {
        console.error("Failed to fetch root folders:", error)
      } finally {
        setLoading(false)
      }
    }
    loadFolders()
  }, [])

  const handleNewFolder = async () => {
    const newName = prompt("Enter folder name")
    if (newName) {
      try {
        const newFolder = await createFolder(newName, null)
        // Immediately update local state to show the new folder
        setFolders((prev) => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success("Folder created successfully", { duration: 3000 })
      } catch (error) {
        console.error("Failed to create folder:", error)
        toast.error("Failed to create folder", { duration: 6000 })
      }
    }
  }

  const handleFolderUpdate = (folderId: string, updatedFolder: Folder) => {
    setFolders((prev) =>
      prev.map((folder) => (folder.id === folderId ? updatedFolder : folder))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
  }

  const handleFolderDelete = (folderId: string) => {
    setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
  }

  // Apply filter and sort logic
  const displayedFolders = useMemo(() => {
    let result = [...folders]

    // Apply filter (case-insensitive)
    if (folderFilter) {
      const filterLower = folderFilter.toLowerCase()
      result = result.filter(folder =>
        folder.name.toLowerCase().includes(filterLower)
      )
    }

    // Apply sort
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
    return <div>Loading...</div>
  }

  return (
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
  )
}
