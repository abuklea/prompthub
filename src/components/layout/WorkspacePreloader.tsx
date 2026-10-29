/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/WorkspacePreloader.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 25/02/2026 16:11 GMT+10
Last modified: 29/10/2026 21:11 GMT+10
---------------
Renders nothing; on mount it binds the signed-in user as the workspace cache's viewer, then loads that user's workspace
snapshot with getWorkspaceSnapshot and hydrates the cache, unless the user settings turn the preload off. A failed
result leaves the cache untouched.

Changelog:
29/10/2026 21:11 GMT+10 | P7S2T9: takes userId and binds the cache viewer first, whatever the preload setting (D5)
29/10/2026 20:59 GMT+10 | P7S2T8: getWorkspaceSnapshot returns ActionResult; the cache is hydrated only on success and a
                         failure is logged; header added
25/02/2026 16:11 GMT+10 | Created (commit b8fb4db)
*/

"use client"

import { useEffect } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { getWorkspaceSnapshot } from "@/features/workspace/actions"
import { bindWorkspaceCacheViewer, hydrateWorkspaceCache } from "@/features/workspace/cache"

interface WorkspacePreloaderProps {
  /** The signed-in user's id, from the app layout's server-side user lookup. */
  userId: string
}

export function WorkspacePreloader({ userId }: WorkspacePreloaderProps) {
  const { setWorkspacePreloading, setWorkspaceLoadedAt } = useUiStore()

  useEffect(() => {
    // Reason: bound first and whatever the preload setting, so the panels never read a previous user's cached tree.
    // This component renders before the panels, so this effect runs before theirs.
    bindWorkspaceCacheViewer(userId)
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
        const result = await getWorkspaceSnapshot()
        if (!mounted) return
        if (!result.success) {
          console.error("Failed to preload workspace snapshot", result.error)
          return
        }

        hydrateWorkspaceCache(result.data)
        setWorkspaceLoadedAt(result.data.loadedAt)
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
  }, [userId, setWorkspaceLoadedAt, setWorkspacePreloading])

  return null
}
