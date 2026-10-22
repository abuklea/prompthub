/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 17/07/2026 10:00 GMT+10
Last modified: 22/10/2026 09:51 GMT+10
---------------
Loads the open document on the identity-gate protocol (contract: Loader Protocol). The user is looked up on every
mount and the load waits for it; the document and its baseline arrive in one reducer action, so `ready` is true only in
renders whose title, content and promptData belong to `promptId`. Completions of saves and restores are applied through
`markSynced` and `applyServerState`, which change React state only for the open document. A load's conflict toasts are
dismissed when its effect cleans up (the document is left or the editor unmounts).

Changelog:
22/10/2026 09:51 GMT+10 | markSynced and applyServerState require the document to be applied, not only open (T5 review)
22/10/2026 09:39 GMT+10 | The load effect owns its conflict toasts and dismisses them on cleanup (P7S1T6)
22/10/2026 09:14 GMT+10 | Rewritten on the identity-gate protocol: useIdentity, ready, synced, markSynced,
                         applyServerState; adopts document-cache.ts; the ownership ref flags and the transition
                         effect are removed (P7S1T5 step 3)
22/10/2026 08:57 GMT+10 | Takes an injected DocumentLoaderIo for the fetch, user lookup and storage (P7S1T5 step 1)
17/07/2026 10:00 GMT+10 | Extracted from EditorPane.tsx to reduce file size (F5)
*/

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { toast } from "sonner"
import { useLatest } from "@/hooks/use-latest"
import { ANONYMOUS, updateDocumentCacheEntry } from "../document-cache"
import { runLoad, type DocumentLoaderIo } from "../loader-protocol"
import { initialLoaderState, loaderReducer, versioned, type LoaderState } from "../loader-state"
import type { DocFields, SyncedState } from "../sync"

export type { DocumentLoaderIo } from "../loader-protocol"

/** How long the user lookup may take before the loader settles on the anonymous identity. */
export const IDENTITY_TIMEOUT_MS = 10_000

/** What the loader gives the editor: its state plus the readiness token, the guards and the completion API. */
export interface DocumentLoader extends LoaderState {
  /** The identity this mount settled on; "" while the lookup is pending. */
  currentUserId: string
  /** True only in renders whose title, content and promptData belong to `promptId`. */
  ready: boolean
  /** The Monaco onChange guard: the document whose content the editor holds, or null while none is applied. */
  monacoPromptIdRef: MutableRefObject<string | null>
  /** The open document; null after unmount. Read in handlers only. */
  promptIdRef: MutableRefObject<string | null>
  /** Sets the working title. */
  setTitle: Dispatch<SetStateAction<string | null>>
  /** Sets the working content. */
  setContent: Dispatch<SetStateAction<string>>
  /**
   * Records a confirmed server write for one document: the baseline, `lastSaved` and, for a saved version,
   * `promptData`. Its cache entry is updated first, whichever document is open.
   * @param next - The document and the fields the server now holds.
   * @param options - `version: true` for a saved version, which also stamps `promptData`.
   * @returns True when the document is the open one and React state changed; false otherwise.
   */
  markSynced(next: SyncedState, options?: { version?: boolean }): boolean
  /**
   * Replaces the working copy, `promptData` and the baseline with the row a restore wrote; same contract as markSynced.
   * @param promptId - The restored document.
   * @param row - The title and content the server now holds.
   * @returns True when the document is the open one and React state changed; false otherwise.
   */
  applyServerState(promptId: string, row: DocFields): boolean
}

/** Options of `useDocumentLoader`. */
export interface UseDocumentLoaderOptions {
  /** The document to open; "" for none. */
  promptId: string
  /** The fetch, user lookup and storage; read through a ref, so a new object neither restarts nor loses a load. */
  io: DocumentLoaderIo
}

/**
 * Resolves the user once per mount; the first answer wins, so a late lookup never changes the identity. A rejected
 * lookup, or none within `IDENTITY_TIMEOUT_MS`, settles as `ANONYMOUS`.
 */
function useIdentity(ioRef: MutableRefObject<DocumentLoaderIo>): string {
  const [userId, setUserId] = useState("")
  useEffect(() => {
    let settled = false
    const settle = (id: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setUserId(id)
    }
    const timer = setTimeout(() => settle(ANONYMOUS), IDENTITY_TIMEOUT_MS)
    const lookUp = async () => {
      try {
        settle(await ioRef.current.getUserId())
      } catch {
        settle(ANONYMOUS)
      }
    }
    void lookUp()
    return () => {
      settled = true
      clearTimeout(timer)
    }
  }, [ioRef])
  return userId
}

/** The open-document marker: `promptId` while mounted, null after unmount. */
function useOpenDocumentRef(promptId: string): MutableRefObject<string | null> {
  const promptIdRef = useRef<string | null>(null)
  useEffect(() => {
    // Reason: null after unmount, so a request that completes later is not applied to state nobody renders; the body
    // sets it again when Strict Mode re-runs the effect, and a change of document replaces it within the same commit.
    promptIdRef.current = promptId
    return () => {
      promptIdRef.current = null
    }
  }, [promptId])
  return promptIdRef
}

/**
 * Loads a document and keeps its working copy and baseline.
 * @param options - The document to open and the io.
 * @returns The loader's state, readiness, guards, setters and completion API.
 */
export function useDocumentLoader({ promptId, io }: UseDocumentLoaderOptions): DocumentLoader {
  const [state, dispatch] = useReducer(loaderReducer, promptId, initialLoaderState)
  const ioRef = useLatest(io)
  const userId = useIdentity(ioRef)
  const userIdRef = useLatest(userId)
  const promptIdRef = useOpenDocumentRef(promptId)
  const monacoPromptIdRef = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const toastIds: Array<string | number> = []
    const { signal } = controller
    void runLoad({ promptId, userId, io: ioRef.current, signal, dispatch, monacoPromptIdRef, toastIds })
    return () => {
      controller.abort()
      // Reason: a conflict toast's action targets this run's document; once it is left, the offer is withdrawn.
      toastIds.forEach((id) => toast.dismiss(id))
    }
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
      // Reason: `promptIdRef` names the open document and `monacoPromptIdRef` the one whose content is applied (null
      // while it loads), so a completion that lands while the open document re-fetches changes nothing.
      if (next.promptId !== promptIdRef.current || next.promptId !== monacoPromptIdRef.current) return false
      dispatch({ type: "synced", next, version, now })
      return true
    },
    [promptIdRef, monacoPromptIdRef, userIdRef]
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
      if (id !== promptIdRef.current || id !== monacoPromptIdRef.current) return false
      dispatch({ type: "serverState", promptId: id, row, now })
      return true
    },
    [promptIdRef, monacoPromptIdRef, userIdRef]
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
