/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/loader-protocol.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:57 GMT+10
Last modified: 22/10/2026 09:39 GMT+10
---------------
The document loader protocol: the io contract through which the loader fetches a document, looks up the signed-in user
and reaches the browser storage, and `runLoad`, the paths P0 to P7 of one load (no document, identity pending, wipe,
cache hit, fetch, success, failure, abort). On success the draft decision of the draft protocol picks the working
content: a stored draft that applies, else the server's, with a conflicting draft stashed and offered by a toast. The
hook in hooks/useDocumentLoader.ts runs it from its load effect.

Changelog:
22/10/2026 09:39 GMT+10 | The draft decision replaces the raw-draft restore: restoreDraft, secure, warnConflict,
                         RESTORED_TOAST, the CONFLICT_* constants and LoadContext.toastIds (P7S1T6)
22/10/2026 09:14 GMT+10 | Added LoadContext, runLoad, fetchDocument, commit and LOAD_FAILED (P7S1T5 step 3)
22/10/2026 08:57 GMT+10 | Created with the DocumentLoaderIo contract (P7S1T5 step 1)
*/

import type { Dispatch, MutableRefObject } from "react"
import { toast } from "sonner"
import type { ActionResult } from "@/types/actions"
import { getCachedDocument, type PromptWithFolder } from "./document-cache"
import {
  discardRead,
  hashContent,
  readDraft,
  resolveDraft,
  stashConflict,
  writeDraft,
  type DraftDecision,
  type DraftStorage,
  type ReadDraft,
} from "./draft"
import type { DocumentFields, LoaderAction } from "./loader-state"
import type { DocFields } from "./sync"

/** The error a rejected document fetch is reported with. */
export const LOAD_FAILED = "Failed to load the document"
/** The toast shown when a stored draft is applied as the working content. */
export const RESTORED_TOAST = "Restored unsaved changes from browser storage"
/** The warning shown when a stored draft lost to the server's content. */
export const CONFLICT_TOAST = "Local unsaved changes were not restored: they differ from the saved document"
/** The label of the conflict toast's action, which puts the stashed text into the editor. */
export const CONFLICT_ACTION = "Restore my text"
/** How long the conflict toast stays, in milliseconds. */
export const CONFLICT_TOAST_MS = 20_000

/**
 * The outside world the document loader reads: the server, the session and the browser storage. The real
 * implementation is a module-level constant in `EditorPane`, so its identity is stable across renders; a test passes
 * fakes.
 */
export interface DocumentLoaderIo {
  /**
   * Fetches a document with its folder. Real: `(promptId) => withTimeout(getPromptDetails({ promptId }))`.
   * @param promptId - The document to fetch.
   * @returns The action's result; on success its `data` is the prompt row with its folder.
   * @throws The fetch's rejection, or the `withTimeout` error when the request takes longer than its limit.
   */
  fetchPrompt(promptId: string): Promise<ActionResult>
  /**
   * Looks up the signed-in user in the browser. Looked up on every mount and never remembered.
   * @returns The user's id, or `ANONYMOUS` when there is no session or the lookup fails.
   */
  getUserId(): Promise<string>
  /**
   * Returns the browser storage that holds drafts. Real: `getBrowserStorage`. Called inside effects only.
   * @returns The storage, or null on the server and when the browser blocks it.
   */
  getStorage(): DraftStorage | null
}

/** Everything one run of the load protocol reads and writes. */
export interface LoadContext {
  /** The document to load; "" for none. */
  promptId: string
  /** The resolved identity; "" while the lookup is pending. */
  userId: string
  /** The io of the render that started the run. */
  io: DocumentLoaderIo
  /** Aborted when the run is superseded (a new document or identity) or the editor unmounts. */
  signal: AbortSignal
  /** The loader's reducer dispatch. */
  dispatch: Dispatch<LoaderAction>
  /** The Monaco onChange guard: the document whose content the editor holds, or null. */
  monacoPromptIdRef: MutableRefObject<string | null>
  /** The toasts whose action this run owns; the effect cleanup dismisses them, so a dead action is never offered. */
  toastIds: Array<string | number>
}

/**
 * Applies a document and its baseline in one action and lets the editor accept its changes.
 * @param ctx - The run.
 * @param doc - The document's fields, `synced` included.
 */
export function commit(ctx: LoadContext, doc: DocumentFields): void {
  ctx.monacoPromptIdRef.current = ctx.promptId
  ctx.dispatch({ type: "apply", doc })
}

/**
 * Stashes the text of a draft that lost to the server and offers it once, by a warning toast whose action puts it back
 * into the editor while the same document is open. Reason: a conflict never deletes text; the toast is dismissed when
 * the run's effect cleans up, because its action would then dispatch into state nobody renders.
 * @returns False when the storage refused the stash, so the caller leaves the draft where it is.
 */
