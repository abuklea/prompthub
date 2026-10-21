/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useAutoSave.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 07/11/2025 16:12 GMT+10
Last modified: 22/10/2026 09:40 GMT+10
---------------
Debounced autosave with a baseline (decision D3): a write is due only while the working copy of the open document
differs from what the server holds for it, under a non-blank title, so nothing is written on mount or for an edit
reverted to the baseline (#35).

Changelog:
22/10/2026 09:40 GMT+10 | Takes the baseline and writes only when needsAutoSave; onSave read through a ref; a null
                         promptId cancels a pending write; AUTOSAVE_DELAY_MS (P7S1T6)
07/11/2025 16:12 GMT+10 | Initial creation (P5S3bT11)
*/

import { useEffect } from "react"
import { useLatest } from "@/hooks/use-latest"
import { needsAutoSave, type SyncedState } from "../sync"

/** How long the working copy must stay unchanged before it is autosaved, in milliseconds. */
export const AUTOSAVE_DELAY_MS = 500

/** The inputs of `useAutoSave`. */
export interface UseAutoSaveOptions {
  /** The open document; null disables the hook and cancels a pending write. */
  promptId: string | null
  /** The working title; a blank or null title is never autosaved. */
  title: string | null
  /** The working content. */
  content: string
  /** What the server holds; a write is due only while the working copy of `promptId` differs from it. */
  baseline: SyncedState | null
  /** The debounce delay in milliseconds; `AUTOSAVE_DELAY_MS` when omitted. */
  delay?: number
  /**
   * Sends the write. Read through a ref, so a new function each render never re-arms the timer.
   * @param promptId - The document.
   * @param title - The working title at the time the timer fired.
   * @param content - The working content at the time the timer fired.
   */
  onSave(promptId: string, title: string | null, content: string): void
}

/**
 * Calls `onSave` once the working copy has stayed unchanged for `delay` and differs from the baseline. Any change of
 * the inputs, the baseline included, cancels the pending write and re-evaluates.
 * @param options - The document, its working copy, its baseline, the delay and the callback.
 */
export function useAutoSave(options: UseAutoSaveOptions): void {
  const { promptId, title, content, baseline, delay = AUTOSAVE_DELAY_MS } = options
  // Reason: a caller that builds a new onSave each render must not re-arm the debounce.
  const onSaveRef = useLatest(options.onSave)
  useEffect(() => {
    if (!promptId || !needsAutoSave(promptId, { title, content }, baseline)) return
    const timer = setTimeout(() => onSaveRef.current(promptId, title, content), delay)
    return () => clearTimeout(timer)
  }, [promptId, title, content, baseline, delay, onSaveRef])
}
