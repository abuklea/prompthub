/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/UnsavedChangesDialog.tsx
MIME: text/typescript
Type: TypeScript (React Component)

Created: 08/11/2025 17:50 GMT+10
Last modified: 08/11/2025 17:50 GMT+10
---------------
Dialog component for confirming close of unsaved new documents.
Provides three options: Save, Discard, or Cancel.

Changelog:
08/11/2025 17:50 GMT+10 | Initial creation (P5S4eT7)
*/

"use client"

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
import { Button } from "@/components/ui/button"

interface UnsavedChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: () => void | Promise<void>
  onDiscard: () => void | Promise<void>
  documentTitle: string
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onSave,
  onDiscard,
  documentTitle,
}: UnsavedChangesDialogProps) {
  const handleSave = async () => {
    await onSave()
    onOpenChange(false)
  }

  const handleDiscard = async () => {
    await onDiscard()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Document</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{documentTitle}&rdquo; has not been saved yet.
            Do you want to save it before closing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDiscard}>
            Discard
          </Button>
          <AlertDialogAction onClick={handleSave}>
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
