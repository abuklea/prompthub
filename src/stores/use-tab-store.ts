/*
Project: PromptHub
Author: Allan James
Source: src/stores/use-tab-store.ts
MIME: text/typescript
Type: TypeScript Zustand Store

Created: 08/11/2025 12:57 GMT+10
Last modified: 08/11/2025 13:50 GMT+10
---------------
Zustand store for managing tabbed editor state.
Handles tab lifecycle, layout management, and localStorage persistence.

Changelog:
08/11/2025 13:50 GMT+10 | Added closeTabsByPromptId and closeTabsByFolderId for auto-cleanup on delete
08/11/2025 13:37 GMT+10 | Added preview tab support (isPreview) with VSCode-style behavior
08/11/2025 12:57 GMT+10 | Initial creation - Tab state management
*/

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TabData, TabState, LayoutNode, PanelNode } from '@/features/tabs/types'

const STORAGE_KEY = 'prompthub-tabs-state'

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      layout: { type: 'panel', tabId: '', tabs: [] } as PanelNode,

      openTab: (tabInput) => {
        const tabs = get().tabs

        // Check for duplicate document tabs (ignore preview tabs)
        if (tabInput.type === 'document' && tabInput.promptId) {
          const existing = tabs.find(
            t => t.type === 'document' && t.promptId === tabInput.promptId && !t.isPreview
          )
          if (existing) {
            set({ activeTabId: existing.id })
            return
          }
        }

        // Check for duplicate system tabs (settings, profile, dashboard)
        if (['settings', 'profile', 'dashboard'].includes(tabInput.type)) {
          const existing = tabs.find(t => t.type === tabInput.type)
          if (existing) {
            set({ activeTabId: existing.id })
            return
          }
        }

        // If opening a preview tab, close existing preview tab first
        if (tabInput.isPreview) {
          const existingPreview = tabs.find(t => t.isPreview)
          if (existingPreview) {
            // Close the existing preview tab
            const newTabs = tabs.filter(t => t.id !== existingPreview.id)
            set({
              tabs: newTabs,
              layout: removeTabFromLayout(get().layout, existingPreview.id)
            })
          }
        }

        // Create new tab
        const newTab: TabData = {
          ...tabInput,
          id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isDirty: false,
        }

        set(state => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
          // Update layout to include new tab
          layout: addTabToLayout(state.layout, newTab.id)
        }))
      },

      closeTab: (tabId) => {
        const tabs = get().tabs
        const index = tabs.findIndex(t => t.id === tabId)

        if (index === -1) return

        // Don't close pinned tabs
        if (tabs[index].isPinned) return

        const newTabs = tabs.filter(t => t.id !== tabId)
        let newActiveId = get().activeTabId

        // If closing active tab, select adjacent tab
        if (newActiveId === tabId) {
          if (newTabs.length > 0) {
            newActiveId = newTabs[Math.min(index, newTabs.length - 1)].id
          } else {
            newActiveId = null
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
          layout: removeTabFromLayout(get().layout, tabId)
        })
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateTab: (tabId, updates) => {
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === tabId ? { ...t, ...updates } : t
          )
        }))
      },

      reorderTabs: (tabIds) => {
        const tabs = get().tabs
        const reordered = tabIds
          .map(id => tabs.find(t => t.id === id))
          .filter((t): t is TabData => t !== undefined)

        set({ tabs: reordered })
      },

      promotePreviewTab: (tabId) => {
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === tabId ? { ...t, isPreview: false } : t
          )
        }))
      },

      shouldConfirmClose: (tabId) => {
        const tab = get().tabs.find(t => t.id === tabId)
        return tab?.isNewDocument === true
      },

      closeTabDirectly: (tabId) => {
        const tabs = get().tabs
        const index = tabs.findIndex(t => t.id === tabId)

        if (index === -1) return

        // Don't close pinned tabs
        if (tabs[index].isPinned) return

        const newTabs = tabs.filter(t => t.id !== tabId)
        let newActiveId = get().activeTabId

        // If closing active tab, select adjacent tab
        if (newActiveId === tabId) {
          if (newTabs.length > 0) {
            newActiveId = newTabs[Math.min(index, newTabs.length - 1)].id
          } else {
            newActiveId = null
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
          layout: removeTabFromLayout(get().layout, tabId)
        })
      },

      closeTabsByPromptId: (promptId) => {
        const tabs = get().tabs
        const tabsToClose = tabs.filter(t => t.type === 'document' && t.promptId === promptId)

        // Close each tab matching this promptId
        tabsToClose.forEach(tab => {
          get().closeTab(tab.id)
        })
      },

      closeTabsByFolderId: (folderId) => {
        // Note: This is a placeholder for future use
        // Currently, folder deletion handles closing tabs by getting promptIds
        // and calling closeTabsByPromptId for each one
        // This function exists to match the interface but is not actively used
        console.warn('closeTabsByFolderId: Use closeTabsByPromptId in delete handlers instead')
      },

      splitPane: (direction, tabId) => {
        // TODO: Implement split pane logic
        // Create new PanelNode with tabId
        // Update layout tree with SplitNode
        console.warn('splitPane not yet implemented - deferred to Phase 2')
      },

      closePane: (tabId) => {
        // TODO: Implement close pane logic
        // Remove pane from layout tree
        // Merge remaining panes
        console.warn('closePane not yet implemented - deferred to Phase 2')
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        // Don't persist layout for now (complex serialization)
      }),
    }
  )
)

// Helper functions
function addTabToLayout(layout: LayoutNode, tabId: string): LayoutNode {
  if (layout.type === 'panel') {
    return {
      ...layout,
      tabId: tabId,
      tabs: [...layout.tabs, tabId]
    }
  }
  // For splits, add to first panel
  return {
    ...layout,
    children: [
      addTabToLayout(layout.children[0], tabId),
      layout.children[1]
    ]
  }
}

function removeTabFromLayout(layout: LayoutNode, tabId: string): LayoutNode {
  if (layout.type === 'panel') {
    const newTabs = layout.tabs.filter(id => id !== tabId)
    return {
      ...layout,
      tabId: newTabs.length > 0 ? newTabs[newTabs.length - 1] : '',
      tabs: newTabs
    }
  }
  // For splits, recursively remove
  return {
    ...layout,
    children: [
      removeTabFromLayout(layout.children[0], tabId),
      removeTabFromLayout(layout.children[1], tabId)
    ]
  }
}

// Selector hooks for performance
export const useActiveTab = () => useTabStore(state =>
  state.tabs.find(t => t.id === state.activeTabId)
)

export const useTabById = (tabId: string | null) => useTabStore(state =>
  tabId ? state.tabs.find(t => t.id === tabId) : null
)
