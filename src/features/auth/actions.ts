"use server"

import { createClient } from "@/lib/supabase/server"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import db from "@/lib/db"
import { ActionResult } from "@/types/actions"

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

async function ensureProfileExistsSafe(userId: string) {
  try {
    await ensureProfileExists(userId)
  } catch (error) {
    // Do not block auth flow if profile sync fails.
    // This allows users to sign in even when DB is temporarily unavailable.
    console.error("Profile sync failed during auth", error)
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
      await ensureProfileExistsSafe(data.user.id)
    }

    revalidatePath("/", "layout")
    return { success: true, data: { redirectTo: "/dashboard" } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return { success: false, error: message }
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
      await ensureProfileExistsSafe(data.user.id)
    }

    revalidatePath("/", "layout")
    return { success: true, data: { redirectTo: "/dashboard" } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return { success: false, error: message }
  }
}

export async function signOut() {
  // Note: Client-side cache clearing handled by Header component before form submission
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
