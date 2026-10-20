/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-loader-spike.ts
MIME: text/typescript
Type: TypeScript React hook (research spike, not imported by the application)

Created: 20/10/2026 12:34 GMT+10
Last modified: 20/10/2026 13:27 GMT+10
---------------
P7S1 research spike. A standalone version of useDocumentLoader that implements the loader protocol decided in
PRPs/docs/P7S1-editor-persistence-contracts.md: an identity gate with `loading` true while the identity is pending, the
loaded mark set on apply and cleared by the wipe, an aborted run that owns nothing, io read through a ref, and atomic
readiness: the document and `synced` are replaced in one reducer action, so `synced.promptId === promptId` is true only
in renders whose title, content and promptData belong to that document. That token replaces isTransitioning,
contentPromptIdRef and titlePromptIdRef. The file also shows the decomposition that keeps every function under the
80-line lint limit: a reducer for the state, a module-level runLoad for the load protocol, and small hooks for the
identity and the latest-value refs. Code marked T6 is added by P7S1T6; P7S1T5 adapts this file without it and keeps the
current raw-draft restore of useDocumentLoader.ts in its place. It exists to prove the protocol with
wip/P7S1-loader-spike.test.tsx and wip/P7S1-draft-spike.test.tsx before the production hook is rewritten in P7S1T5.

Changelog:
20/10/2026 13:27 GMT+10 | Removed setPromptData, which no caller uses after T6
20/10/2026 13:21 GMT+10 | A conflict is kept and offered; identity remembered per page load; a rejected fetch is handled; useLatest exported
20/10/2026 13:03 GMT+10 | Decomposed (reducer, runLoad, small hooks); markSynced and applyServerState take the document id; identity timeout; no loaded mark
20/10/2026 12:40 GMT+10 | Corrected the header timestamps to the filesystem record
20/10/2026 12:34 GMT+10 | Rewritten with atomic readiness (`ready`) in place of the ref flags and the transition effect
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import { toast } from "sonner"
import type { Prompt } from "@prisma/client"
import type { ActionResult } from "@/types/actions"
import {
  discardRead,
  hashContent,
  readDraft,
  resolveDraft,
  stashConflict,
  writeDraft,
  type DocFields,
  type DraftStorage,
  type SyncedState,
} from "./P7S1-draft-spike"

export type PromptWithFolder = Prompt & { folder: { id: string; name: string } }
export type { SyncedState }

export const ANONYMOUS = "anonymous"
export const IDENTITY_TIMEOUT_MS = 10_000
export const CONFLICT_TOAST_MS = 20_000
export const RESTORED_TOAST = "Restored unsaved changes from browser storage"
export const CONFLICT_TOAST = "Local unsaved changes were not restored because the document changed on the server"
export const CONFLICT_ACTION = "Restore my text"
export const LOAD_FAILED = "Failed to load the document"

// ---- document-cache.ts (T4) ----

export interface CacheEntry {
  userId: string
  promptData: PromptWithFolder
  title: string | null
  content: string
  lastSaved: Date | null
  synced: SyncedState
}

type CachePatch = Partial<Omit<CacheEntry, "userId">>

const documentCache = new Map<string, CacheEntry>()
const cacheKey = (userId: string, promptId: string) => `${userId}-${promptId}`

/** The entry for this user, or null. An entry written for another user is dropped, never returned (P5S4T2). */
export function getCachedDocument(userId: string, promptId: string): CacheEntry | null {
  const entry = documentCache.get(cacheKey(userId, promptId))
  if (!entry) return null
  if (entry.userId !== userId) {
    documentCache.delete(cacheKey(userId, promptId))
    return null
  }
  return entry
}

export function setDocumentCacheEntry(userId: string, promptId: string, entry: Omit<CacheEntry, "userId">): void {
  documentCache.set(cacheKey(userId, promptId), { userId, ...entry })
}

/** Merges into an existing entry; a no-op when there is none. Works after the component that wrote it unmounted. */
export function updateDocumentCacheEntry(
  userId: string,
  promptId: string,
  patch: CachePatch | ((entry: CacheEntry) => CachePatch)
): void {
  const existing = documentCache.get(cacheKey(userId, promptId))
  if (!existing) return
  documentCache.set(cacheKey(userId, promptId), { ...existing, ...(typeof patch === "function" ? patch(existing) : patch) })
}