function warnConflict(ctx: LoadContext, storage: DraftStorage | null, content: string): boolean {
  const kept = stashConflict(storage, ctx.promptId, content)
  const id = toast.warning(CONFLICT_TOAST, {
    duration: CONFLICT_TOAST_MS,
    action: {
      label: CONFLICT_ACTION,
      onClick: () => {
        if (ctx.monacoPromptIdRef.current === ctx.promptId) ctx.dispatch({ type: "content", value: content })
      },
    },
  })
  ctx.toastIds.push(id)
  return kept
}

/**
 * Puts the text of a stored draft somewhere safe before the draft is removed: a conflict is stashed, and a legacy value
 * that applies is migrated to a v1 draft against the server's content. Any other draft needs nothing.
 * @returns False when the storage refused, and the stored value then stays for the next load.
 */
function secure(
  ctx: LoadContext,
  storage: DraftStorage | null,
  server: DocFields,
  read: ReadDraft,
  decision: DraftDecision
): boolean {
  if (decision.kind === "conflict") return warnConflict(ctx, storage, read.draft.content)
  if (decision.kind === "apply" && read.legacy) {
    return writeDraft(storage, ctx.promptId, { content: decision.content, base: hashContent(server.content) }) !== null
  }
  return true
}

/**
 * The working content for a document just read from the server: a stored draft that applies, else the server's.
 * Reason: a draft that does not apply, or a legacy value, was consumed here, so this is the only place that removes
 * it, and only after its text is safe elsewhere; an applied v1 draft stays for the draft writer to rewrite or clear.
 */
function restoreDraft(ctx: LoadContext, server: DocFields): string {
  const storage = ctx.io.getStorage()
  const read = readDraft(storage, ctx.promptId)
  const decision = resolveDraft(server, read?.draft ?? null)
  const consumed = decision.kind !== "apply" || read?.legacy === true
  if (read && secure(ctx, storage, server, read, decision) && consumed) discardRead(storage, ctx.promptId, read)
  if (decision.kind !== "apply") return server.content
  toast.info(RESTORED_TOAST)
  return decision.content
}

/** The document fields of a fetched row: the server's title and baseline, `lastSaved` from `updated_at`. */
function fromServer(ctx: LoadContext, data: PromptWithFolder): DocumentFields {
  const server: DocFields = { title: data.title, content: data.content || "" }
  return {
    promptData: data,
    title: data.title,
    content: restoreDraft(ctx, server),
    lastSaved: new Date(data.updated_at),
    synced: { promptId: ctx.promptId, ...server },
  }
}

/**
 * Fetches the run's document. A rejected fetch (offline, a deploy skew, a `withTimeout` limit) takes the same path as
 * a failed one, so `loading` never sticks.
 * @param ctx - The run.
 * @returns The fetch's result, or `{ success: false, error: LOAD_FAILED }` when it rejected.
 */
export async function fetchDocument(ctx: LoadContext): Promise<ActionResult> {
  try {
    return await ctx.io.fetchPrompt(ctx.promptId)
  } catch {
    return { success: false, error: LOAD_FAILED }
  }
}

/**
 * Runs the paths P0 to P7 of the loader protocol, in the order promptId, identity, wipe, cache, fetch.
 * @param ctx - The run; its `signal` is aborted by the effect cleanup.
 * @returns When the run has applied its outcome, or found itself aborted (P7), in which case it changed nothing
 *   after the fetch.
 */
export async function runLoad(ctx: LoadContext): Promise<void> {
  const { promptId, userId, dispatch, monacoPromptIdRef } = ctx
  if (!promptId) {
    monacoPromptIdRef.current = null
    dispatch({ type: "wipe", loading: false })
    return
  }
  if (!userId) {
    dispatch({ type: "loading" })
    return
  }

  // Reason: no loaded mark. The identity gate keeps this effect from running before the identity is known and the
  // abort cancels a superseded run, so it never re-runs for an applied document; if it ever does, the wipe is followed
  // by the cache entry, which holds the working copy.
  monacoPromptIdRef.current = null
  dispatch({ type: "wipe" })

  const cached = getCachedDocument(userId, promptId)
  if (cached) {
    const { promptData, title, content, lastSaved, synced } = cached
    commit(ctx, { promptData, title, content, lastSaved, synced })
    return
  }

  dispatch({ type: "loading" })
  const result = await fetchDocument(ctx)
  // Reason: whoever aborted this run (a newer document, or unmount) owns the shared state.
  if (ctx.signal.aborted) return
  if (!result.success) {
    toast.error(result.error, { duration: 6000 })
    dispatch({ type: "fail", message: result.error })
    return
  }
  commit(ctx, fromServer(ctx, result.data as PromptWithFolder))
}
