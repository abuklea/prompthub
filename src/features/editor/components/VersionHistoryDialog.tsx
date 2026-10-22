/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/VersionHistoryDialog.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 17/07/2026 10:00 GMT+10
Last modified: 22/10/2026 10:30 GMT+10
---------------
Version history dialog for viewing and restoring previous prompt snapshots.
Extracted from EditorPane.tsx (F5 decomposition). Reads the list through the injected `loadHistory` and restores
through `onRestore` (the persistence hook's handler, which shows the result toasts); it closes when that succeeds.

Changelog:
22/10/2026 10:30 GMT+10 | Takes loadHistory and onRestore in place of calling the server actions; the restore and its
                         success toast moved into useVersionRestore (P7S1T8 step 1)
17/07/2026 10:00 GMT+10 | Extracted from EditorPane.tsx to reduce file size (F5)
*/

"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import type { ActionResult } from "@/types/actions"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"

/** The props of `VersionHistoryDialog`. */
export interface VersionHistoryDialogProps {
  /** The open document, whose versions are listed; null or "" for none. */
  promptId: string | null
  /** Whether the dialog is open. */
  open: boolean
  /**
   * Opens or closes the dialog.
   * @param open - True to open it.
   */
  onOpenChange(open: boolean): void
  /**
   * Reads the document's version list, newest first.
   * @param promptId - The document.
   * @returns The version list on success; an error message otherwise.
   */
  loadHistory(promptId: string): Promise<ActionResult<PromptVersionHistoryItem[]>>
  /**
   * Restores the open document to a version.
   * @param versionId - The version to restore.
   * @returns True when the restore succeeded, which closes the dialog; false leaves it open.
   */
  onRestore(versionId: number): Promise<boolean>
}

/**
 * Lists the open document's saved versions and restores one on request.
 * @param props - The document, the open state and its setter, the list reader and the restore handler.
 * @returns The dialog.
 */
export function VersionHistoryDialog(
  { promptId, open, onOpenChange, loadHistory, onRestore }: VersionHistoryDialogProps
) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PromptVersionHistoryItem[]>([])
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null)

  const handleOpen = useCallback(async (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (!isOpen || !promptId) return

    setLoading(true)
    const result = await loadHistory(promptId)
    if (!result.success) {
      toast.error(result.error)
      setLoading(false)
      return
    }
    setItems(result.data || [])
    setLoading(false)
  }, [promptId, onOpenChange, loadHistory])

  const handleRestore = useCallback(async (versionId: number) => {
    if (!promptId) return

    setRestoringVersionId(versionId)
    const restored = await onRestore(versionId)
    if (restored) onOpenChange(false)
    setRestoringVersionId(null)
  }, [promptId, onOpenChange, onRestore])

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Restore a previous snapshot of this document.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading history...</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">No saved versions yet.</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{new Date(item.created_at).toLocaleString()}</p>
                <Button
                  size="sm"
                  onClick={() => handleRestore(item.id)}
                  disabled={restoringVersionId === item.id}
                >
                  {restoringVersionId === item.id ? "Restoring..." : "Restore"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Title: {item.title_snapshot || "[Untitled Doc]"}</p>
              <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto max-h-36 whitespace-pre-wrap">
                {item.content_snapshot.slice(0, 1200)}
              </pre>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
