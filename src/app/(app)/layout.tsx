import { createServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PanelSubheader } from "@/components/layout/PanelSubheader";
import { HistoryButton } from "@/components/layout/HistoryButton";
import { FolderTree } from "@/features/folders/components/FolderTree";
import { FolderToolbar } from "@/features/folders/components/FolderToolbar";
import { PromptList } from "@/features/prompts/components/PromptList";
import { DocumentToolbar } from "@/features/prompts/components/DocumentToolbar";
import { EditorPane } from "@/features/editor/components/EditorPane";

export default async function AppLayout() {
  const supabase = createServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col h-screen">
      <Header user={data.user} />

      {/* Panel Subheaders */}
      <div className="flex border-b">
        <div className="w-64 border-r">
          <PanelSubheader title="Folders">
            <FolderToolbar />
          </PanelSubheader>
        </div>
        <div className="w-96 border-r">
          <PanelSubheader title="Documents">
            <DocumentToolbar />
          </PanelSubheader>
        </div>
        <div className="flex-1">
          <PanelSubheader title="Editor">
            <HistoryButton />
          </PanelSubheader>
        </div>
      </div>

      {/* Main Content Panels */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 p-4 border-r overflow-y-auto">
          <FolderTree />
        </aside>
        <main className="w-96 p-4 border-r overflow-y-auto">
          <PromptList />
        </main>
        <section className="flex-1 overflow-hidden">
          <EditorPane />
        </section>
      </div>
    </div>
  );
}
