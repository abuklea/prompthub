"use server"

import db from "@/lib/db"
import { createServer } from "@/lib/supabase"

export async function getPromptsByFolder(folderId: string) {
  const supabase = createServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  return await db.prompt.findMany({
    where: {
      user_id: user.id,
      folder_id: folderId,
    },
    orderBy: {
      title: "asc",
    },
  })
}
