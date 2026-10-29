/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 06/11/2025 13:33 GMT+10
Last modified: 29/10/2026 20:05 GMT+10
---------------
Server actions for authentication: sign-up and sign-in, rate-limited by client IP, each creating the user's profile
when it is missing; and sign-out, which ends the Supabase session and redirects to the login page.

Changelog:
29/10/2026 20:05 GMT+10 | P7S2T1: passes the database client to ensureProfileExists; header added
06/11/2025 13:33 GMT+10 | Created (commit 4af23fa)
*/

"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ActionResult } from "@/types/actions"
import { ensureProfileExists } from "@/lib/ensure-profile"
import { checkAuthRateLimit } from "@/lib/rate-limit"

async function ensureProfileExistsSafe(userId: string) {
  try {
    await ensureProfileExists(db, userId)
  } catch (error) {
    // Do not block auth flow if profile sync fails.
    // This allows users to sign in even when DB is temporarily unavailable.
    console.error("Profile sync failed during auth", error)
  }
}

export async function signUp(values: z.infer<typeof SignUpSchema>): Promise<ActionResult> {
  try {
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const { allowed } = checkAuthRateLimit(ip)
    if (!allowed) {
      return { success: false, error: "Too many attempts. Please try again later." }
    }

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
    const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const { allowed } = checkAuthRateLimit(ip)
    if (!allowed) {
      return { success: false, error: "Too many attempts. Please try again later." }
    }

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
