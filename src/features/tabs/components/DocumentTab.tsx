/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/DocumentTab.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 12:58 GMT+10
Last modified: 08/11/2025 13:50 GMT+10
---------------
Individual tab component with drag handle, title, close button, and dirty indicator.
Uses dnd-kit for drag-and-drop functionality with click-and-hold pattern.

Changelog:
08/11/2025 13:50 GMT+10 | Implemented click-and-hold drag pattern (click = switch, hold = drag)
08/11/2025 13:38 GMT+10 | Added italic styling for preview tabs (isPreview)
08/11/2025 13:35 GMT+10 | Fixed tab click not switching content - moved onClick to parent div
08/11/2025 12:58 GMT+10 | Initial creation - Document tab component
*/

"use client"

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TabData } from '@/features/tabs/types'
import { getDisplayTitle } from '@/features/prompts/utils'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { useTabStore } from '@/stores/use-tab-store'
import { deletePrompt } from '@/features/prompts/actions'
import { toast } from 'sonner'

interface DocumentTabProps {
  tab: TabData
  isActive: boolean
  onClose: () => void
  onClick: () => void
}

export function DocumentTab({ tab, isActive, onClose, onClick }: DocumentTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Reason: Click-and-hold pattern - track press duration to distinguish click from drag
  const [isDragEnabled, setIsDragEnabled] = useState(false)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)
  const didDragRef = useRef(false)

  // Reason: Unsaved changes dialog state (P5S4eT13)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const { shouldConfirmClose, closeTabDirectly } = useTabStore()

  // Reason: Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
      }
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Reason: Don't interfere with close button clicks
    if ((e.target as HTMLElement).closest('button')) {
      return
    }

    didDragRef.current = false

    // Reason: Enable drag after 150ms hold (browser-tab-like behavior)
    holdTimerRef.current = setTimeout(() => {
      setIsDragEnabled(true)
      didDragRef.current = true
    }, 150)
  }

  const handleMouseUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
    }
    setIsDragEnabled(false)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Reason: If we initiated a drag, don't also trigger click
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    console.log('[DocumentTab] Click event fired for tab:', tab.id)
    onClick()
  }

  // Reason: Handle tab close with unsaved changes check (P5S4eT13)
  const handleCloseAttempt = () => {
    if (shouldConfirmClose(tab.id)) {
      setShowUnsavedDialog(true)
    } else {
      onClose()
    }
  }

  // Reason: Save handler for unsaved changes dialog (P5S4eT13)
  // NOTE: This is a simplified implementation. Full implementation would require
  // EditorPane to expose a save handler or use a global event system.
  const handleSaveAndClose = async () => {
    // LIMITATION: Cannot programmatically trigger save from EditorPane
    // User will need to manually click "Save Version" button
    toast.info("Please use the 'Save Version' button to save your document", {
      duration: 4000
    })
    setShowUnsavedDialog(false)
    // Keep tab open so user can save manually
  }

  // Reason: Discard handler for unsaved changes dialog (P5S4eT13)
  const handleDiscardAndClose = async () => {
    try {
      // Delete document from database if it was persisted
      if (tab.promptId) {
        const result = await deletePrompt(tab.promptId)
        if (!result.success) {
          toast.error(result.error)
          setShowUnsavedDialog(false)
          return
        }
      }
      // Close tab directly without confirmation
      closeTabDirectly(tab.id)
      toast.success("Document discarded", { duration: 2000 })
    } catch (error) {
      toast.error("Failed to discard document")
      console.error("Error discarding document:", error)
    }
    setShowUnsavedDialog(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-r",
        "hover:bg-accent select-none cursor-pointer",
        "min-w-[120px] max-w-[200px]",
        isActive && "bg-background border-b-2 border-b-primary",
        isDragging && "opacity-50"
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      {...attributes}
      {...(isDragEnabled ? listeners : {})}
    >
      {/* Dirty indicator */}
      {tab.isDirty && (
        <Circle className="w-2 h-2 fill-primary text-primary" />
      )}

      {/* Tab title */}
      <span
        className={cn(
          "flex-1 truncate text-sm",
          tab.isPreview && "italic opacity-70"
        )}
      >
        {getDisplayTitle(tab.title)}
      </span>

      {/* Close button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-destructive/20"
            onClick={(e) => {
              e.stopPropagation()
              handleCloseAttempt()
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close tab (Ctrl+W)</TooltipContent>
      </Tooltip>

      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onSave={handleSaveAndClose}
        onDiscard={handleDiscardAndClose}
        documentTitle={getDisplayTitle(tab.title)}
      />
    </div>
  )
}
