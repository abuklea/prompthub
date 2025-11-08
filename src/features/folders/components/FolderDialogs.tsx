/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/components/FolderDialogs.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 08/11/2025 11:20 GMT+10
Last modified: 08/11/2025 11:20 GMT+10
---------------
Styled dialog components for folder operations (create, rename, delete)

Changelog:
08/11/2025 11:20 GMT+10 | Initial creation with AlertDialog and Dialog
*/

"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"

// Create Folder Dialog
interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
  defaultName?: string
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultName = "",
}: CreateFolderDialogProps) {
  const [name, setName] = React.useState(defaultName)

  React.useEffect(() => {
    if (open) {
      setName(defaultName)
    }
  }, [open, defaultName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onConfirm(name.trim())
      onOpenChange(false)
      setName("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for the new folder. Click create when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Rename Folder Dialog
interface RenameFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newName: string) => void
  currentName: string
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  onConfirm,
  currentName,
}: RenameFolderDialogProps) {
  const [name, setName] = React.useState(currentName)

  React.useEffect(() => {
    if (open) {
      setName(currentName)
    }
  }, [open, currentName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && name.trim() !== currentName) {
      onConfirm(name.trim())
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for &ldquo;{currentName}&rdquo;. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-folder-name">New Folder Name</Label>
              <Input
                id="new-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter new folder name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === currentName}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Delete Folder Dialog
interface DeleteFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  folderName: string
  hasSubfolders?: boolean
  hasDocuments?: boolean
  subfolderCount?: number
  documentCount?: number
}

export function DeleteFolderDialog({
  open,
  onOpenChange,
  onConfirm,
  folderName,
  hasSubfolders = false,
  hasDocuments = false,
  subfolderCount = 0,
  documentCount = 0,
}: DeleteFolderDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete &ldquo;{folderName}&rdquo;?
            </p>
            {(hasSubfolders || hasDocuments) && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
                <p className="font-semibold text-destructive-foreground mb-1">
                  Warning: This will permanently delete:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive-foreground">
                  <li>This folder</li>
                  {hasSubfolders && (
                    <li>
                      {subfolderCount} subfolder{subfolderCount !== 1 ? "s" : ""} (and their contents)
                    </li>
                  )}
                  {hasDocuments && (
                    <li>
                      {documentCount} document{documentCount !== 1 ? "s" : ""}
                    </li>
                  )}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground text-sm mt-3">
              This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
