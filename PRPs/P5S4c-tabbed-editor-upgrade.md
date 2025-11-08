# PromptHub
## P5S4c - Tabbed Editor Upgrade with Multi-Document Support

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S4c - Tabbed Editor Upgrade with Multi-Document Support | 08/11/2025 11:37 GMT+10 | 08/11/2025 11:37 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Objectives](#objectives)
- [Current State Analysis](#current-state-analysis)
- [Technical Approach](#technical-approach)
- [Architecture & Data Models](#architecture--data-models)
- [Implementation Tasks](#implementation-tasks)
- [File-by-File Implementation Guide](#file-by-file-implementation-guide)
- [Testing & Validation](#testing--validation)
- [Migration Strategy](#migration-strategy)
- [Success Criteria](#success-criteria)
- [References](#references)

## Overview

Transform the Editor pane (column 3) from a single-document viewer into a VSCode-like tabbed-document container supporting multiple open documents simultaneously. The upgrade includes tab drag-and-drop for reordering, horizontal/vertical splitting for side-by-side editing, and integration of all application pages (settings, profile, dashboard, version history) as tabs within the editor pane.

**Visual Reference:**
```
┌─────────────────────────────────────────────────────────┐
│ [Doc1] [Settings] [Doc2*] [Dashboard] [×]              │ ← Tab Bar (draggable)
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Active Tab Content (Monaco Editor / Settings / etc)   │ ← Tab Content Area
│                                                         │
│  (Can be split horizontally/vertically)                │
│                                                         │
└─────────────────────────────────────────────────────────┘

* = unsaved changes indicator
[×] = close button on each tab
```

## Objectives

1. **Multi-Document Support**: Open and manage multiple documents in tabs simultaneously
2. **VSCode-Like UX**: Drag-drop tab reordering, close buttons, keyboard shortcuts
3. **Split Panes**: Horizontal/vertical splitting for side-by-side document viewing
4. **Unified Navigation**: All app pages (settings, profile, dashboard) open as tabs
5. **State Persistence**: Tab configuration persists across browser sessions
6. **Performance**: Lazy-load editors, efficient re-renders for 20+ tabs

## Current State Analysis

### Existing Implementation (EditorPane.tsx)

**Current Behavior:**
- Single document viewer in column 3
- Selected via `useUiStore().selectedPrompt`
- Auto-save with 500ms debounce
- localStorage persistence for unsaved drafts
- Monaco editor with full-height layout

**Key Code Patterns to Preserve:**
```typescript
// src/features/editor/components/EditorPane.tsx (lines 44-257)

// Auto-save hook pattern
useAutoSave({
  content,
  promptId: selectedPrompt,
  delay: 500,
  onSave: handleAutoSave
})

// localStorage persistence
const [localContent, setLocalContent, clearLocalContent] = useLocalStorage({
  key: selectedPrompt ? `prompt-${selectedPrompt}` : 'prompt-draft',
  initialValue: ''
})

// Keyboard shortcut (Ctrl+S)
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [handleSave])
```

### Existing Store Pattern (use-ui-store.ts)

**Pattern to Follow:**
```typescript
// src/stores/use-ui-store.ts (lines 1-81)

export const useUiStore = create<UiState>((set) => ({
  // State
  selectedPrompt: null,

  // Actions
  selectPrompt: (promptId) => set({ selectedPrompt: promptId }),

  // Refetch triggers (P5S4bT2)
  promptRefetchTrigger: 0,
  triggerPromptRefetch: () =>
    set((state) => ({ promptRefetchTrigger: state.promptRefetchTrigger + 1 })),
}))
```

### Layout Integration (ResizablePanelsLayout.tsx)

**Existing Panel System:**
```typescript
// src/components/layout/ResizablePanelsLayout.tsx (lines 1-92)

<PanelGroup direction="horizontal" autoSaveId="main-layout">
  <Panel defaultSize={20} minSize={15} maxSize={30}>
    {foldersPanel}
  </Panel>
  <AnimatedResizeHandle />
  <Panel defaultSize={30} minSize={20} maxSize={40}>
    {documentsPanel}
  </Panel>
  <AnimatedResizeHandle />
  <Panel defaultSize={50} minSize={40} maxSize={70}>
    {editorPanel} {/* Replace with TabbedEditorContainer */}
  </Panel>
</PanelGroup>
```

## Technical Approach

### Library Selection: dnd-kit

**Why dnd-kit over flexlayout-react:**
1. **Lighter Weight**: ~10kb vs 100kb+
2. **TypeScript Native**: First-class TS support
3. **Composability**: Works with existing shadcn/ui patterns
4. **Maintainability**: Active development, React 18+ support
5. **Familiarity**: Already used in shadcn sortable examples

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Split Pane Strategy

**Leverage Existing react-resizable-panels:**
- Already installed and working (v3.0.6)
- Supports nested PanelGroups for complex layouts
- localStorage persistence via `autoSaveId`
- No additional dependencies needed

**Architecture:**
```typescript
// Simple splits: Start with horizontal/vertical only
type SplitDirection = 'horizontal' | 'vertical' | 'none'

interface LayoutNode {
  type: 'panel' | 'split'
  direction?: SplitDirection  // only for 'split'
  children?: LayoutNode[]     // only for 'split'
  tabId?: string              // only for 'panel'
}
```

## Architecture & Data Models

### TypeScript Interfaces

**File: `src/features/tabs/types.ts`**

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/types.ts
MIME: text/typescript
Type: TypeScript Type Definitions

Created: 08/11/2025 11:37 GMT+10
Last modified: 08/11/2025 11:37 GMT+10
---------------
TypeScript type definitions for tabbed editor system.
Defines tab types, data structures, and layout nodes.

Changelog:
08/11/2025 11:37 GMT+10 | Initial creation - Tab system types
*/

/**
 * Tab types representing different content that can be displayed
 */
export type TabType =
  | 'document'          // Prompt/document with Monaco editor
  | 'settings'          // Settings page
  | 'profile'           // User profile page
  | 'dashboard'         // Dashboard page
  | 'version-history'   // Version history modal/panel

/**
 * Core tab data structure
 */
export interface TabData {
  id: string                    // Unique tab identifier
  type: TabType                 // Type of content
  title: string                 // Display title in tab
  icon?: string                 // Optional icon (lucide-react name)
  promptId?: string             // Only for type='document'
  isDirty?: boolean             // Unsaved changes indicator
  isPinned?: boolean            // Pinned tabs don't close
  metadata?: Record<string, any> // Additional type-specific data
}

/**
 * Layout node for split pane support
 */
export type LayoutNode = PanelNode | SplitNode

export interface PanelNode {
  type: 'panel'
  tabId: string                 // Reference to active tab in this panel
  tabs: string[]                // All tabs in this panel (tab IDs)
}

export interface SplitNode {
  type: 'split'
  direction: 'horizontal' | 'vertical'
  children: [LayoutNode, LayoutNode] // Exactly 2 children
  sizes?: [number, number]      // Panel sizes (default: [50, 50])
}

/**
 * Tab store state
 */
export interface TabState {
  tabs: TabData[]               // All open tabs
  activeTabId: string | null    // Currently focused tab
  layout: LayoutNode            // Layout tree structure

  // Actions
  openTab: (tab: Omit<TabData, 'id'>) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTab: (tabId: string, updates: Partial<TabData>) => void
  reorderTabs: (tabIds: string[]) => void
  splitPane: (direction: 'horizontal' | 'vertical', tabId: string) => void
  closePane: (tabId: string) => void
}
```

### State Management Architecture

**File: `src/stores/use-tab-store.ts`**

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/stores/use-tab-store.ts
MIME: text/typescript
Type: TypeScript Zustand Store

Created: 08/11/2025 11:37 GMT+10
Last modified: 08/11/2025 11:37 GMT+10
---------------
Zustand store for managing tabbed editor state.
Handles tab lifecycle, layout management, and localStorage persistence.

Changelog:
08/11/2025 11:37 GMT+10 | Initial creation - Tab state management
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

        // Check for duplicate document tabs
        if (tabInput.type === 'document' && tabInput.promptId) {
          const existing = tabs.find(
            t => t.type === 'document' && t.promptId === tabInput.promptId
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

      splitPane: (direction, tabId) => {
        // TODO: Implement split pane logic
        // Create new PanelNode with tabId
        // Update layout tree with SplitNode
      },

      closePane: (tabId) => {
        // TODO: Implement close pane logic
        // Remove pane from layout tree
        // Merge remaining panes
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
```

## Implementation Tasks

### Task Breakdown (14 tasks, ~25-35 hours total)

| Task | Description | Estimated Time | Files |
|------|-------------|----------------|-------|
| T1 | Install dependencies and create type definitions | 1-2 hours | types.ts, package.json |
| T2 | Create Zustand tab store with persistence | 3-4 hours | use-tab-store.ts |
| T3 | Build DocumentTab component with drag handle | 2-3 hours | DocumentTab.tsx |
| T4 | Build TabBar with dnd-kit sortable | 3-4 hours | TabBar.tsx |
| T5 | Create TabContent renderer component | 2-3 hours | TabContent.tsx |
| T6 | Build TabbedEditorContainer | 3-4 hours | TabbedEditorContainer.tsx |
| T7 | Implement keyboard shortcuts (Ctrl+W, Ctrl+Tab) | 1-2 hours | TabbedEditorContainer.tsx |
| T8 | Refactor EditorPane as tab content | 2-3 hours | EditorPane.tsx |
| T9 | Update PromptList to open tabs | 1-2 hours | PromptList.tsx |
| T10 | Update Header with settings/profile navigation | 1-2 hours | Header.tsx |
| T11 | Make settings/profile/dashboard tab-compatible | 1-2 hours | settings/profile/dashboard pages |
| T12 | Replace EditorPane in layout with TabbedEditor | 1 hour | layout.tsx |
| T13 | Add migration logic for backwards compatibility | 2-3 hours | use-tab-store.ts |
| T14 | Split pane implementation (Phase 2 - deferred) | 4-6 hours | TabbedEditorContainer.tsx |

**Total: 25-35 hours (3-5 days for single FTE)**

## File-by-File Implementation Guide

### 1. Install Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Verification:**
```bash
cat package.json | grep dnd-kit
# Expected: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
```

### 2. Create Type Definitions

**File: `src/features/tabs/types.ts`**

See [Architecture & Data Models](#architecture--data-models) section for complete implementation.

### 3. Create Tab Store

**File: `src/stores/use-tab-store.ts`**

See [State Management Architecture](#state-management-architecture) section for complete implementation.

**Key Implementation Notes:**
- Use Zustand's `persist` middleware for localStorage
- Implement duplicate tab prevention for documents
- Prevent closing pinned tabs
- Select adjacent tab when closing active tab

### 4. Build DocumentTab Component

**File: `src/features/tabs/components/DocumentTab.tsx`**

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/DocumentTab.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 11:37 GMT+10
Last modified: 08/11/2025 11:37 GMT+10
---------------
Individual tab component with drag handle, title, close button, and dirty indicator.
Uses dnd-kit for drag-and-drop functionality.

Changelog:
08/11/2025 11:37 GMT+10 | Initial creation - Document tab component
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
          <span
            className="flex-1 truncate text-sm"
            onClick={onClick}
          >
            {tab.title}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tab.title}</TooltipContent>
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
```

### 5. Build TabBar Component

**File: `src/features/tabs/components/TabBar.tsx`**

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/TabBar.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 11:37 GMT+10
Last modified: 08/11/2025 11:37 GMT+10
---------------
Tab bar container with dnd-kit sortable context for drag-and-drop reordering.

Changelog:
08/11/2025 11:37 GMT+10 | Initial creation - Tab bar with drag-drop
*/

"use client"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { DocumentTab } from './DocumentTab'
import { useTabStore } from '@/stores/use-tab-store'
import type { TabData } from '@/features/tabs/types'

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useTabStore()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex(t => t.id === active.id)
      const newIndex = tabs.findIndex(t => t.id === over.id)

      const reordered = arrayMove(tabs, oldIndex, newIndex)
      reorderTabs(reordered.map(t => t.id))
    }
  }

  if (tabs.length === 0) {
    return (
      <div className="flex items-center h-9 px-4 border-b text-sm text-muted-foreground">
        No tabs open
      </div>
    )
  }

  return (
    <div className="flex items-center h-9 border-b overflow-x-auto scrollbar-thin">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tabs.map(t => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          {tabs.map(tab => (
            <DocumentTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onClose={() => closeTab(tab.id)}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

### 6. Create TabContent Renderer

**File: `src/features/tabs/components/TabContent.tsx`**

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/TabContent.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 11:37 GMT+10
Last modified: 08/11/2025 11:37 GMT+10
---------------
Content renderer that switches between different tab types.
Lazy loads components for performance.

Changelog:
08/11/2025 11:37 GMT+10 | Initial creation - Tab content renderer
*/

"use client"

import { lazy, Suspense } from 'react'
import { useTabStore, useActiveTab } from '@/stores/use-tab-store'

// Lazy load components
const EditorPane = lazy(() => import('@/features/editor/components/EditorPane'))
const SettingsPage = lazy(() => import('@/app/(app)/settings/page'))
const DashboardPage = lazy(() => import('@/app/(app)/dashboard/page'))
const ProfilePage = lazy(() => import('@/app/(app)/profile/page'))

export function TabContent() {
  const activeTab = useActiveTab()

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Select a document or open a page to begin
        </p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      {activeTab.type === 'document' && (
        <EditorPane promptId={activeTab.promptId!} tabId={activeTab.id} />
      )}
      {activeTab.type === 'settings' && <SettingsPage />}
      {activeTab.type === 'dashboard' && <DashboardPage />}
      {activeTab.type === 'profile' && <ProfilePage />}
      {activeTab.type === 'version-history' && (
        <div className="p-8">
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-muted-foreground">Coming soon</p>
        </div>
      )}
    </Suspense>
  )
}
```

### 7. Build TabbedEditorContainer

**File: `src/features/tabs/components/TabbedEditorContainer.tsx`**

```typescript
/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/components/TabbedEditorContainer.tsx
MIME: text/typescript
Type: TypeScript React Component

Created: 08/11/2025 11:37 GMT+10
Last modified: 08/11/2025 11:37 GMT+10
---------------
Main tabbed editor container with keyboard shortcuts and tab management.
Replaces EditorPane in the main layout.

Changelog:
08/11/2025 11:37 GMT+10 | Initial creation - Tabbed editor container
*/

"use client"

import { useEffect } from 'react'
import { TabBar } from './TabBar'
import { TabContent } from './TabContent'
import { useTabStore } from '@/stores/use-tab-store'

export function TabbedEditorContainer() {
  const { tabs, activeTabId, closeTab, setActiveTab } = useTabStore()

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
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
```

### 8. Refactor EditorPane

**File: `src/features/editor/components/EditorPane.tsx`**

**Changes Required:**
1. Accept `promptId` and `tabId` as props (instead of reading from store)
2. Update tab title when document title changes
3. Update tab dirty state when content changes
4. Keep all existing auto-save and localStorage logic

```typescript
// Key changes to EditorPane.tsx

interface EditorPaneProps {
  promptId: string
  tabId: string
}

export function EditorPane({ promptId, tabId }: EditorPaneProps) {
  const updateTab = useTabStore(state => state.updateTab)

  // ... existing state and hooks ...

  // Update tab title when title changes
  useEffect(() => {
    if (title) {
      updateTab(tabId, { title, isDirty: content !== promptData?.content })
    }
  }, [title, content, promptData?.content, tabId, updateTab])

  // ... rest of implementation stays the same ...
}
```

### 9. Update PromptList Integration

**File: `src/features/prompts/components/PromptList.tsx`**

```typescript
// Add to imports
import { useTabStore } from '@/stores/use-tab-store'

// In PromptList component
const openTab = useTabStore(state => state.openTab)

// Replace setSelectedPrompt with openTab
function handlePromptClick(prompt: Prompt) {
  openTab({
    type: 'document',
    title: prompt.title,
    promptId: prompt.id,
  })
}
```

### 10. Update Header Navigation

**File: `src/components/layout/Header.tsx`**

```typescript
// Add navigation buttons for settings/profile
import { useTabStore } from '@/stores/use-tab-store'
import { Settings, User } from 'lucide-react'

export function Header({ user }: HeaderProps) {
  const openTab = useTabStore(state => state.openTab)

  return (
    <header className="...">
      {/* ... existing content ... */}

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openTab({ type: 'settings', title: 'Settings' })}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openTab({ type: 'profile', title: 'Profile' })}
            >
              <User className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Profile</TooltipContent>
        </Tooltip>

        {/* ... existing sign out ... */}
      </div>
    </header>
  )
}
```

### 11. Update Layout Integration

**File: `src/app/(app)/layout.tsx`**

```typescript
// Replace EditorPane with TabbedEditorContainer

import { TabbedEditorContainer } from '@/features/tabs/components/TabbedEditorContainer'

// In ResizablePanelsLayout
editorPanel={
  <>
    <PanelSubheader title="Editor">
      <HistoryButton />
    </PanelSubheader>
    <div className="flex-1 overflow-hidden">
      <TabbedEditorContainer />
    </div>
  </>
}
```

## Testing & Validation

### Automated Checks

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. ESLint
npm run lint

# 3. Build verification
npm run build
```

### Manual Test Checklist

**Basic Tab Operations:**
- [ ] Click document in PromptList opens new tab
- [ ] Clicking same document switches to existing tab (no duplicate)
- [ ] Tab title displays document name
- [ ] Dirty indicator (*) appears when editing
- [ ] Close button (X) closes tab
- [ ] Closing active tab switches to adjacent tab
- [ ] Last tab closed shows empty state

**Drag and Drop:**
- [ ] Can drag tabs to reorder
- [ ] Tab order persists after drag
- [ ] Visual feedback during drag (opacity)
- [ ] Cannot drag pinned tabs (future feature)

**Keyboard Shortcuts:**
- [ ] Ctrl+W closes active tab
- [ ] Ctrl+Tab switches to next tab
- [ ] Ctrl+Shift+Tab switches to previous tab
- [ ] Ctrl+S saves document (existing feature)

**Multi-Document Editing:**
- [ ] Open 3+ documents in tabs
- [ ] Auto-save works independently in each tab
- [ ] Switch between tabs shows correct content
- [ ] Each tab maintains its own undo/redo history

**System Pages:**
- [ ] Settings button in header opens Settings tab
- [ ] Profile button in header opens Profile tab
- [ ] Dashboard accessible via navigation
- [ ] Only one instance of each system page can be open

**Persistence:**
- [ ] Refresh browser, tabs restore correctly
- [ ] Active tab is restored
- [ ] Tab order is maintained
- [ ] Unsaved changes restore from localStorage

**Performance:**
- [ ] Open 10+ tabs, no lag
- [ ] Switching tabs is instant (<100ms)
- [ ] Monaco editor lazy loads (not all instances at once)

### Edge Cases

- [ ] Close all tabs, then open new document
- [ ] Open tab, edit, refresh, verify restoration
- [ ] Close browser, reopen, verify tab state
- [ ] Clear localStorage, verify graceful degradation

## Migration Strategy

### Backwards Compatibility

**Problem:** Existing users have `selectedPrompt` in `use-ui-store`

**Solution:** Migration on first load

```typescript
// In use-tab-store.ts initialization

// Check for migration
const migrateFromOldStore = () => {
  const uiStore = useUiStore.getState()
  const selectedPrompt = uiStore.selectedPrompt

  if (selectedPrompt && get().tabs.length === 0) {
    // Fetch prompt details
    getPromptDetails({ promptId: selectedPrompt }).then(result => {
      if (result.success && result.data) {
        openTab({
          type: 'document',
          title: result.data.title,
          promptId: selectedPrompt,
        })
      }
    })

    // Clear old store
    uiStore.selectPrompt(null)
  }
}

// Run migration after hydration
useEffect(() => {
  migrateFromOldStore()
}, [])
```

## Success Criteria

### Feature Completeness

- [x] Multiple documents can be open simultaneously in tabs
- [x] Tabs display document titles and dirty indicators
- [x] Tabs can be dragged to reorder
- [x] Tabs can be closed with X button
- [x] Settings, Profile, Dashboard open as tabs
- [x] Keyboard shortcuts work (Ctrl+W, Ctrl+Tab)
- [x] Tab state persists across browser sessions
- [x] Auto-save works independently per tab
- [x] Empty state when no tabs open
- [ ] Split panes (horizontal/vertical) - **Deferred to Phase 2**

### Performance Criteria

- [ ] Tab switching < 100ms
- [ ] Supports 20+ tabs without lag
- [ ] Monaco editor lazy loads
- [ ] Build size increase < 50kb

### Code Quality

- [ ] All files have proper headers
- [ ] TypeScript strict mode passes
- [ ] ESLint passes with no warnings
- [ ] No console errors or warnings
- [ ] Follows existing codebase patterns

## References

### External Documentation

1. **dnd-kit Documentation**
   - Main docs: https://docs.dndkit.com
   - Sortable preset: https://docs.dndkit.com/presets/sortable
   - TypeScript usage: https://docs.dndkit.com/introduction/typescript

2. **react-resizable-panels**
   - GitHub: https://github.com/bvaughn/react-resizable-panels
   - Already installed in package.json (v3.0.6)

3. **Shadcn Sortable Template**
   - GitHub: https://github.com/sadmann7/sortable
   - Shows dnd-kit + shadcn integration pattern

4. **VSCode Tab API Reference**
   - Docs: https://code.visualstudio.com/api/references/vscode-api#Tab
   - Design inspiration for tab behavior

### Codebase Files

**Key Files to Reference:**

1. `src/features/editor/components/EditorPane.tsx` (lines 44-257)
   - Current single-doc implementation
   - Auto-save pattern
   - localStorage persistence

2. `src/stores/use-ui-store.ts` (lines 1-81)
   - Zustand store pattern
   - Refetch trigger pattern

3. `src/components/layout/ResizablePanelsLayout.tsx` (lines 1-92)
   - PanelGroup usage for splits
   - localStorage persistence via autoSaveId

4. `src/features/editor/hooks/useAutoSave.ts`
   - Auto-save hook pattern to preserve

5. `src/features/editor/hooks/useLocalStorage.ts`
   - localStorage hook pattern

6. `docs/rules/documentation.md`
   - File header requirements
   - Changelog format

**Component Patterns:**

- `src/features/folders/components/FolderToolbar.tsx` - Icon button pattern
- `src/components/ui/tooltip.tsx` - Tooltip usage pattern
- `src/components/layout/PanelSubheader.tsx` - Subheader styling (36px height)

### Design Patterns

**Zustand Middleware:**
- Persist: https://docs.pmnd.rs/zustand/integrations/persisting-store-data
- Immer: https://docs.pmnd.rs/zustand/integrations/immer-middleware

**React Patterns:**
- Lazy loading: https://react.dev/reference/react/lazy
- Keyboard events: https://react.dev/reference/react-dom/components/common#react-event-object

## PRP Quality Score

**Confidence Level: 8/10**

**Strengths:**
- ✅ Clear existing patterns to follow (ResizablePanelsLayout, use-ui-store)
- ✅ Well-researched library choices with TypeScript support
- ✅ Comprehensive codebase references provided
- ✅ Executable validation gates defined
- ✅ Backwards compatibility addressed
- ✅ File-by-file pseudocode with real examples

**Risks Identified:**
- ⚠️ Complex split pane state (mitigated: deferred to Phase 2)
- ⚠️ Tab synchronization edge cases (mitigated: clear update pattern)
- ⚠️ Performance with many tabs (mitigated: lazy loading strategy)

**One-Pass Implementation Likelihood: High**

This PRP provides sufficient context, patterns, and references for an AI agent to implement the feature successfully in a single pass without additional research or clarification.

---

**PRP Status**: TODO
**PRP ID**: P5S4c
**Archon Project**: PromptHub (d449f266-1f36-47ad-bd2d-30f1a0f5e999)
**PRP Document**: PRPs/P5S4c-tabbed-editor-upgrade.md
**Tasks**: 14 tasks (P5S4cT1 - P5S4cT14)
**Phase**: Phase 5 - Prompt Editor & Version Control
**Dependencies**: P5S4b (Complete)
**Next PRP**: P5S5 - Version History UI
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-13)
- `ux-ui-designer` (Tasks 3-6 - tab UX design)
Notes:**
- Start with basic horizontal tab bar (no splits)
- Defer split panes to Phase 2 after basic tabs working
- Preserve all existing auto-save and localStorage patterns
- Follow compact UI sizing (12px base, 36px subheader)
- Use dnd-kit (lightweight, TypeScript-first)
**Estimated Implementation Time (FTE):** 25-35 hours (3-5 days)
