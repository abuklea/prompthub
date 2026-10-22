/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/VersionHistoryDialog.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 17/07/2026 10:00 GMT+10
Last modified: 22/10/2026 10:44 GMT+10
---------------
Version history dialog for viewing and restoring previous prompt snapshots (contract: Async Completions and Failures,
decision D4). The list is read in an effect on `open` and `promptId` through the injected `loadHistory`, because a
controlled Radix Dialog never reports the parent's `open`; a result for an opening or a document that is gone is
dropped. Restore on a row only asks "Restore this version?" (RestoreQuestion); confirming calls `onRestore`, the
persistence hook's handler, which shows the result toasts. While a restore runs every Restore button is disabled and
every request to close is ignored; the dialog closes itself when the restore succeeded.

Changelog:
22/10/2026 10:44 GMT+10 | Reads the list in an effect on open and promptId (useHistory), asks "Restore this
                         version?" first (RestoreQuestion), disables every row and ignores closing while a restore
                         runs, and reports a failed read (P7S1T8 step 3)
22/10/2026 10:30 GMT+10 | Takes loadHistory and onRestore in place of calling the server actions; the restore and its
                         success toast moved into useVersionRestore (P7S1T8 step 1)
17/07/2026 10:00 GMT+10 | Extracted from EditorPane.tsx to reduce file size (F5)
*/

"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"
import { useLatest } from "@/hooks/use-latest"
import type { ActionResult } from "@/types/actions"

/** Shown, as a toast and in the list, when the history read rejected. */
export const HISTORY_FAILED = "The history could not be loaded"

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
   * Reads the document's version list, newest first. Read through a ref, so a new function each render does not
   * read the list again.
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

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; items: PromptVersionHistoryItem[] }

/** Reads the history of `promptId` each time the dialog opens or the document changes. */
function useHistory(open: boolean, promptId: string | null, loadHistory: VersionHistoryDialogProps["loadHistory"]) {
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
    const read = async () => {
      try {
        const result = await loadHistoryRef.current(promptId)
        if (stale) return
        if (!result.success) {
          toast.error(result.error)
          setLoad({ status: "failed" })
          return
        }
        setLoad({ status: "ready", items: result.data })
      } catch {
        if (stale) return
        toast.error(HISTORY_FAILED)
        setLoad({ status: "failed" })
      }
    }
    void read()
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
  /** Asks to restore this version: the question decides whether it happens. */
  onAsk(versionId: number): void
}

function HistoryRow({ item, busy, restoring, onAsk }: HistoryRowProps) {
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{new Date(item.created_at).toLocaleString()}</p>
        <Button size="sm" onClick={() => onAsk(item.id)} disabled={busy}>
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

interface RestoreQuestionProps {
  open: boolean
  onCancel(): void
  onConfirm(): void
}

/** "Restore this version?" in the project's AlertDialog pattern; Cancel and Escape close this layer only. */
function RestoreQuestion({ open, onCancel, onConfirm }: RestoreQuestionProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>
            Your current text stays in the version history, so you can come back to it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Restore</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Lists the open document's saved versions and restores one after the user confirms.
 * @param props - The document, the open state and its setter, the list reader and the restore handler.
 * @returns The history dialog and its restore question.
 */
export function VersionHistoryDialog(
  { promptId, open, onOpenChange, loadHistory, onRestore }: VersionHistoryDialogProps
) {
  const load = useHistory(open, promptId, loadHistory)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const busy = restoringId !== null

  // Reason: a question belongs to the opening and the document it was asked in; a stale id must never be confirmed.
  useEffect(() => {
    setConfirmingId(null)
  }, [open, promptId])

  // Reason: single-flight comes from `disabled={busy}` on every row: React flushes the state of a click before the
  // next click event is dispatched, so a second click reaches a disabled button.
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
    <>
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
                  onAsk={setConfirmingId}
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>
      <RestoreQuestion
        open={open && confirmingId !== null}
        onCancel={() => setConfirmingId(null)}
        onConfirm={() => {
          if (confirmingId !== null) void handleRestore(confirmingId)
        }}
      />
    </>
  )
}
