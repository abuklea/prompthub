"use client"

import { Button } from "@/components/ui/button"
import { signOut } from "@/features/auth/actions"

export function Header({ user }: { user: any }) {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div>
        <h1 className="text-lg font-semibold">{user?.email}</h1>
      </div>
      <form action={signOut}>
        <Button variant="outline">Sign Out</Button>
      </form>
    </header>
  )
}
