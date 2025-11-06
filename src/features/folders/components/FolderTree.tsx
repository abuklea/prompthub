"use client"

import { useEffect, useState } from "react"
import { getRootFolders, createFolder } from "../actions"
import { Folder } from "@prisma/client"
import { FolderItem } from "./FolderItem"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function FolderTree() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)

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
        toast.success("Folder created successfully")
      } catch (error) {
        console.error("Failed to create folder:", error)
        toast.error("Failed to create folder")
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

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Folders</h2>
        <Button variant="ghost" size="sm" onClick={handleNewFolder}>
          +
        </Button>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            onUpdate={handleFolderUpdate}
            onDelete={handleFolderDelete}
          />
        ))
      )}
    </div>
  )
}
