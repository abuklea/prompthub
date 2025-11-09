/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/Header.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 06/11/2025 00:00 GMT+10
Last modified: 08/11/2025 13:12 GMT+10
---------------
Main header component with branding, navigation, and user controls.
Includes tab-based navigation buttons for Settings and Profile pages.

Changelog:
08/11/2025 13:12 GMT+10 | Added Settings and Profile navigation buttons for tab system
*/

"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { signOut } from "@/features/auth/actions"
import { clearDocumentCache } from "@/features/editor/components/EditorPane"
import { useTabStore } from "@/stores/use-tab-store"
import { Settings, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { User } from "@supabase/supabase-js"

interface HeaderProps {
  user?: User | null
}

export function Header({ user }: HeaderProps) {
  const openTab = useTabStore(state => state.openTab)

  // P5S5T5: Clear document cache before logout to prevent cross-user contamination
  const handleSignOut = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearDocumentCache()
    await signOut()
  }

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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openTab({ type: 'profile', title: 'Profile' })}
              >
                Profile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openTab({ type: 'settings', title: 'Settings' })}
              >
                Settings
              </Button>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {user.email}
              </span>

              {/* Tab navigation buttons */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openTab({ type: 'settings', title: 'Settings' })}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openTab({ type: 'profile', title: 'Profile' })}
                    >
                      <UserIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Profile</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <form onSubmit={handleSignOut}>
                <Button variant="outline" size="sm" type="submit">Sign Out</Button>
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
