import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export async function Header() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <Link href="/" className="text-2xl font-bold">
        PromptHub
      </Link>
      <nav>
        {user ? (
          <div className="flex items-center gap-4">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/settings">Settings</Link>
            <form action="/auth/sign-out" method="post">
              <Button type="submit">Logout</Button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button>Login</Button>
            </Link>
            <Link href="/register">
              <Button variant="outline">Register</Button>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
