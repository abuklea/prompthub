"use client"

import { useEffect, useState } from "react"
import { getRootFolders, createFolder } from "../actions"
import { Folder } from "@prisma/client"
import { FolderItem } from "./FolderItem"
import { Button } from "@/components/ui/button"

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
      await createFolder(newName, null)
    }
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
          <FolderItem key={folder.id} folder={folder} />
        ))
      )}
    </div>
  )
}
