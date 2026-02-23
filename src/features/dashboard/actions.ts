"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export type DashboardMetrics = {
  totalPrompts: number
  totalFolders: number
  totalVersions: number
  recentlyUpdatedPrompts: Array<{
    id: string
    title: string
    updatedAt: Date
    folderName: string | null
  }>
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      totalPrompts: 0,
      totalFolders: 0,
      totalVersions: 0,
      recentlyUpdatedPrompts: [],
    }
  }

  const [totalPrompts, totalFolders, totalVersions, recentlyUpdatedPrompts] = await Promise.all([
    db.prompt.count({
      where: { user_id: user.id },
    }),
    db.folder.count({
      where: { user_id: user.id },
    }),
    db.promptVersion.count({
      where: {
        prompt: {
          user_id: user.id,
        },
      },
    }),
    db.prompt.findMany({
      where: { user_id: user.id },
      orderBy: { updated_at: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        updated_at: true,
        folder: {
          select: {
            name: true,
          },
        },
      },
    }),
  ])

  return {
    totalPrompts,
    totalFolders,
    totalVersions,
    recentlyUpdatedPrompts: recentlyUpdatedPrompts.map((prompt) => ({
      id: prompt.id,
      title: prompt.title?.trim() || "Untitled prompt",
      updatedAt: prompt.updated_at,
      folderName: prompt.folder?.name || null,
    })),
  }
}
