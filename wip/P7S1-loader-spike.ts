/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-loader-spike.ts
MIME: text/typescript
Type: TypeScript React hook (research spike, not imported by the application)

Created: 20/10/2026 12:34 GMT+10
Last modified: 20/10/2026 12:40 GMT+10
---------------
P7S1 research spike. A standalone version of useDocumentLoader that implements the loader protocol decided in
PRPs/docs/P7S1-editor-persistence-contracts.md: an identity gate with `loading` true while the identity is pending, the
loaded mark set on apply and cleared by the wipe, an aborted run that owns nothing, io read through a ref, and atomic
readiness: `synced` is set in the same state batch as the document, so `synced.promptId === promptId` is true only in
renders whose title, content and promptData belong to that document. That token replaces isTransitioning,
contentPromptIdRef and titlePromptIdRef. It exists to prove the protocol with wip/P7S1-loader-spike.test.tsx before the
production hook is rewritten in P7S1T5. It has no draft handling.

Changelog:
20/10/2026 12:40 GMT+10 | Corrected the header timestamps to the filesystem record
20/10/2026 12:34 GMT+10 | Rewritten with atomic readiness (`ready`) in place of the ref flags and the transition effect
*/

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Prompt } from "@prisma/client"
import type { ActionResult } from "@/types/actions"

export type PromptWithFolder = Prompt & { folder: { id: string; name: string } }

export interface SyncedState {
  promptId: string
  title: string | null
  content: string
}

interface CacheEntry {
  userId: string
  promptData: PromptWithFolder
  title: string | null
  content: string
  lastSaved: Date | null
  synced: SyncedState
}

const documentCache = new Map<string, CacheEntry>()

export function setDocumentCacheEntry(userId: string, promptId: string, entry: Omit<CacheEntry, "userId">) {
  documentCache.set(`${userId}-${promptId}`, { userId, ...entry })
}

export function updateDocumentCacheEntry(userId: string, promptId: string, patch: Partial<Omit<CacheEntry, "userId">>) {
  const key = `${userId}-${promptId}`
  const existing = documentCache.get(key)
  if (existing) documentCache.set(key, { ...existing, ...patch })
}

export function clearDocumentCache() {
  documentCache.clear()
}

export interface DocumentLoaderIo {
  fetchPrompt(promptId: string): Promise<ActionResult>
  getUserId(): Promise<string>
}

export function useDocumentLoader({ promptId, io }: { promptId: string; io: DocumentLoaderIo }) {
  const [promptData, setPromptData] = useState<PromptWithFolder | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [synced, setSynced] = useState<SyncedState | null>(null)
  const [currentUserId, setCurrentUserId] = useState("")

  const ioRef = useRef(io)
  const userIdRef = useRef("")
  const loadedRef = useRef<string | null>(null)
  const promptIdRef = useRef<string | null>(null)
  const monacoPromptIdRef = useRef<string | null>(null)

  // Reason: the load effect must not re-run because the caller built a new io object
  useEffect(() => {
    ioRef.current = io
  }, [io])

  // Reason: identity is resolved once per mount; sign-out unmounts the editor
  useEffect(() => {
    let alive = true
    ioRef.current.getUserId().then((id) => {
      if (alive) setCurrentUserId(id)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    userIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    promptIdRef.current = promptId
  }, [promptId])

  useEffect(() => {
    const controller = new AbortController()

    function wipe(clearLoading: boolean) {
      setPromptData(null)
      setTitle(null)
      setContent("")
      setError("")
      setSynced(null)
      setLastSaved(null)
      loadedRef.current = null
      monacoPromptIdRef.current = null
      if (clearLoading) setLoading(false)
    }

    async function load() {
      if (!promptId) {
        wipe(true)
        return
      }
      // Identity pending: show the loading state and touch nothing else.
      if (!currentUserId) {
        setLoading(true)
        return
      }
      // Same document already applied: a re-run changes nothing (and never wipes).
      if (loadedRef.current === promptId) return

      wipe(false)

      const cached = documentCache.get(`${currentUserId}-${promptId}`)
      if (cached && cached.userId === currentUserId) {
        loadedRef.current = promptId
        monacoPromptIdRef.current = promptId
        setPromptData(cached.promptData)
        setTitle(cached.title)
        setContent(cached.content)
        setLastSaved(cached.lastSaved)
        setSynced(cached.synced)
        setLoading(false)
        return
      }
      if (cached) documentCache.delete(`${currentUserId}-${promptId}`)

      setLoading(true)
      const result = await ioRef.current.fetchPrompt(promptId)
      // Reason: whoever aborted this run (a newer document, or unmount) owns loading.
      if (controller.signal.aborted) return

      if (!result.success) {
        setError(result.error)
        toast.error(result.error, { duration: 6000 })
        setLoading(false)
        return
      }

      const data = result.data as PromptWithFolder
      const text = data.content || ""
      loadedRef.current = promptId
      monacoPromptIdRef.current = promptId
      setPromptData(data)
      setTitle(data.title)
      setContent(text)
      setLastSaved(new Date(data.updated_at))
      setSynced({ promptId, title: data.title, content: text })
      setLoading(false)
    }

    load()
    return () => controller.abort()
  }, [promptId, currentUserId])

  /** Records what the server holds for a document after a confirmed write. Returns true when it reached React state. */
  const markSynced = useCallback((next: SyncedState): boolean => {
    updateDocumentCacheEntry(userIdRef.current, next.promptId, { synced: next })
    if (next.promptId !== promptIdRef.current) return false
    setSynced(next)
    return true
  }, [])

  /** Replaces the working copy and the baseline with a row the server just wrote (restore). */
  const applyServerState = useCallback((row: { title: string | null; content: string }) => {
    const id = promptIdRef.current
    if (!id) return
    setTitle(row.title)
    setContent(row.content)
    setPromptData((prev) => (prev ? { ...prev, title: row.title, content: row.content } : prev))
    setSynced({ promptId: id, title: row.title, content: row.content })
    setLastSaved(new Date())
  }, [])

  return {
    promptData,
    title,
    content,
    loading,
    error,
    lastSaved,
    currentUserId,
    synced,
    /** True only in renders whose title, content and promptData belong to `promptId`. */
    ready: synced !== null && synced.promptId === promptId,
    monacoPromptIdRef,
    promptIdRef,
    setPromptData,
    setTitle,
    setContent,
    setLastSaved,
    markSynced,
    applyServerState,
  }
}
