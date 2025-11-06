"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "@/features/auth/actions"
import Link from "next/link"
import { User } from "@supabase/supabase-js"

interface HeaderProps {
  user?: User | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"}>
            <h1 className="font-extrabold tracking-tighter text-2xl">
              PromptHub
            </h1>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">Profile</Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm">Settings</Button>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {user.email}
              </span>
              <form action={signOut}>
                <Button variant="outline" size="sm">Sign Out</Button>
              </form>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
