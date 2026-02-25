"use client"

import { PanelGroup, Panel, type ImperativePanelHandle } from "react-resizable-panels"
import { AnimatedResizeHandle } from "./AnimatedResizeHandle"
import { ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Columns3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ResizablePanelsLayoutProps {
  foldersPanel: ReactNode
  documentsPanel: ReactNode
  editorPanel: ReactNode
}

type PanelKey = "folders" | "documents" | "editor"

export function ResizablePanelsLayout({ foldersPanel, documentsPanel, editorPanel }: ResizablePanelsLayoutProps) {
  const [activePanel, setActivePanel] = useState<PanelKey>("folders")
  const [isWideLayout, setIsWideLayout] = useState(false)

  const folderRef = useRef<ImperativePanelHandle>(null)
  const documentsRef = useRef<ImperativePanelHandle>(null)
  const editorRef = useRef<ImperativePanelHandle>(null)

  const panelConfig = useMemo(
    () => ({
      folders: { label: "Folders", content: foldersPanel },
      documents: { label: "Documents", content: documentsPanel },
      editor: { label: "Editor", content: editorPanel },
    }),
    [documentsPanel, editorPanel, foldersPanel]
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1440px), (min-aspect-ratio: 16/9) and (min-width: 1200px)")
    const update = () => setIsWideLayout(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => mediaQuery.removeEventListener("change", update)
  }, [])

  const collapsePanel = (panel: PanelKey) => {
    const ref = panel === "folders" ? folderRef : panel === "documents" ? documentsRef : editorRef
    ref.current?.collapse()
  }

  const expandPanel = (panel: PanelKey) => {
    const ref = panel === "folders" ? folderRef : panel === "documents" ? documentsRef : editorRef
    ref.current?.expand()
  }

  const twoColumnPanels = (["folders", "documents", "editor"] as PanelKey[]).filter((panel) => panel !== activePanel)

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
        <div className="flex-1 min-h-0 overflow-hidden">{panelConfig[activePanel].content}</div>
      </div>

      {!isWideLayout ? (
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b bg-muted/20">
            {(Object.keys(panelConfig) as PanelKey[]).map((panel) => (
              <Button key={panel} size="sm" variant={activePanel === panel ? "default" : "outline"} onClick={() => setActivePanel(panel)}>
                {panelConfig[panel].label}
              </Button>
            ))}
          </div>

          <PanelGroup direction="horizontal" className="flex-1 overflow-hidden" autoSaveId={`main-layout-two-column-${activePanel}`}>
            <Panel defaultSize={35} minSize={15} collapsible collapsedSize={0} className="flex flex-col overflow-hidden">
              {panelConfig[twoColumnPanels[0]].content}
            </Panel>
            <AnimatedResizeHandle />
            <Panel defaultSize={65} minSize={30} collapsible collapsedSize={0} className="flex flex-col overflow-hidden">
              {panelConfig[twoColumnPanels[1]].content}
            </Panel>
          </PanelGroup>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="flex-1 overflow-hidden" autoSaveId="main-layout-wide">
            <Panel ref={folderRef} defaultSize={20} minSize={0} maxSize={35} collapsible collapsedSize={0} className="flex flex-col overflow-hidden">
              {foldersPanel}
            </Panel>
            <AnimatedResizeHandle />

            <Panel ref={documentsRef} defaultSize={28} minSize={0} maxSize={45} collapsible collapsedSize={0} className="flex flex-col overflow-hidden">
              {documentsPanel}
            </Panel>
            <AnimatedResizeHandle />

            <Panel ref={editorRef} defaultSize={52} minSize={30} maxSize={85} collapsible collapsedSize={0} className="flex flex-col overflow-hidden">
              {editorPanel}
            </Panel>
          </PanelGroup>

          <div className="absolute right-3 top-[92px] z-10 flex items-center gap-1 rounded-md border bg-background/90 p-1 backdrop-blur">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => collapsePanel("folders")}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => expandPanel("folders")}><ChevronRight className="h-4 w-4" /></Button>
            <div className={cn("h-4 w-px bg-border mx-1")} />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => collapsePanel("documents")}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => expandPanel("documents")}><ChevronRight className="h-4 w-4" /></Button>
            <div className={cn("h-4 w-px bg-border mx-1")} />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => expandPanel("editor")}><Columns3 className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </>
  )
}