let knownUserId: string | null = null

/** The signed-in user's id, looked up once per page load so a remount does not repeat a network call (S15). */
export async function resolveUserId(lookup: () => Promise<string>): Promise<string> {
  if (knownUserId !== null) return knownUserId
  const id = await lookup()
  if (id !== ANONYMOUS) knownUserId = id
  return id
}

/** Drops every cached document and the remembered user id; called on sign-out. */
export function clearDocumentCache(): void {
  documentCache.clear()
  knownUserId = null
}

// ---- state ----

export interface DocumentLoaderIo {
  fetchPrompt(promptId: string): Promise<ActionResult>
  getUserId(): Promise<string>
  /** T6: required in production; optional here so the T5 tests, which have no draft, run unchanged. */
  getStorage?(): DraftStorage | null
}

interface DocumentFields {
  promptData: PromptWithFolder | null
  title: string | null
  content: string
  lastSaved: Date | null
  synced: SyncedState | null
}

interface LoaderState extends DocumentFields {
  loading: boolean
  error: string
}

const EMPTY_DOCUMENT: DocumentFields = { promptData: null, title: null, content: "", lastSaved: null, synced: null }

type Action =
  | { type: "wipe"; loading?: boolean }
  | { type: "loading" }
  | { type: "apply"; doc: DocumentFields }
  | { type: "fail"; message: string }
  | { type: "title"; value: SetStateAction<string | null> }
  | { type: "content"; value: SetStateAction<string> }
  | { type: "synced"; next: SyncedState; version: boolean; now: Date }
  | { type: "serverState"; promptId: string; row: DocFields; now: Date }

const resolve = <T,>(value: SetStateAction<T>, previous: T): T =>
  typeof value === "function" ? (value as (previous: T) => T)(previous) : value

/** The row as a saved version leaves it: the new title and content, stamped. */
const versioned = (previous: PromptWithFolder, fields: DocFields, now: Date): PromptWithFolder => ({
  ...previous,
  title: fields.title,
  content: fields.content,
  updated_at: now,
})

function reducer(state: LoaderState, action: Action): LoaderState {
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

// ---- small hooks ----

/** The latest value in a ref, updated after each render: lets a stable callback read current props and state. */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

/** Resolves the user once per mount; the first answer wins, so a late lookup never changes the identity. */
function useIdentity(ioRef: MutableRefObject<DocumentLoaderIo>): string {
  const [userId, setUserId] = useState("")
  useEffect(() => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = (id: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setUserId(id)
    }
    timer = setTimeout(() => settle(ANONYMOUS), IDENTITY_TIMEOUT_MS)
    ioRef.current.getUserId().then(settle, () => settle(ANONYMOUS))
    return () => {
      settled = true
      clearTimeout(timer)
    }
  }, [ioRef])
  return userId
}

// ---- load protocol ----

interface LoadContext {
  promptId: string
  userId: string
  io: DocumentLoaderIo
  signal: AbortSignal
  dispatch: Dispatch<Action>
  monacoPromptIdRef: MutableRefObject<string | null>
}

function commit(ctx: LoadContext, doc: DocumentFields): void {
  ctx.monacoPromptIdRef.current = ctx.promptId
  ctx.dispatch({ type: "apply", doc })
}

/**
 * T6. A draft that lost to the server is never deleted silently: its text is kept in the storage and offered by the
 * toast's action, which puts it back into the editor while the same document is open.
 */
function warnConflict(ctx: LoadContext, storage: DraftStorage | null, content: string): void {
  stashConflict(storage, ctx.promptId, content)
  toast.warning(CONFLICT_TOAST, {
    duration: CONFLICT_TOAST_MS,
    action: {
      label: CONFLICT_ACTION,
      onClick: () => {
        if (ctx.monacoPromptIdRef.current === ctx.promptId) ctx.dispatch({ type: "content", value: content })
      },
    },
  })
}

/**
 * T6. The working content for a document just read from the server: a stored draft that applies, else the server's.
 * A draft that does not apply was consumed here, so this is the only place that removes it; an applied v1 draft is
 * rewritten by useDraftSync in the same commit, and an applied legacy value is migrated to v1 first, then removed.
 */
