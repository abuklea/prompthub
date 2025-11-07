/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/EditorSkeleton.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 07/11/2025 13:27 GMT+10
Last modified: 07/11/2025 13:27 GMT+10
---------------
Loading skeleton component displayed during Monaco Editor dynamic import.
Uses Tailwind pulse animation and matches Bold Simplicity design system.

Changelog:
07/11/2025 13:27 GMT+10 | Initial creation with pulse animation
*/

"use client"

import { cn } from '@/lib/utils'
import type { EditorSkeletonProps } from '../types'

/**
 * EditorSkeleton - Loading state for Monaco Editor
 *
 * Displays an animated skeleton during the dynamic import of Monaco Editor.
 * Prevents layout shift by matching the dimensions of the actual editor.
 *
 * @param height - Height to match the editor (default: "500px")
 * @param className - Additional CSS classes
 */
export default function EditorSkeleton({
  height = "500px",
  className = ""
}: EditorSkeletonProps) {
  return (
    <div
      className={cn(
        "w-full rounded-md border border-border bg-card",
        "animate-pulse",
        className
      )}
      style={{ height }}
      role="status"
      aria-label="Loading editor"
    >
      <div className="p-4 space-y-3">
        {/* Simulate editor lines with skeleton bars */}
        <div className="h-4 bg-muted/20 rounded w-3/4"></div>
        <div className="h-4 bg-muted/20 rounded w-1/2"></div>
        <div className="h-4 bg-muted/20 rounded w-5/6"></div>
        <div className="h-4 bg-muted/20 rounded w-2/3"></div>
        <div className="h-4 bg-muted/20 rounded w-4/5"></div>
        <div className="h-4 bg-muted/20 rounded w-1/2"></div>
        <div className="h-4 bg-muted/20 rounded w-3/4"></div>
      </div>
    </div>
  )
}
