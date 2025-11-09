/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/types.ts
MIME: text/typescript
Type: TypeScript Type Definitions

Created: 08/11/2025 12:56 GMT+10
Last modified: 08/11/2025 13:49 GMT+10
---------------
TypeScript type definitions for tabbed editor system.
Defines tab types, data structures, and layout nodes.

Changelog:
08/11/2025 13:49 GMT+10 | Added closeTabsByPromptId and closeTabsByFolderId actions
08/11/2025 13:36 GMT+10 | Added isPreview field for VSCode-style preview tabs
08/11/2025 12:56 GMT+10 | Initial creation - Tab system types
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
  isPreview?: boolean           // Preview tab (italic title, replaces on next click)
  isNewDocument?: boolean       // True for documents not yet saved with valid title
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
  closeTabsByPromptId: (promptId: string) => void // Close all tabs for a deleted document
  closeTabsByFolderId: (folderId: string) => void // Close all tabs for documents in deleted folder
  setActiveTab: (tabId: string) => void
  updateTab: (tabId: string, updates: Partial<TabData>) => void
  reorderTabs: (tabIds: string[]) => void
  promotePreviewTab: (tabId: string) => void // Convert preview to permanent tab
  shouldConfirmClose: (tabId: string) => boolean // Check if close confirmation needed
  closeTabDirectly: (tabId: string) => void // Close tab without confirmation
  splitPane: (direction: 'horizontal' | 'vertical', tabId: string) => void
  closePane: (tabId: string) => void
}
