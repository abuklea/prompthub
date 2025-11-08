/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/DocumentTab.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 12:58 GMT+10
Last modified: 08/11/2025 13:38 GMT+10
---------------
Individual tab component with drag handle, title, close button, and dirty indicator.
Uses dnd-kit for drag-and-drop functionality.

Changelog:
08/11/2025 13:38 GMT+10 | Added italic styling for preview tabs (isPreview)
08/11/2025 13:35 GMT+10 | Fixed tab click not switching content - moved onClick to parent div
08/11/2025 12:58 GMT+10 | Initial creation - Document tab component
*/

"use client"

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TabData } from '@/features/tabs/types'

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-r",
        "hover:bg-accent cursor-pointer select-none",
        "min-w-[120px] max-w-[200px]",
        isActive && "bg-background border-b-2 border-b-primary",
        isDragging && "opacity-50"
      )}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {/* Dirty indicator */}
      {tab.isDirty && (
        <Circle className="w-2 h-2 fill-primary text-primary" />
      )}

      {/* Tab title */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "flex-1 truncate text-sm",
            tab.isPreview && "italic opacity-70"
          )}>
            {tab.title}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {tab.title}
          {tab.isPreview && " (Preview)"}
        </TooltipContent>
      </Tooltip>

      {/* Close button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-destructive/20"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Close tab (Ctrl+W)</TooltipContent>
      </Tooltip>
    </div>
  )
}
