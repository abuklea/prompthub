/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/loader-state.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 09:14 GMT+10
Last modified: 22/10/2026 09:14 GMT+10
---------------
The document loader's state and its reducer. The document and its baseline arrive in one action, so no render ever sees
one without the other: `synced.promptId === promptId` is true only in renders whose title, content and promptData
belong to that document.

Changelog:
22/10/2026 09:14 GMT+10 | Created from the state part of the P7S1 loader spike (P7S1T5)
*/

import type { SetStateAction } from "react"
import type { PromptWithFolder } from "./document-cache"
import type { DocFields, SyncedState } from "./sync"

/** The fields that belong to one loaded document. */
export interface DocumentFields {
  /** The prompt row as last loaded or saved; null when no document is applied. */
  promptData: PromptWithFolder | null
  /** The working title. */
  title: string | null
  /** The working content. */
  content: string
  /** When the document was last saved; the row's `updated_at` after a load. */
  lastSaved: Date | null
  /** The baseline the server is known to hold; null when no document is applied. */
  synced: SyncedState | null
}

/** The loader's whole state: one document's fields plus the load status. */
export interface LoaderState extends DocumentFields {
  /** True while a document is being looked up (the identity or the fetch is pending). */
  loading: boolean
  /** The message of the last failed load; "" when none. */
  error: string
}

/** The actions the reducer takes. */
export type LoaderAction =
  | { type: "wipe"; loading?: boolean }
  | { type: "loading" }
  | { type: "apply"; doc: DocumentFields }
  | { type: "fail"; message: string }
  | { type: "title"; value: SetStateAction<string | null> }
  | { type: "content"; value: SetStateAction<string> }
  | { type: "synced"; next: SyncedState; version: boolean; now: Date }
  | { type: "serverState"; promptId: string; row: DocFields; now: Date }

/** No document: what a wipe leaves. */
export const EMPTY_DOCUMENT: DocumentFields = {
  promptData: null,
  title: null,
  content: "",
  lastSaved: null,
  synced: null,
}

/**
 * The state of the first render.
 * @param promptId - The document the loader opens with; "" for none.
 * @returns No document, no error, and `loading` true exactly when there is a document to load.
 */
export function initialLoaderState(promptId: string): LoaderState {
  return { ...EMPTY_DOCUMENT, error: "", loading: Boolean(promptId) }
}

const resolve = <T>(value: SetStateAction<T>, previous: T): T =>
  typeof value === "function" ? (value as (previous: T) => T)(previous) : value

/**
 * The row as a saved version or a restore leaves it.
 * @param previous - The row before the write.
 * @param fields - The title and content the write stored.
 * @param now - When the write was confirmed.
 * @returns The row with the new title and content, stamped `now`.
 */
export function versioned(previous: PromptWithFolder, fields: DocFields, now: Date): PromptWithFolder {
  return { ...previous, title: fields.title, content: fields.content, updated_at: now }
}

/**
 * The loader's reducer.
 * @param state - The current state.
 * @param action - What happened.
 * @returns The next state; the same object when a `loading` action changes nothing.
 */
export function loaderReducer(state: LoaderState, action: LoaderAction): LoaderState {
  switch (action.type) {
    case "wipe":
      return { ...state, ...EMPTY_DOCUMENT, error: "", loading: action.loading ?? state.loading }
    case "loading":
      return state.loading ? state : { ...state, loading: true }
    case "apply":
      // Reason: the document and its baseline arrive in one action, so no render sees one without the other.
      return { ...state, ...action.doc, error: "", loading: false }
    case "fail":
      return { ...state, error: action.message, loading: false }
    case "title":
      return { ...state, title: resolve(action.value, state.title) }
    case "content":
      return { ...state, content: resolve(action.value, state.content) }
    case "synced": {
      const { promptData } = state
      return {
        ...state,
        synced: action.next,
        lastSaved: action.now,
        promptData: action.version && promptData ? versioned(promptData, action.next, action.now) : promptData,
      }
    }
    case "serverState":
      return {
        ...state,
        title: action.row.title,
        content: action.row.content,
        promptData: state.promptData ? versioned(state.promptData, action.row, action.now) : state.promptData,
        synced: { promptId: action.promptId, ...action.row },
        lastSaved: action.now,
      }
  }
}
