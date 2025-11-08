/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/components/DocumentDialogs.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 08/11/2025 11:25 GMT+10
Last modified: 08/11/2025 11:25 GMT+10
---------------
Styled dialog components for document operations (create, rename, delete)

Changelog:
08/11/2025 11:25 GMT+10 | Initial creation with AlertDialog and Dialog
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

// Create Document Dialog
interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: string) => void
  defaultTitle?: string
}

export function CreateDocumentDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultTitle = "",
}: CreateDocumentDialogProps) {
  const [title, setTitle] = React.useState(defaultTitle)

  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle)
    }
  }, [open, defaultTitle])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      onConfirm(title.trim())
      onOpenChange(false)
      setTitle("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              Enter a title for the new document. Click create when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="document-title">Document Title</Label>
              <Input
                id="document-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
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
            <Button type="submit" disabled={!title.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Rename Document Dialog
interface RenameDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (newTitle: string) => void
  currentTitle: string
}

export function RenameDocumentDialog({
  open,
  onOpenChange,
  onConfirm,
  currentTitle,
}: RenameDocumentDialogProps) {
  const [title, setTitle] = React.useState(currentTitle)

  React.useEffect(() => {
    if (open) {
      setTitle(currentTitle)
    }
  }, [open, currentTitle])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim() && title.trim() !== currentTitle) {
      onConfirm(title.trim())
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Enter a new title for &ldquo;{currentTitle}&rdquo;. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-document-title">New Document Title</Label>
              <Input
                id="new-document-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter new document title"
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
              disabled={!title.trim() || title.trim() === currentTitle}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Delete Document Dialog
interface DeleteDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  documentTitle: string
  hasVersions?: boolean
  versionCount?: number
}

export function DeleteDocumentDialog({
  open,
  onOpenChange,
  onConfirm,
  documentTitle,
  hasVersions = false,
  versionCount = 0,
}: DeleteDocumentDialogProps) {
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
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete &ldquo;{documentTitle}&rdquo;?
            </p>
            {hasVersions && versionCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mt-3">
                <p className="font-semibold text-destructive-foreground mb-1">
                  Warning: This will permanently delete:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive-foreground">
                  <li>This document</li>
                  <li>
                    {versionCount} version{versionCount !== 1 ? "s" : ""} of this document
                  </li>
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
