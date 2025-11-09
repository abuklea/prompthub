"use server"

import { createClient } from "@/lib/supabase/server"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import db from "@/lib/db"
import { ActionResult } from "@/types/actions"
import { clearDocumentCache } from "@/features/editor/components/EditorPane"

async function ensureProfileExists(userId: string) {
  // Check if profile exists
  const existingProfile = await db.profile.findUnique({
    where: { id: userId }
  })

  // Create profile if it doesn't exist
  if (!existingProfile) {
    await db.profile.create({
      data: {
        id: userId
      }
    })
  }
}

export async function signUp(values: z.infer<typeof SignUpSchema>): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp(values)

    if (error) {
      return { success: false, error: error.message }
    }

    // Ensure profile exists for the new user
    if (data.user?.id) {
      await ensureProfileExists(data.user.id)
    }

    revalidatePath("/", "layout")
    redirect("/dashboard") // This throws NEXT_REDIRECT - expected!
  } catch (error) {
    // Catch both auth errors and other unexpected errors
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error // Re-throw redirect
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function signIn(values: z.infer<typeof SignInSchema>): Promise<ActionResult> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword(values)

    if (error) {
      return { success: false, error: error.message }
    }

    // Ensure profile exists for existing users (in case it was deleted or missed)
    if (data.user?.id) {
      await ensureProfileExists(data.user.id)
    }

    revalidatePath("/", "layout")
    redirect("/dashboard")
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function signOut() {
  // CRITICAL: Clear client-side caches before logout (P5S4T2)
  if (typeof window !== 'undefined') {
    clearDocumentCache()
  }

  const supabase = createClient()

  // Check if a user's session exists
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    await supabase.auth.signOut()
  }

  revalidatePath("/", "layout")
  redirect("/login")
}
