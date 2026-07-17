"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export async function getWorkspaceSnapshot() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  const [folders, prompts] = await Promise.all([
    db.folder.findMany({
      where: { user_id: user.id },
      orderBy: [{ parent_id: "asc" }, { name: "asc" }],
    }),
    db.prompt.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
        user_id: true,
        folder_id: true,
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updated_at: "desc",
      },
    }),
  ])

  return {
    userId: user.id,
    folders,
    prompts,
    loadedAt: new Date().toISOString(),
  }
}
