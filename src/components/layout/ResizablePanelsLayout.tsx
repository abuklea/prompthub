"use client"

import { Fragment, ReactNode, useEffect, useMemo, useState } from "react"
import { Panel, PanelGroup } from "react-resizable-panels"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3 } from "lucide-react"
import { AnimatedResizeHandle } from "./AnimatedResizeHandle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ResizablePanelsLayoutProps {
  foldersPanel: ReactNode
  documentsPanel: ReactNode
  editorPanel: ReactNode
}

type PanelKey = "folders" | "documents" | "editor"

export function ResizablePanelsLayout({ foldersPanel, documentsPanel, editorPanel }: ResizablePanelsLayoutProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>("folders")
  const [wideMode, setWideMode] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<PanelKey, boolean>>({
    folders: false,
    documents: false,
    editor: false,
  })

  useEffect(() => {
    const evaluateMode = () => {
      const ratio = window.innerWidth / Math.max(window.innerHeight, 1)
      setWideMode(window.innerWidth >= 1320 && ratio > 1.3)
    }

    evaluateMode()
    window.addEventListener("resize", evaluateMode)
    return () => window.removeEventListener("resize", evaluateMode)
  }, [])

  const panelConfig = useMemo(
    () => ({
      folders: { label: "Folders", content: foldersPanel },
      documents: { label: "Documents", content: documentsPanel },
      editor: { label: "Editor", content: editorPanel },
    }),
    [documentsPanel, editorPanel, foldersPanel]
  )

  const thinBottomPanels = (Object.keys(panelConfig) as PanelKey[]).filter((panel) => panel !== activePanel)

  const PanelToggle = ({ panel }: { panel: PanelKey }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => setCollapsed((prev) => ({ ...prev, [panel]: !prev[panel] }))}
      title={collapsed[panel] ? `Expand ${panel}` : `Collapse ${panel}`}
    >
      {panel === "folders" ? (
        collapsed[panel] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />
      ) : panel === "editor" ? (
        collapsed[panel] ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
      ) : collapsed[panel] ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronUp className="h-3.5 w-3.5" />
      )}
    </Button>
  )

  return (
    <>
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b bg-muted/20">
          {(Object.keys(panelConfig) as PanelKey[]).map((panel) => (
            <Button key={panel} size="sm" variant={activePanel === panel ? "default" : "outline"} onClick={() => setActivePanel(panel)}>
              {panelConfig[panel].label}
            </Button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <section className={cn("h-full flex flex-col", activePanel === "folders" ? "flex" : "hidden")}>{foldersPanel}</section>
          <section className={cn("h-full flex flex-col", activePanel === "documents" ? "flex" : "hidden")}>{documentsPanel}</section>
          <section className={cn("h-full flex flex-col", activePanel === "editor" ? "flex" : "hidden")}>{editorPanel}</section>
        </div>
      </div>

      {!wideMode ? (
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b bg-muted/20">
            {(Object.keys(panelConfig) as PanelKey[]).map((panel) => (
              <Button key={panel} size="sm" variant={activePanel === panel ? "default" : "outline"} onClick={() => setActivePanel(panel)}>
                {panelConfig[panel].label}
              </Button>
            ))}
          </div>

          <PanelGroup direction="vertical" className="flex-1 overflow-hidden" autoSaveId={`main-layout-thin-${activePanel}`}>
            <Panel
              defaultSize={collapsed[activePanel] ? 4 : 16}
              minSize={collapsed[activePanel] ? 4 : 10}
              collapsible
              collapsedSize={4}
              onCollapse={() => setCollapsed((prev) => ({ ...prev, [activePanel]: true }))}
              onExpand={() => setCollapsed((prev) => ({ ...prev, [activePanel]: false }))}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex justify-end border-b px-2 py-1"><PanelToggle panel={activePanel} /></div>
              {!collapsed[activePanel] && panelConfig[activePanel].content}
            </Panel>

            <AnimatedResizeHandle direction="horizontal" />

            <Panel defaultSize={84} minSize={40} className="flex flex-col overflow-hidden">
              <PanelGroup direction="horizontal" className="flex-1 overflow-hidden" autoSaveId={`main-layout-thin-bottom-${activePanel}`}>
                {thinBottomPanels.map((panel, index) => (
                  <Fragment key={panel}>
                    <Panel
                      defaultSize={panel === "editor" ? 68 : 32}
                      minSize={collapsed[panel] ? 8 : panel === "editor" ? 40 : 18}
                      collapsible
                      collapsedSize={8}
                      onCollapse={() => setCollapsed((prev) => ({ ...prev, [panel]: true }))}
                      onExpand={() => setCollapsed((prev) => ({ ...prev, [panel]: false }))}
                      className="flex flex-col overflow-hidden"
                    >
                      <div className="flex justify-end border-b px-2 py-1"><PanelToggle panel={panel} /></div>
                      {!collapsed[panel] && panelConfig[panel].content}
                    </Panel>
                    {index === 0 && <AnimatedResizeHandle />}
                  </Fragment>
                ))}
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-end border-b bg-muted/20 px-3 py-1 text-xs text-muted-foreground gap-2">
            <Columns3 className="h-3.5 w-3.5" /> Wide 3-column workspace
          </div>
          <PanelGroup direction="horizontal" className="flex-1 overflow-hidden" autoSaveId="main-layout-wide">
            <Panel
              defaultSize={collapsed.folders ? 6 : 18}
              minSize={collapsed.folders ? 6 : 12}
              collapsible
              collapsedSize={6}
              onCollapse={() => setCollapsed((prev) => ({ ...prev, folders: true }))}
              onExpand={() => setCollapsed((prev) => ({ ...prev, folders: false }))}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex justify-end border-b px-2 py-1"><PanelToggle panel="folders" /></div>
              {!collapsed.folders && foldersPanel}
            </Panel>

            <AnimatedResizeHandle />

            <Panel
              defaultSize={collapsed.documents ? 10 : 24}
              minSize={collapsed.documents ? 8 : 16}
              collapsible
              collapsedSize={8}
              onCollapse={() => setCollapsed((prev) => ({ ...prev, documents: true }))}
              onExpand={() => setCollapsed((prev) => ({ ...prev, documents: false }))}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex justify-end border-b px-2 py-1"><PanelToggle panel="documents" /></div>
              {!collapsed.documents && documentsPanel}
            </Panel>

            <AnimatedResizeHandle />

            <Panel
              defaultSize={collapsed.editor ? 30 : 58}
              minSize={collapsed.editor ? 10 : 36}
              collapsible
              collapsedSize={10}
              onCollapse={() => setCollapsed((prev) => ({ ...prev, editor: true }))}
              onExpand={() => setCollapsed((prev) => ({ ...prev, editor: false }))}
              className="flex flex-col overflow-hidden"
            >
              <div className="flex justify-end border-b px-2 py-1"><PanelToggle panel="editor" /></div>
              {!collapsed.editor && editorPanel}
            </Panel>
          </PanelGroup>
        </div>
      )}
    </>
  )
}
