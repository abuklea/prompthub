/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/TabCleanupProvider.tsx
MIME: text/x-typescript-jsx
Type: TypeScript React Component

Created: 08/11/2025 13:57 GMT+10
Last modified: 08/11/2025 13:57 GMT+10
---------------
Client component wrapper for tab cleanup hook.

Provides tab validation on mount to clean orphaned tabs from localStorage.

Changelog:
08/11/2025 13:57 GMT+10 | Initial implementation - P5S4cT15
*/

"use client"

import { useTabCleanup } from "@/hooks/use-tab-cleanup"

/**
 * Client component wrapper for useTabCleanup hook
 *
 * Validates tabs on mount and removes orphaned tabs for deleted documents.
 * Must be used in app layout to run on every session start.
 */
export function TabCleanupProvider({ children }: { children: React.ReactNode }) {
  useTabCleanup()
  return <>{children}</>
}
