import { createServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PanelSubheader } from "@/components/layout/PanelSubheader";
import { HistoryButton } from "@/components/layout/HistoryButton";
import { ResizablePanelsLayout } from "@/components/layout/ResizablePanelsLayout";
import { FolderTree } from "@/features/folders/components/FolderTree";
import { FolderToolbar } from "@/features/folders/components/FolderToolbar";
import { PromptList } from "@/features/prompts/components/PromptList";
import { DocumentToolbar } from "@/features/prompts/components/DocumentToolbar";
import { TabbedEditorContainer } from "@/features/tabs/components/TabbedEditorContainer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TabCleanupProvider } from "@/components/layout/TabCleanupProvider";
import { WorkspacePreloader } from "@/components/layout/WorkspacePreloader";

export default async function AppLayout() {
  const supabase = createServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  return (
    <TabCleanupProvider>
      <div className="flex flex-col h-screen">
        <WorkspacePreloader />
        <Header user={data.user} />

        <TooltipProvider delayDuration={700}>
          <ResizablePanelsLayout
          foldersPanel={
          <>
            <PanelSubheader title="Folders">
              <FolderToolbar />
            </PanelSubheader>
            <div className="flex-1 p-4 overflow-y-auto">
              <FolderTree />
            </div>
          </>
        }
        documentsPanel={
          <>
            <PanelSubheader title="Documents">
              <DocumentToolbar />
            </PanelSubheader>
            <div className="flex-1 p-4 overflow-y-auto">
              <PromptList />
            </div>
          </>
        }
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
        />
      </TooltipProvider>
    </div>
    </TabCleanupProvider>
  );
}
