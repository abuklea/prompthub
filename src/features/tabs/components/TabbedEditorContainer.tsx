/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/TabbedEditorContainer.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 13:02 GMT+10
Last modified: 08/11/2025 13:16 GMT+10
---------------
Main tabbed editor container with keyboard shortcuts and tab management.
Replaces EditorPane in the main layout. Composes TabBar and TabContent.

Changelog:
08/11/2025 13:16 GMT+10 | Added migration hook for backwards compatibility
08/11/2025 13:02 GMT+10 | Initial creation - Tabbed editor container
*/

"use client"

import { useEffect } from 'react'
import { TabBar } from './TabBar'
import { TabContent } from './TabContent'
import { useTabStore } from '@/stores/use-tab-store'
import { useMigration } from '@/features/tabs/hooks/useMigration'

export function TabbedEditorContainer() {
  const { tabs, activeTabId, closeTab, setActiveTab } = useTabStore()

  // Run migration on mount
  useMigration()

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+W or Cmd+W: Close active tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }

      // Ctrl+Tab or Cmd+Tab: Next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        if (tabs.length > 0 && activeTabId) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId)
          const nextIndex = (currentIndex + 1) % tabs.length
          setActiveTab(tabs[nextIndex].id)
        }
      }

      // Ctrl+Shift+Tab: Previous tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Tab') {
        e.preventDefault()
        if (tabs.length > 0 && activeTabId) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId)
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
          setActiveTab(tabs[prevIndex].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tabs, activeTabId, closeTab, setActiveTab])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        <TabContent />
      </div>
    </div>
  )
}
