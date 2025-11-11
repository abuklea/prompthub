/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/EditorPane.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:41 GMT+10
Last modified: 09/11/2025 17:20 GMT+10
---------------
Editor pane component for the right section of the 3-pane layout.
Displays selected prompt details and provides editing interface with Monaco Editor.
Features: Auto-save (500ms debounce), localStorage persistence, manual save (Ctrl+S).

Changelog:
09/11/2025 17:20 GMT+10 | CRITICAL RACE CONDITION FIX: Implemented P5S5T1-T5 fixes for document contamination
09/11/2025 17:20 GMT+10 | P5S5T2: Added synchronous state clearing BEFORE any checks to prevent mixed state
09/11/2025 17:20 GMT+10 | P5S5T3: Replaced setTimeout with cleanup effect for proper lock release timing
09/11/2025 17:20 GMT+10 | P5S5T4: Added isTransitioning guard to localStorage save effect
09/11/2025 17:20 GMT+10 | P5S5T5: Added contentPromptIdRef ownership guard to cache update effect
09/11/2025 16:09 GMT+10 | CRITICAL BUG FIX: Implemented P0/P1 fixes for content cross-contamination (P0T1-P0T3, P1T4-P1T5)
09/11/2025 16:09 GMT+10 | P0T1: Added promptIdRef guard to prevent stale localStorage saves during rapid tab switching
09/11/2025 16:09 GMT+10 | P0T2: Moved ownership refs BEFORE state changes in cache hit path to prevent race conditions
09/11/2025 16:09 GMT+10 | P0T3: Added isTransitioning lock to guard cache updates during document transitions
09/11/2025 16:09 GMT+10 | P1T4: Disabled auto-save during transitions to prevent wrong promptId saves
09/11/2025 16:09 GMT+10 | P1T5: Changed title type to string|null, preserve null from DB, use getDisplayTitle for tabs
08/11/2025 15:19 GMT+10 | Wrapped console.log statements with development-only guards (P5S4T5)
08/11/2025 15:17 GMT+10 | PERFORMANCE: Added ref guard to prevent duplicate database loads in React Strict Mode (P5S4T4)
08/11/2025 15:15 GMT+10 | SECURITY FIX: Added user-scoped cache with userId validation and logout clearing (P5S4T2)
08/11/2025 13:45 GMT+10 | CRITICAL FIX: Resolved infinite loop in tab update useEffect by removing 'tabs' dependency
08/11/2025 13:40 GMT+10 | Added auto-promotion of preview tabs to permanent when edited (P5S4dT3)
08/11/2025 13:06 GMT+10 | Refactored to accept promptId and tabId props for tab system integration (P5S4cT7)
07/11/2025 16:17 GMT+10 | Integrated auto-save, localStorage, and Ctrl+S manual save (P5S3bT14)
07/11/2025 16:07 GMT+10 | Restructured layout for full-height Monaco editor (P5S3bT3)
07/11/2025 14:21 GMT+10 | Added save functionality with Editor component integration (P5S3T4)
07/11/2025 13:41 GMT+10 | Initial creation with prompt details fetching
*/

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useUiStore } from "@/stores/use-ui-store"
import { useTabStore } from "@/stores/use-tab-store"
import { getPromptDetails } from "@/features/prompts/actions"
import { saveNewVersion, autoSavePrompt } from "@/features/editor/actions"
import { titleValidationSchema } from "@/features/prompts/schemas"
import { SetTitleDialog } from "@/features/prompts/components/SetTitleDialog"
import { getDisplayTitle } from "@/features/prompts/utils"
import { useAutoSave } from "@/features/editor/hooks/useAutoSave"
import { useLocalStorage } from "@/features/editor/hooks/useLocalStorage"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Editor } from "@/features/editor"
import { toast } from "sonner"
import type { Prompt, Folder } from "@prisma/client"

type PromptWithFolder = Prompt & {
  folder: {
    id: string
    name: string
  }
}

interface EditorPaneProps {
  promptId: string
  tabId: string
}

// Reason: Document cache to enable instant tab switching without reload
// SECURITY: User-scoped cache with userId validation
const documentCache = new Map<string, {
  userId: string
  promptData: PromptWithFolder
  title: string | null  // P1T5: Allow null titles
  content: string
  lastSaved: Date | null
}>()

// CRITICAL: Clear cache on module load to prevent cross-session contamination
documentCache.clear()

// Reason: Export cache clearing function for logout
export function clearDocumentCache() {
  documentCache.clear()
  if (process.env.NODE_ENV === 'development') {
    console.log('[EditorPane] Document cache cleared')
  }
}