function restoreDraft(ctx: LoadContext, server: DocFields): string {
  const storage = ctx.io.getStorage?.() ?? null
  const read = readDraft(storage, ctx.promptId)
  const decision = resolveDraft(server, read?.draft ?? null)
  if (read && decision.kind === "apply" && read.legacy) {
    writeDraft(storage, ctx.promptId, { content: decision.content, base: hashContent(server.content) })
  }
  if (read && (decision.kind !== "apply" || read.legacy)) discardRead(storage, ctx.promptId, read)
  if (decision.kind === "apply") toast.info(RESTORED_TOAST)
  if (decision.kind === "conflict" && read) warnConflict(ctx, storage, read.draft.content)
  return decision.kind === "apply" ? decision.content : server.content
}

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

/** A rejected fetch (offline, a deploy skew) takes the same path as a failed one, so `loading` never sticks. */
async function fetchDocument(ctx: LoadContext): Promise<ActionResult> {
  try {
    return await ctx.io.fetchPrompt(ctx.promptId)
  } catch {
    return { success: false, error: LOAD_FAILED }
  }
}

/** Paths P0 to P7 of the loader protocol. Order: promptId, identity, wipe, cache, fetch. */
async function runLoad(ctx: LoadContext): Promise<void> {
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

// ---- the hook ----

export interface DocumentLoader extends LoaderState {
  currentUserId: string
  /** True only in renders whose title, content and promptData belong to `promptId`. */
  ready: boolean
  monacoPromptIdRef: MutableRefObject<string | null>
  promptIdRef: MutableRefObject<string | null>
  setTitle: Dispatch<SetStateAction<string | null>>
  setContent: Dispatch<SetStateAction<string>>
  /**
   * Records a confirmed server write for one document: the baseline, `lastSaved` and, for a saved version, `promptData`.
   * Returns true when the document is the open one and React state changed; for another document only its cache entry
   * changes and the result is false, so the caller skips every state side effect.
   */
  markSynced(next: SyncedState, options?: { version?: boolean }): boolean
  /** Replaces the working copy and the baseline with the row a restore wrote. Same contract as markSynced. */
  applyServerState(promptId: string, row: DocFields): boolean
}

export function useDocumentLoader({ promptId, io }: { promptId: string; io: DocumentLoaderIo }): DocumentLoader {
  const [state, dispatch] = useReducer(reducer, promptId, (id): LoaderState => ({ ...EMPTY_DOCUMENT, error: "", loading: Boolean(id) }))
  const ioRef = useLatest(io)
  const userId = useIdentity(ioRef)
  const userIdRef = useLatest(userId)
  const promptIdRef = useLatest<string | null>(promptId)
  const monacoPromptIdRef = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void runLoad({ promptId, userId, io: ioRef.current, signal: controller.signal, dispatch, monacoPromptIdRef })
    return () => controller.abort()
  }, [promptId, userId, ioRef])

  const setters = useMemo(
    () => ({
      setTitle: (value: SetStateAction<string | null>) => dispatch({ type: "title", value }),
      setContent: (value: SetStateAction<string>) => dispatch({ type: "content", value }),
    }),
    []
  )

  const markSynced = useCallback(
    (next: SyncedState, options?: { version?: boolean }): boolean => {
      const now = new Date()
      const version = options?.version === true
      updateDocumentCacheEntry(userIdRef.current, next.promptId, (entry) => ({
        synced: next,
        lastSaved: now,
        promptData: version ? versioned(entry.promptData, next, now) : entry.promptData,
      }))
      if (next.promptId !== promptIdRef.current) return false
      dispatch({ type: "synced", next, version, now })
      return true
    },
    [promptIdRef, userIdRef]
  )

  const applyServerState = useCallback(
    (id: string, row: DocFields): boolean => {
      const now = new Date()
      updateDocumentCacheEntry(userIdRef.current, id, (entry) => ({
        title: row.title,
        content: row.content,
        synced: { promptId: id, ...row },
        lastSaved: now,
        promptData: versioned(entry.promptData, row, now),
      }))
      if (id !== promptIdRef.current) return false
      dispatch({ type: "serverState", promptId: id, row, now })
      return true
    },
    [promptIdRef, userIdRef]
  )

  return {
    ...state,
    ...setters,
    currentUserId: userId,
    ready: state.synced !== null && state.synced.promptId === promptId,
    monacoPromptIdRef,
    promptIdRef,
    markSynced,
    applyServerState,
  }
}
