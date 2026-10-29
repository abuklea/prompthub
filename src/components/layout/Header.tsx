/*
Project: PromptHub
Author: Allan James
Source: src/components/layout/Header.tsx
MIME: text/x-typescript
Type: TypeScript React Component

Created: 06/11/2025 00:00 GMT+10
Last modified: 29/10/2026 21:30 GMT+10
---------------
Main header component with branding, navigation, and user controls.
Includes tab-based navigation buttons for Settings and Profile pages, and the Sign Out control, which asks before it
discards unsaved work.

Changelog:
29/10/2026 21:30 GMT+10 | Sign-out asks "Sign out and discard unsaved work?" when hasUnsavedClientWork is true, and
                         signs out at once otherwise; one sign-out path, disabled while in flight (P7S2T14, D10, #120)
29/10/2026 21:11 GMT+10 | Sign-out purges every client state (purgeClientState) before signOut, replacing the lone
                         document-cache clear (P7S2T9, issue #44, DR-16)
22/10/2026 09:16 GMT+10 | Imports clearDocumentCache from the document-cache module (P7S1T5)
08/11/2025 13:12 GMT+10 | Added Settings and Profile navigation buttons for tab system
*/

"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { signOut } from "@/features/auth/actions"
import { hasUnsavedClientWork, purgeClientState } from "@/features/auth/client-purge"
import { cn } from "@/lib/utils"
import { useTabStore } from "@/stores/use-tab-store"
import { Settings, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { User } from "@supabase/supabase-js"

interface HeaderProps {
  user?: User | null
}

/**
 * The Sign Out button. With unsaved work (a dirty tab or a browser draft) it first asks "Sign out and discard unsaved
 * work?"; Cancel changes nothing. Without unsaved work it signs out at once (decision D10).
 * @returns The sign-out form and its question.
 */
function SignOutControl() {
  const [confirming, setConfirming] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Reason: the one sign-out path for both entries. signOut's redirect is a client navigation that keeps every module's
  // state, so the purge empties it first. The button stays disabled while it runs, so a second submit cannot start; it
  // is enabled again only when signOut fails, because on success the redirect replaces the page.
  const signOutNow = async () => {
    setSigningOut(true)
    purgeClientState()
    try {
      await signOut()
    } catch (error) {
      setSigningOut(false)
      throw error
    }
  }

  const handleSignOut = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (signingOut) return
    if (hasUnsavedClientWork()) setConfirming(true)
    else void signOutNow()
  }

  return (
    <>
      <form onSubmit={handleSignOut}>
        <Button variant="outline" size="sm" type="submit" className="px-2 sm:px-3" disabled={signingOut}>
          Sign Out
        </Button>
      </form>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out and discard unsaved work?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes that are not saved yet and the drafts kept in this browser will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:bg-accent/80">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void signOutNow()}
              className={cn(buttonVariants({ variant: "destructive" }), "active:bg-destructive/80")}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function Header({ user }: HeaderProps) {
  const openTab = useTabStore(state => state.openTab)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between px-3 sm:px-4 gap-2">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link href={user ? "/dashboard" : "/"}>
            <h1 className="font-extrabold tracking-tighter text-xl sm:text-2xl whitespace-nowrap">
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

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
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

              <SignOutControl />
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