export function EditorPane({ promptId, tabId }: EditorPaneProps) {
  const { triggerPromptRefetch, updatePromptTitle } = useUiStore()
  const { updateTab, promotePreviewTab, tabs } = useTabStore()
  const [promptData, setPromptData] = useState<PromptWithFolder | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState<string | null>(null)  // P1T5: Allow null titles
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [showSetTitleDialog, setShowSetTitleDialog] = useState(false)

  // Reason: Prevent duplicate loads in React Strict Mode (P5S4T4)
  const loadedRef = useRef<string | null>(null)

  // Reason: Track the promptId that content belongs to, prevent cross-contamination
  const contentPromptIdRef = useRef<string | null>(null)

  // Reason: Track current promptId synchronously to prevent stale saves (P0T1)
  const promptIdRef = useRef<string | null>(null)

  // Reason: Track document transition state to prevent stale cache updates (P0T3)
  const isTransitioning = useRef(false)

  // Reason: localStorage for unsaved changes (P5S3bT14)
  const [localContent, setLocalContent, clearLocalContent] = useLocalStorage({
    key: promptId ? `prompt-${promptId}` : 'prompt-draft',
    initialValue: ''
  })

  // Reason: Load and cache user ID on mount for cache validation (P5S4T2)
  useEffect(() => {
    async function loadUserId() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || 'anonymous')
    }
    loadUserId()
  }, [])

  // Reason: Fetch prompt details when selection changes, with caching for instant switching
  useEffect(() => {
    // P5S5T6: Use AbortController to cancel duplicate fetches in React Strict Mode
    const abortController = new AbortController()

    async function loadPrompt() {
      if (!promptId) {
        setPromptData(null)
        setTitle(null)  // P1T5: Reset to null
        setContent("")
        setError("")
        loadedRef.current = null  // Reset ref when no document selected
        contentPromptIdRef.current = null  // Reset content ownership
        isTransitioning.current = false  // Clear transition lock
        return
      }

      // CRITICAL: Clear state BEFORE any checks! (P5S5T2)
      // This ensures no window exists with old content + new promptId
      setPromptData(null)
      setTitle(null)
      setContent("")
      setError("")

      // Reason: Prevent duplicate loads in React Strict Mode (P5S4T4)
      if (loadedRef.current === promptId) {
        return  // Already loaded this prompt
      }

      // CRITICAL: Set transition lock BEFORE any state changes (P0T3)
      isTransitioning.current = true

      // Reason: Check cache first for instant display
      // P5S5T5: Use userId in cache key for multi-user isolation
      const cacheKey = `${currentUserId}-${promptId}`
      const cached = documentCache.get(cacheKey)
      if (cached) {
        // SECURITY: Validate cache entry belongs to current user (P5S4T2)
        if (cached.userId !== currentUserId) {
          console.warn('[EditorPane] Cache entry for different user, clearing:', cacheKey)
          documentCache.delete(cacheKey)
          // Continue to database load below
        } else {
          // CRITICAL: Update ownership refs FIRST, before any state changes (P0T2)
          contentPromptIdRef.current = promptId
          loadedRef.current = promptId

          // Valid cache hit - now safe to update state
          if (process.env.NODE_ENV === 'development') {
            console.log('[EditorPane] Loading from cache:', promptId, 'content length:', cached.content.length)
          }
          setPromptData(cached.promptData)
          setTitle(cached.title)
          setContent(cached.content)
          setLastSaved(cached.lastSaved)
          setLoading(false)
          setError("")

          // CRITICAL: Don't release lock here - let cleanup effect handle it (P5S5T3)
          return
        }
      }

      // Reason: Mark as loading before database fetch to prevent duplicate loads (P5S4T4)
      loadedRef.current = promptId

      if (process.env.NODE_ENV === 'development') {
        console.log('[EditorPane] Loading from database:', promptId)
      }
      // Reason: Not in cache, fetch from database
      setLoading(true)
      setError("")

      // P5S5T6: Check if aborted before async operation
      if (abortController.signal.aborted) {
        setLoading(false)
        isTransitioning.current = false
        return
      }

      const result = await getPromptDetails({ promptId })

      // P5S5T6: Check if aborted after async operation
      if (abortController.signal.aborted) {
        setLoading(false)
        isTransitioning.current = false
        return
      }

      // Reason: Check success field for discriminated union type
      if (!result.success) {
        setError(result.error)
        toast.error(result.error, { duration: 6000 })
        setLoading(false)
        isTransitioning.current = false  // Release lock on error
        return
      }

      if (result.data) {
        const data = result.data as PromptWithFolder
        setPromptData(data)
        setTitle(data.title)  // P1T5: Preserve null from database

        // Reason: Check localStorage for unsaved changes
        const storedContent = localContent || ''
        if (storedContent && storedContent !== data.content) {
          setContent(storedContent)
          toast.info("Restored unsaved changes from browser storage")
        } else {
          setContent(data.content || '')
        }
        // Reason: Mark content ownership after setting content
        contentPromptIdRef.current = promptId
      }
      setLoading(false)
      isTransitioning.current = false  // Release lock after database load
    }

    loadPrompt()

    // P5S5T6: Cleanup function to abort pending requests on unmount/re-run
    return () => {
      abortController.abort()
    }
  }, [promptId, currentUserId])  // CRITICAL: localContent removed from deps to prevent circular dependency (P5S5)

  // CRITICAL: Release transition lock only after loading completes (P5S5T3)
  // This ensures all state updates have settled before allowing cache/localStorage updates
  // P5S5 FIX 2: Strengthen transition lock guard to prevent premature release
  // Reason: Without loadedRef check, lock releases when promptId changes but BEFORE loading state updates
  // Solution: Only release lock when document is fully loaded AND refs match current document
  useEffect(() => {
    if (promptId && !loading && loadedRef.current === promptId) {
      // All conditions met: document loaded, not loading, refs match - safe to allow updates
      isTransitioning.current = false
    } else {
      // Any condition fails: keep locked during transition
      isTransitioning.current = true
    }
  }, [promptId, loading])

  // Reason: Update promptId ref synchronously to prevent stale saves (P0T1)
  useEffect(() => {
    promptIdRef.current = promptId
  }, [promptId])

  // Reason: Auto-save callback (P5S3bT14)
  const handleAutoSave = useCallback(async (promptId: string, title: string | null, content: string) => {
    // CRITICAL: Verify we're still on the same document before saving
    const currentPromptId = promptId
    if (process.env.NODE_ENV === 'development') {
      console.log('[EditorPane] Auto-save triggered for:', currentPromptId, 'title:', title, 'content length:', content.length)
    }

    setAutoSaving(true)
    const result = await autoSavePrompt({ promptId: currentPromptId, title: title || '', content })

    if (result.success) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[EditorPane] Auto-save successful for:', currentPromptId)
      }
      setLastSaved(new Date())
      // Reason: Update PromptList title in Zustand store for immediate UI update
      updatePromptTitle(currentPromptId, title || '')
      // Reason: DO NOT update local promptData here to avoid infinite loop
      // The promptData will be refreshed on next document load or manual save
    } else {
      console.error('[EditorPane] Auto-save FAILED for:', currentPromptId, result.error)
    }
    setAutoSaving(false)
  }, [updatePromptTitle])

  // Reason: Enable auto-save with 500ms debounce (P5S3bT14)
  // IMPORTANT: Only enable when document is loaded and not transitioning
  // to prevent saving stale title from previous document during document switch
  useAutoSave({
    title,
    content,
    promptId: (loading || isTransitioning.current) ? null : promptId,  // Disable during loading or transition (P1T4)
    delay: 500,
    onSave: handleAutoSave
  })

  // Reason: Sync content to localStorage
  // CRITICAL: Only save if content belongs to current promptId (prevent cross-contamination)
  useEffect(() => {
    // CRITICAL: Skip save if promptId just changed (P0T1)
    if (promptId !== promptIdRef.current) {
      return
    }

    if (content && promptId && contentPromptIdRef.current === promptId) {
      // CRITICAL: Check not transitioning before saving (P5S5T4)
      if (!isTransitioning.current) {
        setLocalContent(content)
      }
    }
  }, [content, promptId, setLocalContent])

  // Reason: Update cache and tab metadata when title or content changes
  useEffect(() => {
    // CRITICAL: Don't update cache during document transition (P0T3)
    if (isTransitioning.current) {
      return
    }

    // CRITICAL: Check content ownership before updating cache (P5S5T5)
    if (contentPromptIdRef.current !== promptId) {
      return
    }

    if (title && promptData && promptId) {
      const isDirty = content !== promptData.content

      // Reason: Update document cache for instant tab switching
      // P5S5T5: Use userId in cache key for multi-user isolation
      const cacheKey = `${currentUserId}-${promptId}`
      if (process.env.NODE_ENV === 'development') {
        console.log('[EditorPane] Updating cache for:', cacheKey, 'title:', title, 'content length:', content.length)
      }
      documentCache.set(cacheKey, {
        userId: currentUserId,
        promptData,
        title,
        content,
        lastSaved
      })

      // Reason: Get current tab state from store to check if preview
      const currentTab = useTabStore.getState().tabs.find(t => t.id === tabId)

      // Reason: Auto-promote preview tab to permanent when content is edited (P5S4dT3)
      // CRITICAL: Only promote on first edit to avoid infinite loop
      if (isDirty && currentTab?.isPreview) {
        promotePreviewTab(tabId)
      }

      // Update tab after promotion check - use display title for null handling (P1T5)
      updateTab(tabId, {
        title: getDisplayTitle(title),
        isDirty
      })
    }
  }, [title, content, promptData, promptId, tabId, updateTab, promotePreviewTab, lastSaved, currentUserId])

  // Reason: Handle manual save with version creation and localStorage clear (P5S3bT14)
  const handleSave = useCallback(async () => {
    if (!promptId) return

    // Reason: Validate title first (P5S4eT10)
    const titleResult = titleValidationSchema.safeParse(title)
    if (!titleResult.success) {
      // Title invalid - prompt user to set title
      setShowSetTitleDialog(true)
      return
    }

    setSaving(true)
    const result = await saveNewVersion({
      promptId,
      newTitle: title,
      newContent: content,
    })

    if (result.success) {
      toast.success("Version saved successfully")
      // Reason: Clear localStorage after successful manual save
      clearLocalContent()
      setLastSaved(new Date())

      // Reason: Update local promptData immediately to reflect title change
      const updatedData = promptData ? {
        ...promptData,
        title: title,
        content: content,
        updated_at: new Date()
      } : null

      if (updatedData) {
        setPromptData(updatedData)

        // Reason: Update cache with saved state
        // P5S5T5: Use userId in cache key for multi-user isolation
        const cacheKey = `${currentUserId}-${promptId}`
        documentCache.set(cacheKey, {
          userId: currentUserId,
          promptData: updatedData,
          title,
          content,
          lastSaved: new Date()
        })
      }

      // CRITICAL: Mark document as no longer "new" after successful save (P5S4eT10)
      updateTab(tabId, { isDirty: false, isNewDocument: false })

      // Reason: Trigger refetch to sync PromptList with new title
      triggerPromptRefetch()
    } else {
      toast.error(result.error, { duration: 6000 })
    }
    setSaving(false)
  }, [promptId, title, content, clearLocalContent, promptData, tabId, updateTab, triggerPromptRefetch, currentUserId])

  // Reason: Handle title set from dialog (P5S4eT10)
  const handleSetTitle = useCallback((newTitle: string) => {
    setTitle(newTitle)
    setShowSetTitleDialog(false)

    // Trigger save after title is set
    // Use setTimeout to ensure state update completes
    setTimeout(() => {
      handleSave()
    }, 0)
  }, [handleSave])

  // Reason: Keyboard listener for Ctrl+S manual save (P5S3bT14)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Reason: Ctrl+S or Cmd+S for manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault() // CRITICAL: Prevent browser default save dialog
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // No prompt selected
  if (!promptId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Select a prompt to edit or create a new one
        </p>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  // Prompt loaded
  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Title Section - Fixed Height */}
        <div className="flex-none p-4 space-y-2 border-b overflow-hidden">
          <Label htmlFor="prompt-title">Title</Label>
          {/* P1T5: Convert null to empty string for input */}
          <Input
            id="prompt-title"
            value={title || ""}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter prompt title..."
            className="text-lg font-semibold w-full"
          />
        </div>

      {/* Editor Section - Takes Remaining Space */}
      <div className="flex-1 overflow-hidden relative">
        {/* Reason: Absolute wrapper gives Monaco measurable dimensions for height="100%" */}
        <div className="absolute inset-0 h-full">
          {/* P5S5 FIX 1: Force remount on document change to prevent contaminated state from rendering */}
          {/* Reason: React's setState is async - without key prop, editor renders with old content + new promptId */}
          {/* Solution: key prop forces React to unmount old editor instance and mount new one with correct state */}
          <Editor
            key={promptId}
            value={content}
            onChange={(value) => setContent(value || "")}
            language="markdown"
            height="100%"
          />
        </div>
      </div>

      {/* Footer Section - Fixed Height */}
      <div className="flex-none p-4 border-t bg-muted/30">
        <div className="flex justify-between items-center">
          {/* Reason: Auto-save status indicator (P5S3bT14) */}
          <span className="text-xs text-muted-foreground">
            {autoSaving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : "Unsaved"}
          </span>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !promptId}
              variant="default"
            >
              {saving ? "Saving..." : "Save Version (Ctrl+S)"}
            </Button>
          </div>
        </div>
      </div>
      </div>

      {/* Set Title Dialog - Prompts for title when saving without valid title */}
      <SetTitleDialog
        open={showSetTitleDialog}
        onOpenChange={setShowSetTitleDialog}
        onConfirm={handleSetTitle}
        currentTitle={title}
      />
    </>
  )
}
