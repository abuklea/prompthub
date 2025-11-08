/*
Project: PromptHub
Author: Allan James
Source: src/hooks/use-tab-cleanup.ts
MIME: text/x-typescript
Type: TypeScript React Hook

Created: 08/11/2025 13:54 GMT+10
Last modified: 08/11/2025 13:54 GMT+10
---------------
Hook to clean orphaned tabs on mount.

Validates document tabs against database and closes tabs for deleted documents.
Prevents orphaned tabs from persisting after logout/login via localStorage.

Changelog:
08/11/2025 13:54 GMT+10 | Initial implementation - P5S4cT15
*/

"use client"

import { useEffect, useRef } from "react"
import { useTabStore } from "@/stores/use-tab-store"
import { validatePrompts } from "@/features/prompts/actions"

/**
 * Clean orphaned tabs on component mount
 *
 * Validates all document tabs against database and closes tabs
 * for documents that no longer exist. Runs once on mount.
 *
 * @example
 * // In app layout
 * export default function AppLayout({ children }) {
 *   useTabCleanup()
 *   return <>{children}</>
 * }
 */
export function useTabCleanup() {
  const { tabs, closeTab } = useTabStore()
  const hasRun = useRef(false)

  useEffect(() => {
    // Reason: Only run once on mount, not on every tab change
    if (hasRun.current) return
    hasRun.current = true

    async function cleanOrphanedTabs() {
      // Reason: Get all document tabs with promptIds
      const documentTabs = tabs.filter(
        t => t.type === 'document' && t.promptId
      )

      if (documentTabs.length === 0) return

      // Reason: Extract unique promptIds for validation (using Array.from for compatibility)
      const uniqueIds = Array.from(new Set(documentTabs.map(t => t.promptId!)))

      // Reason: Batch validate all promptIds exist in database
      const result = await validatePrompts(uniqueIds)

      if (!result.success) {
        console.error('Tab cleanup validation failed:', result.error)
        return
      }

      // Reason: Close tabs for non-existent documents
      const validPromptIds = new Set(result.data?.validIds || [])

      documentTabs.forEach(tab => {
        if (tab.promptId && !validPromptIds.has(tab.promptId)) {
          console.log(`Closing orphaned tab for deleted document: ${tab.promptId}`)
          closeTab(tab.id)
        }
      })
    }

    cleanOrphanedTabs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - run once on mount, closeTab/tabs intentionally excluded
}
