/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/PanelSubheader.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 07/11/2025 16:06 GMT+10
Last modified: 07/11/2025 16:06 GMT+10
---------------
Reusable panel subheader component that sits between main header and content panels.
Provides consistent styling for panel titles and toolbar areas.

Changelog:
07/11/2025 16:06 GMT+10 | Initial creation - PanelSubheader component
*/

import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface PanelSubheaderProps {
  title: string
  children?: ReactNode
  className?: string
}

/**
 * Panel Subheader Component
 *
 * Displays a panel title with optional toolbar children.
 * Used to create aligned subheaders across the 3-panel layout.
 *
 * @param title - The panel title text
 * @param children - Optional toolbar buttons/controls
 * @param className - Optional additional CSS classes
 */
export function PanelSubheader({ title, children, className }: PanelSubheaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        "h-10 px-2 sm:px-3 border-b bg-muted/30",
        className
      )}
    >
      <h2 className="text-sm font-semibold text-foreground">
        {title}
      </h2>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
