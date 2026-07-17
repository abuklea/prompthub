/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/VersionHistoryDialog.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 17/07/2026 10:00 GMT+10
Last modified: 17/07/2026 10:00 GMT+10
---------------
Version history dialog for viewing and restoring previous prompt snapshots.
Extracted from EditorPane.tsx (F5 decomposition).

Changelog:
17/07/2026 10:00 GMT+10 | Extracted from EditorPane.tsx to reduce file size (F5)
*/

"use client"

import { useState, useCallback } from "react"
import { getPromptVersionHistory, restorePromptVersion } from "@/features/prompts/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"

interface VersionHistoryDialogProps {
  promptId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: () => void
}

export function VersionHistoryDialog({ promptId, open, onOpenChange, onRestored }: VersionHistoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<PromptVersionHistoryItem[]>([])
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null)

  const handleOpen = useCallback(async (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (!isOpen || !promptId) return

    setLoading(true)
    const result = await getPromptVersionHistory({ promptId })
    if (!result.success) {
      toast.error(result.error)
      setLoading(false)
      return
    }
    setItems(result.data || [])
    setLoading(false)
  }, [promptId, onOpenChange])

  const handleRestore = useCallback(async (versionId: number) => {
    if (!promptId) return

    setRestoringVersionId(versionId)
    const result = await restorePromptVersion({ promptId, versionId })
    if (!result.success) {
      toast.error(result.error)
      setRestoringVersionId(null)
      return
    }

    toast.success("Version restored")
    onOpenChange(false)
    setRestoringVersionId(null)
    onRestored()
  }, [promptId, onOpenChange, onRestored])

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
