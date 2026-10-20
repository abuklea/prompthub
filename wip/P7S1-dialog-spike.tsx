/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-dialog-spike.tsx
MIME: text/typescript
Type: TypeScript React component (research spike, not imported by the application)

Created: 20/10/2026 14:11 GMT+10
Last modified: 20/10/2026 14:22 GMT+10
---------------
P7S1 research spike for task T8. A standalone version of src/features/editor/components/VersionHistoryDialog.tsx with the
three changes decided in PRPs/docs/P7S1-editor-persistence-contracts.md. First, the history is read in an effect that
depends on `open` and `promptId`: the current component reads it inside Dialog's onOpenChange, which Radix calls only
for a change the dialog itself makes (Escape, the close button, the overlay), never when the parent sets `open`, so the
list never loads. Second, the server actions are injected, so the component runs in a test without a server. Third, a
restore is single-flight: every Restore button is disabled while one runs, the dialog cannot be closed meanwhile, and it
closes itself only when the restore succeeded. The file is split into a hook for the read, a row and the dialog so that
no function passes the 80-line lint limit. It exists to prove that with wip/P7S1-dialog-spike.test.tsx before P7S1T8
edits the production component. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-dialog-spike.test.tsx

Changelog:
20/10/2026 14:22 GMT+10 | Split into useHistory, HistoryRow and the dialog (the dialog alone was 82 lines)
20/10/2026 14:11 GMT+10 | Created
*/

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"
import type { ActionResult } from "@/types/actions"
import { useLatest } from "./P7S1-loader-spike"

export const HISTORY_FAILED = "The history could not be loaded"

export interface VersionHistoryDialogProps {
  promptId: string | null
  open: boolean
  onOpenChange(open: boolean): void
  /** Reads the snapshots of a document, newest first. EditorPane passes its timeout-limited action. */
  loadHistory(promptId: string): Promise<ActionResult<PromptVersionHistoryItem[]>>
  /** Restores one snapshot into the editor and resolves true when it did (useVersionRestore.handleRestore). */
  onRestore(versionId: number): Promise<boolean>
}

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; items: PromptVersionHistoryItem[] }

/** Reads the history of `promptId` each time the dialog opens or the document changes. */
function useHistory(open: boolean, promptId: string | null, loadHistory: VersionHistoryDialogProps["loadHistory"]): Load {
  const [load, setLoad] = useState<Load>({ status: "idle" })
  const loadHistoryRef = useLatest(loadHistory)

  useEffect(() => {
    if (!open || !promptId) {
      setLoad({ status: "idle" })
      return
    }
    // Reason: a result for a document or an opening that is gone must not replace the list shown now.
    let stale = false
    setLoad({ status: "loading" })
    loadHistoryRef.current(promptId).then(
      (result) => {
        if (stale) return
        if (!result.success) {
          toast.error(result.error)
          setLoad({ status: "failed" })
          return
        }
        setLoad({ status: "ready", items: result.data })
      },
      () => {
        if (stale) return
        toast.error(HISTORY_FAILED)
        setLoad({ status: "failed" })
      }
    )
    return () => {
      stale = true
    }
  }, [open, promptId, loadHistoryRef])

  return load
}

interface HistoryRowProps {
  item: PromptVersionHistoryItem
  /** True while any restore runs: every row is disabled, so a second request cannot start. */
  busy: boolean
  /** True for the row being restored. */
  restoring: boolean
  onRestore(versionId: number): void
}

function HistoryRow({ item, busy, restoring, onRestore }: HistoryRowProps) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{new Date(item.created_at).toLocaleString()}</p>
        <Button size="sm" onClick={() => onRestore(item.id)} disabled={busy}>
          {restoring ? "Restoring..." : "Restore"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Title: {item.title_snapshot || "[Untitled Doc]"}</p>
      <pre className="text-xs bg-muted/50 p-2 rounded-md overflow-auto max-h-36 whitespace-pre-wrap">
        {item.content_snapshot.slice(0, 1200)}
      </pre>
    </div>
  )
}

export function VersionHistoryDialog({ promptId, open, onOpenChange, loadHistory, onRestore }: VersionHistoryDialogProps) {
  const load = useHistory(open, promptId, loadHistory)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const busy = restoringId !== null

  // Reason: single-flight comes from `disabled={busy}` on every row: React flushes the state of a click before the next
  // click event is dispatched, so a second click reaches a disabled button.
  const handleRestore = useCallback(
    async (versionId: number) => {
      setRestoringId(versionId)
      try {
        if (await onRestore(versionId)) onOpenChange(false)
      } finally {
        setRestoringId(null)
      }
    },
    [onOpenChange, onRestore]
  )

  // Reason: closing mid-restore would hide the only sign that a write is in flight and invite a second request.
  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>Restore a previous snapshot of this document.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {(load.status === "idle" || load.status === "loading") && promptId && (
            <p className="text-sm text-muted-foreground">Loading history...</p>
          )}
          {load.status === "failed" && <p className="text-sm text-muted-foreground">{HISTORY_FAILED}.</p>}
          {load.status === "ready" && load.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No saved versions yet.</p>
          )}
          {load.status === "ready" &&
            load.items.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                busy={busy}
                restoring={restoringId === item.id}
                onRestore={handleRestore}
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
