"use server"

import db from "@/lib/db"
import { createServer } from "@/lib/supabase"
import { ensureProfileExists } from "@/lib/ensure-profile"

export async function getProfile() {
  const supabase = createServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  await ensureProfileExists(user.id)

  const profile = await db.profile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      display_name: true,
      created_at: true,
    },
  })

  return {
    id: user.id,
    email: user.email || "",
    displayName: profile?.display_name || "",
    createdAt: profile?.created_at || new Date(),
  }
}

export async function updateProfileDisplayName(displayName: string) {
  const supabase = createServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  await ensureProfileExists(user.id)

  const updated = await db.profile.update({
    where: { id: user.id },
    data: {
      display_name: displayName.trim() || null,
    },
    select: {
      display_name: true,
      created_at: true,
    },
  })

  return {
    displayName: updated.display_name || "",
    createdAt: updated.created_at,
  }
}
