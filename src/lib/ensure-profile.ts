"use server"

import db from "@/lib/db"

/**
 * Ensures the authenticated user's Profile record exists before writing related entities.
 * This protects folder/prompt creation for legacy users created before profile sync existed.
 */
export async function ensureProfileExists(userId: string) {
  const existingProfile = await db.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!existingProfile) {
    await db.profile.create({
      data: { id: userId },
    })
  }
}
