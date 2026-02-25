"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getWorkspaceSnapshot } from "@/features/workspace/actions"
import { useUiStore } from "@/stores/use-ui-store"

export function WorkspacePreloader() {
  const workspaceReady = useUiStore((state) => state.workspaceReady)
  const workspaceSyncing = useUiStore((state) => state.workspaceSyncing)
  const preloadWorkspace = useUiStore((state) => state.preloadWorkspace)
  const setWorkspaceSyncing = useUiStore((state) => state.setWorkspaceSyncing)

  useEffect(() => {
    let active = true

    const loadWorkspace = async () => {
      try {
        setWorkspaceSyncing(true)
        const snapshot = await getWorkspaceSnapshot()
        if (!active) return
        preloadWorkspace(snapshot)
      } catch (error) {
        console.error("Failed to preload workspace", error)
        toast.error("Could not sync workspace cache")
      } finally {
        if (active) {
          setWorkspaceSyncing(false)
        }
      }
    }

    loadWorkspace()

    const intervalId = window.setInterval(loadWorkspace, 45000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [preloadWorkspace, setWorkspaceSyncing])

  if (!workspaceSyncing) {
    return null
  }

  return (
    <div className="pointer-events-none absolute right-4 top-2 z-50 flex items-center gap-2 rounded-md border bg-card/95 px-2 py-1 text-xs text-muted-foreground shadow-sm">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {workspaceReady ? "Syncing workspace" : "Loading workspace"}
    </div>
  )
}
