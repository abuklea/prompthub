/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/sync.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:24 GMT+10
---------------
Pure helpers comparing the editor's working copy with the server's baseline: equality, autosave, view and status.

Changelog:
22/10/2026 08:21 GMT+10 | Created from the sync part of the P7S1 draft spike (P7S1T4)
*/

/** The editable fields of a document. */
export interface DocFields {
  /** The document title; null for a document that has never been titled. */
  title: string | null
  /** The document text. */
  content: string
}

/** What the server holds for one document: the last state a write confirmed or a read returned. */
export interface SyncedState extends DocFields {
  /** The document these fields belong to. */
  promptId: string
}

/** What the editor pane renders. */
export type ViewState = "empty" | "error" | "loading" | "editor"

/** The footer's save status. */
export type SaveStatus = "saving" | "unsaved" | "saved"

/**
 * Compares two sets of fields, treating a null title and an empty title as equal.
 * @param a - The first fields.
 * @param b - The second fields.
 * @returns True when the titles (null read as "") and the contents are equal.
 */
export function sameFields(a: DocFields, b: DocFields): boolean {
  return (a.title ?? "") === (b.title ?? "") && a.content === b.content
}

/**
 * Decides whether the working copy of a document should be autosaved.
 * @param promptId - The document the working copy belongs to.
 * @param working - The working copy.
 * @param synced - The baseline the server is known to hold, or null when none is known.
 * @returns True when the baseline belongs to `promptId`, the working title is not blank, and the fields differ.
 */
export function needsAutoSave(promptId: string, working: DocFields, synced: SyncedState | null): boolean {
  if (synced === null || synced.promptId !== promptId) return false
  // Reason: null?.trim() is undefined and undefined !== "" is true, so test truthiness, never inequality with "".
  return Boolean(working.title?.trim()) && !sameFields(working, synced)
}

/**
 * Decides what the editor pane renders. An error shows before the loading screen, because a failed load is neither
 * loading nor ready; the editor mounts only when `ready`, so Monaco never first renders another document's text.
 * @param s - The open document id ("" for none), the load error ("" for none), and the loader's `loading` and `ready`.
 * @returns "empty" without a document, "error" after a failed load, "editor" once ready, and "loading" otherwise.
 */
export function viewState(s: { promptId: string; error: string; loading: boolean; ready: boolean }): ViewState {
  if (!s.promptId) return "empty"
  if (s.error) return "error"
  return s.loading || !s.ready ? "loading" : "editor"
}

/**
 * Derives the footer's status from the baseline, so a restored draft or an untitled document never reads as saved.
 * @param s - Whether an autosave is in flight, the working copy, and the baseline (null when none is known).
 * @returns "saving" during an autosave, "saved" when the working copy equals the baseline, "unsaved" otherwise.
 */
export function saveStatus(s: { autoSaving: boolean; working: DocFields; synced: SyncedState | null }): SaveStatus {
  if (s.autoSaving) return "saving"
  return s.synced !== null && sameFields(s.working, s.synced) ? "saved" : "unsaved"
}
