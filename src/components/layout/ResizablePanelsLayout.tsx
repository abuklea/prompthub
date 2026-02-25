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
import { ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
  const [activePanel, setActivePanel] = useState<"folders" | "documents" | "editor">("folders")

  return (
    <>
      {/* Mobile/Small tablet: single panel with quick switcher */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b bg-muted/20">
          <Button
            size="sm"
            variant={activePanel === "folders" ? "default" : "outline"}
            onClick={() => setActivePanel("folders")}
          >
            Folders
          </Button>
          <Button
            size="sm"
            variant={activePanel === "documents" ? "default" : "outline"}
            onClick={() => setActivePanel("documents")}
          >
            Documents
          </Button>
          <Button
            size="sm"
            variant={activePanel === "editor" ? "default" : "outline"}
            onClick={() => setActivePanel("editor")}
          >
            Editor
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <section className={cn("h-full flex flex-col", activePanel === "folders" ? "flex" : "hidden")}>{foldersPanel}</section>
          <section className={cn("h-full flex flex-col", activePanel === "documents" ? "flex" : "hidden")}>{documentsPanel}</section>
          <section className={cn("h-full flex flex-col", activePanel === "editor" ? "flex" : "hidden")}>{editorPanel}</section>
        </div>
      </div>

      {/* Thin layout: folders at top with 2-column workspace below */}
      <PanelGroup
        direction="vertical"
        className="hidden md:flex xl:hidden flex-1 overflow-hidden"
        autoSaveId="main-layout-thin"
      >
        <Panel
          defaultSize={22}
          minSize={12}
          maxSize={45}
          className="flex flex-col overflow-hidden"
        >
          {foldersPanel}
        </Panel>

        <AnimatedResizeHandle direction="horizontal" />

        <Panel
          defaultSize={78}
          minSize={55}
          className="flex flex-col overflow-hidden"
        >
          <PanelGroup
            direction="horizontal"
            className="flex-1 overflow-hidden"
            autoSaveId="main-layout-thin-bottom"
          >
            <Panel
              defaultSize={27}
              minSize={18}
              maxSize={40}
              className="flex flex-col overflow-hidden"
            >
              {documentsPanel}
            </Panel>

            <AnimatedResizeHandle />

            <Panel
              defaultSize={73}
              minSize={60}
              className="flex flex-col overflow-hidden"
            >
              {editorPanel}
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Wide layout: resizable 3-panel layout */}
      <PanelGroup
        direction="horizontal"
        className="hidden xl:flex flex-1 overflow-hidden"
        autoSaveId="main-layout"
      >
        <Panel
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="flex flex-col overflow-hidden"
        >
          {foldersPanel}
        </Panel>

        <AnimatedResizeHandle />

        <Panel
          defaultSize={30}
          minSize={20}
          maxSize={40}
          className="flex flex-col overflow-hidden"
        >
          {documentsPanel}
        </Panel>

        <AnimatedResizeHandle />

        <Panel
          defaultSize={50}
          minSize={40}
          maxSize={70}
          className="flex flex-col overflow-hidden"
        >
          {editorPanel}
        </Panel>
      </PanelGroup>
    </>
  )
}
