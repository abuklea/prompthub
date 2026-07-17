/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 17/07/2026 10:00 GMT+10
Last modified: 17/07/2026 10:00 GMT+10
---------------
Custom hook for loading prompt documents with caching, user-scoping, and
transition guards. Extracted from EditorPane.tsx (F5 decomposition).

Changelog:
17/07/2026 10:00 GMT+10 | Extracted from EditorPane.tsx to reduce file size (F5)
*/

import { useEffect, useState, useRef, useCallback } from "react"
import { getPromptDetails } from "@/features/prompts/actions"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { Prompt } from "@prisma/client"

export type PromptWithFolder = Prompt & {
  folder: {
    id: string
    name: string
  }
}

type CacheEntry = {
  userId: string
  promptData: PromptWithFolder
  title: string | null
  content: string
  lastSaved: Date | null
}

const documentCache = new Map<string, CacheEntry>()
documentCache.clear()

type PromptWithOptionalFolder = Prompt & {
  folder: {
    id: string
    name: string
  } | null
}

export function hydrateDocumentCache(userId: string, prompts: PromptWithOptionalFolder[]) {
  prompts.forEach((prompt) => {
    documentCache.set(`${userId}-${prompt.id}`, {
      userId,
      promptData: {
        ...prompt,
        folder: prompt.folder ?? { id: "", name: "Unfiled" },
      },
      title: prompt.title,
      content: prompt.content,
      lastSaved: prompt.updated_at,
    })
  })
}

export function clearDocumentCache() {
  documentCache.clear()
}

export function updateDocumentCacheEntry(
  userId: string,
  promptId: string,
  entry: Partial<Omit<CacheEntry, "userId">>
) {
  const key = `${userId}-${promptId}`
  const existing = documentCache.get(key)
  if (existing) {
    documentCache.set(key, { ...existing, ...entry })
  }
}

export function setDocumentCacheEntry(
  userId: string,
  promptId: string,
  entry: Omit<CacheEntry, "userId">
) {
  documentCache.set(`${userId}-${promptId}`, { userId, ...entry })
}

interface UseDocumentLoaderOptions {
  promptId: string
}

interface DocumentLoaderState {
  promptData: PromptWithFolder | null
  title: string | null
  content: string
  loading: boolean
  error: string
  lastSaved: Date | null
  currentUserId: string
  isTransitioning: React.MutableRefObject<boolean>
  contentPromptIdRef: React.MutableRefObject<string | null>
  monacoPromptIdRef: React.MutableRefObject<string | null>
  titlePromptIdRef: React.MutableRefObject<string | null>
  promptIdRef: React.MutableRefObject<string | null>
  setPromptData: React.Dispatch<React.SetStateAction<PromptWithFolder | null>>
  setTitle: React.Dispatch<React.SetStateAction<string | null>>
  setContent: React.Dispatch<React.SetStateAction<string>>
  setLastSaved: React.Dispatch<React.SetStateAction<Date | null>>
  resetLoadedRef: () => void
}

export function useDocumentLoader({ promptId }: UseDocumentLoaderOptions): DocumentLoaderState {
  const [promptData, setPromptData] = useState<PromptWithFolder | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>("")

  const loadedRef = useRef<string | null>(null)
  const contentPromptIdRef = useRef<string | null>(null)
  const promptIdRef = useRef<string | null>(null)
  const isTransitioning = useRef(false)
  const monacoPromptIdRef = useRef<string | null>(null)
  const titlePromptIdRef = useRef<string | null>(null)

  useEffect(() => {
    async function loadUserId() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || "anonymous")
    }
    loadUserId()
  }, [])

  useEffect(() => {
    const abortController = new AbortController()

    async function loadPrompt() {
      if (!promptId) {
        setPromptData(null)
        setTitle(null)
        setContent("")
        setError("")
        loadedRef.current = null
        contentPromptIdRef.current = null
        titlePromptIdRef.current = null
        isTransitioning.current = false
        monacoPromptIdRef.current = null
        return
      }

      setPromptData(null)
      setTitle(null)
      setContent("")
      setError("")

      if (loadedRef.current === promptId) {
        return
      }

      isTransitioning.current = true

      const cacheKey = `${currentUserId}-${promptId}`
      const cached = documentCache.get(cacheKey)
      if (cached) {
        if (cached.userId !== currentUserId) {
          documentCache.delete(cacheKey)
        } else {
          contentPromptIdRef.current = promptId
          loadedRef.current = promptId
          titlePromptIdRef.current = promptId

          setPromptData(cached.promptData)
          setTitle(cached.title)
          setContent(cached.content)
          setLastSaved(cached.lastSaved)
          setLoading(false)
          setError("")
          monacoPromptIdRef.current = promptId
          return
        }
      }

      loadedRef.current = promptId
      setLoading(true)
      setError("")

      if (abortController.signal.aborted) {
        setLoading(false)
        isTransitioning.current = false
        return
      }

      const result = await getPromptDetails({ promptId })

      if (abortController.signal.aborted) {
        setLoading(false)
        isTransitioning.current = false
        return
      }

      if (!result.success) {
        setError(result.error)
        toast.error(result.error, { duration: 6000 })
        setLoading(false)
        isTransitioning.current = false
        return
      }

      if (result.data) {
        const data = result.data as PromptWithFolder
        setPromptData(data)
        setTitle(data.title)
        titlePromptIdRef.current = promptId

        const localStorageKey = `prompt-${promptId}`
        const storedContent = typeof window !== "undefined"
          ? (localStorage.getItem(localStorageKey) || "")
          : ""

        if (storedContent && storedContent !== data.content) {
          setContent(storedContent)
          toast.info("Restored unsaved changes from browser storage")
        } else {
          setContent(data.content || "")
        }

        contentPromptIdRef.current = promptId
        monacoPromptIdRef.current = promptId
      }
      setLoading(false)
      isTransitioning.current = false
    }

    loadPrompt()

    return () => {
      abortController.abort()
    }
  }, [promptId, currentUserId])

  useEffect(() => {
    if (promptId && !loading && loadedRef.current === promptId) {
      isTransitioning.current = false
    } else {
      isTransitioning.current = true
    }
  }, [promptId, loading])

  useEffect(() => {
    promptIdRef.current = promptId
  }, [promptId])

  const resetLoadedRef = useCallback(() => {
    loadedRef.current = null
  }, [])

  return {
    promptData,
    title,
    content,
    loading,
    error,
    lastSaved,
    currentUserId,
    isTransitioning,
    contentPromptIdRef,
    monacoPromptIdRef,
    titlePromptIdRef,
    promptIdRef,
    setPromptData,
    setTitle,
    setContent,
    setLastSaved,
    resetLoadedRef,
  }
}
