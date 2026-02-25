"use server"

import db from "@/lib/db"
import { createServer } from "@/lib/supabase"

export async function getWorkspaceSnapshot() {
  const supabase = createServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  const [folders, prompts] = await Promise.all([
    db.folder.findMany({
      where: { user_id: user.id },
      orderBy: { name: "asc" },
    }),
    db.prompt.findMany({
      where: { user_id: user.id },
      orderBy: [{ folder_id: "asc" }, { title: "asc" }],
    }),
  ])

  return { folders, prompts }
}
