import { createServer } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";

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
          {/* Folder Sidebar */}
        </aside>
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
