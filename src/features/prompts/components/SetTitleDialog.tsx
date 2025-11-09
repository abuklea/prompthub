/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/components/SetTitleDialog.tsx
MIME: text/typescript
Type: TypeScript (React Component)

Created: 08/11/2025 17:45 GMT+10
Last modified: 08/11/2025 17:45 GMT+10
---------------
Dialog component for setting initial document title before first save.
Validates against empty strings and placeholder patterns.

Changelog:
08/11/2025 17:45 GMT+10 | Initial creation (P5S4eT6)
*/

"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { titleValidationSchema } from "../schemas"

interface SetTitleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: string) => void
  currentTitle?: string | null  // P1T5: Allow null
}

export function SetTitleDialog({
  open,
  onOpenChange,
  onConfirm,
  currentTitle = "",
}: SetTitleDialogProps) {
  const [title, setTitle] = React.useState(currentTitle || "")
  const [error, setError] = React.useState("")

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setTitle(currentTitle || "")
      setError("")
    }
  }, [open, currentTitle])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate using Zod schema
    const result = titleValidationSchema.safeParse(title)
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    onConfirm(title.trim())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Set Document Title</DialogTitle>
            <DialogDescription>
              Please provide a title for this document before saving.
              Placeholder titles like &ldquo;[Untitled Doc]&rdquo; are not allowed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="document-title">Title *</Label>
              <Input
                id="document-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setError("") // Clear error on change
                }}
                placeholder="Enter document title"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
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
            <Button type="submit">
              Save with Title
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
