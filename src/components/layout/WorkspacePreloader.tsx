"use client"

import { useEffect } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getWorkspaceSnapshot } from "@/features/workspace/actions"
import { hydrateWorkspaceCache } from "@/features/workspace/cache"
import { hydrateDocumentCache } from "@/features/editor/components/EditorPane"

export function WorkspacePreloader() {
  const { setWorkspacePreloading, setWorkspaceLoadedAt } = useUiStore()

  useEffect(() => {
    let mounted = true

    async function preload() {
      const rawSettings = localStorage.getItem("prompthub:user-settings:v1")
      if (rawSettings) {
        try {
          const parsed = JSON.parse(rawSettings) as { preloadWorkspaceOnLaunch?: boolean }
          if (parsed.preloadWorkspaceOnLaunch === false) {
            return
          }
        } catch {}
      }

      setWorkspacePreloading(true)
      try {
        const snapshot = await getWorkspaceSnapshot()
        if (!mounted) return

        hydrateWorkspaceCache(snapshot)
        hydrateDocumentCache(snapshot.userId, snapshot.prompts)
        setWorkspaceLoadedAt(snapshot.loadedAt)
      } catch (error) {
        console.error("Failed to preload workspace snapshot", error)
      } finally {
        if (mounted) {
          setWorkspacePreloading(false)
        }
      }
    }

    preload()

    return () => {
      mounted = false
    }
  }, [setWorkspaceLoadedAt, setWorkspacePreloading])

  return null
}
