/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/hooks/useMigration.ts
MIME: text/typescript
Type: TypeScript React Hook

Created: 08/11/2025 13:16 GMT+10
Last modified: 08/11/2025 13:16 GMT+10
---------------
Migration hook to migrate from old use-ui-store to new tab system.
Runs on component mount to auto-migrate selectedPrompt to tab.

Changelog:
08/11/2025 13:16 GMT+10 | Initial creation - Migration hook
*/

"use client"

import { useEffect, useRef } from 'react'
import { useTabStore } from '@/stores/use-tab-store'
import { useUiStore } from '@/stores/use-ui-store'
import { getPromptDetails } from '@/features/prompts/actions'

/**
 * Migration hook to handle backwards compatibility from old single-document system
 * to new tabbed editor system.
 * 
 * Automatically migrates selectedPrompt from use-ui-store to a tab on first load.
 * Only runs once per session using a ref guard.
 */
export function useMigration() {
  const migrated = useRef(false)
  
  useEffect(() => {
    async function migrate() {
      // Only run once per session
      if (migrated.current) return
      migrated.current = true
      
      const { selectedPrompt, selectPrompt } = useUiStore.getState()
      const { tabs, openTab } = useTabStore.getState()
      
      // If old selectedPrompt exists and no tabs open, migrate
      if (selectedPrompt && tabs.length === 0) {
        try {
          const result = await getPromptDetails({ promptId: selectedPrompt })
          
          if (result.success && result.data) {
            openTab({
              type: 'document',
              title: result.data.title,
              promptId: selectedPrompt,
            })
            
            // Clear old store after successful migration
            selectPrompt(null)
            
            console.log('[Migration] Successfully migrated selectedPrompt to tab system')
          }
        } catch (error) {
          console.error('[Migration] Failed to migrate selectedPrompt:', error)
          // Don't block app on migration failure
        }
      }
    }
    
    migrate()
  }, [])
}
