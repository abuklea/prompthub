/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/ResizablePanelsLayout.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 07/11/2025 18:07 GMT+10
Last modified: 07/11/2025 18:07 GMT+10
---------------
Resizable 3-column panel layout wrapper component using react-resizable-panels.
Provides user-adjustable column widths with localStorage persistence.

Changelog:
07/11/2025 18:07 GMT+10 | Initial creation - ResizablePanelsLayout with 3 panels
*/

"use client"

import { PanelGroup, Panel } from "react-resizable-panels"
import { AnimatedResizeHandle } from "./AnimatedResizeHandle"
import { ReactNode } from "react"

interface ResizablePanelsLayoutProps {
  foldersPanel: ReactNode
  documentsPanel: ReactNode
  editorPanel: ReactNode
}

/**
 * Resizable 3-column panel layout with persistence
 *
 * Column Configuration:
 * - Folders: 15-30% width, default 20%
 * - Documents: 20-40% width, default 30%
 * - Editor: 40-70% width, default 50%
 *
 * Column widths are automatically persisted to localStorage
 * and restored on subsequent page loads.
 *
 * @param foldersPanel - Content for the folders column
 * @param documentsPanel - Content for the documents column
 * @param editorPanel - Content for the editor column
 */
export function ResizablePanelsLayout({
  foldersPanel,
  documentsPanel,
  editorPanel
}: ResizablePanelsLayoutProps) {
  return (
    <PanelGroup
      direction="horizontal"
      className="flex-1 overflow-hidden"
      autoSaveId="main-layout"
    >
      {/* Folders Panel */}
      <Panel
        defaultSize={20}
        minSize={15}
        maxSize={30}
        className="flex flex-col overflow-hidden"
      >
        {foldersPanel}
      </Panel>

      <AnimatedResizeHandle />

      {/* Documents Panel */}
      <Panel
        defaultSize={30}
        minSize={20}
        maxSize={40}
        className="flex flex-col overflow-hidden"
      >
        {documentsPanel}
      </Panel>

      <AnimatedResizeHandle />

      {/* Editor Panel */}
      <Panel
        defaultSize={50}
        minSize={40}
        maxSize={70}
        className="flex flex-col overflow-hidden"
      >
        {editorPanel}
      </Panel>
    </PanelGroup>
  )
}
