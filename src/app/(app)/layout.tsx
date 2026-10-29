/*
Project: PromptHub
Author: Allan James
Source: src/app/(app)/layout.tsx
MIME: text/typescript
Type: TypeScript React Server Component

Created: 06/11/2025 13:33 GMT+10
Last modified: 29/10/2026 21:12 GMT+10
---------------
The authenticated workspace layout: looks up the user on the server (redirecting to the login page without one) and
renders the workspace preloader, the active-tab folder sync, the header and the three resizable panels.

Changelog:
29/10/2026 21:12 GMT+10 | P7S2T9: passes the user's id to WorkspacePreloader, which binds the workspace cache viewer
                         (decision D5, issue #44); header added (F-9)
06/11/2025 13:33 GMT+10 | Created (commit 4af23fa)
*/
import { createClient } from "@/lib/supabase/server";
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
import { ActiveTabFolderSync } from "@/features/tabs/components/ActiveTabFolderSync";

export default async function AppLayout() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  return (
    <TabCleanupProvider>
      <div className="flex flex-col h-screen">
        <WorkspacePreloader userId={data.user.id} />
        <ActiveTabFolderSync />
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
