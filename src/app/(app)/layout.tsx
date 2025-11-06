import { createServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { FolderTree } from "@/features/folders/components/FolderTree";
import { PromptList } from "@/features/prompts/components/PromptList";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col h-screen">
      <Header user={data.user} />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 p-4 border-r">
          <FolderTree />
        </aside>
        <main className="w-96 p-4 border-r">
          <PromptList />
        </main>
        <section className="flex-1 p-4">
          {children}
        </section>
      </div>
    </div>
  );
}
