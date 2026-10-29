/*
Project: PromptHub
Author: Allan James
Source: src/features/profile/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 25/02/2026 16:11 GMT+10
Last modified: 29/10/2026 20:05 GMT+10
---------------
Server actions for the account page: reading the user's profile details and updating the display name, each creating
the profile first when it is missing.

Changelog:
29/10/2026 20:05 GMT+10 | P7S2T1: passes the database client to ensureProfileExists; header added
25/02/2026 16:11 GMT+10 | Created (commit b8fb4db)
*/

"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { ensureProfileExists } from "@/lib/ensure-profile"

export async function getProfileDetails() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  await ensureProfileExists(db, user.id)

  const profile = await db.profile.findUnique({
    where: { id: user.id },
    select: {
      display_name: true,
      created_at: true,
    },
  })

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? "",
    createdAt: profile?.created_at ?? new Date(),
  }
}

export async function updateDisplayName(displayName: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  await ensureProfileExists(db, user.id)

  const updated = await db.profile.update({
    where: { id: user.id },
    data: { display_name: displayName.trim() || null },
    select: {
      display_name: true,
    },
  })

  return {
    displayName: updated.display_name ?? "",
  }
}
