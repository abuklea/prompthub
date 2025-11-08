/*
Project: PromptHub
Author: Allan James
Source: src/components/ui/empty-state.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 08/11/2025 11:24 GMT+10
Last modified: 08/11/2025 11:24 GMT+10
---------------
Empty state CTA component for displaying call-to-action panels when no content exists.

Changelog:
08/11/2025 11:24 GMT+10 | Initial creation - EmptyState component
*/

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  className?: string
}

/**
 * Empty state CTA component
 *
 * Displays an attractive call-to-action panel when no content exists,
 * guiding users to create their first item.
 *
 * @param icon - Lucide icon component to display
 * @param title - Main heading text
 * @param description - Descriptive text explaining what to do
 * @param actionLabel - Text for the CTA button
 * @param onAction - Handler function when CTA button is clicked
 * @param className - Optional additional CSS classes
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full p-8 text-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 max-w-md">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
          <Icon className="w-8 h-8 text-primary" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold tracking-tight">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {description}
        </p>

        {/* CTA Button */}
        <Button
          onClick={onAction}
          size="lg"
          className="mt-2"
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
