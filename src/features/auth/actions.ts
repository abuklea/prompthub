/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 06/11/2025 13:33 GMT+10
Last modified: 29/10/2026 20:46 GMT+10
---------------
Server actions for authentication. signUp and signIn are thin wrappers over ./handlers, which validate the input, limit
attempts per client IP, send Supabase only the email and password, create the user's profile and answer with fixed
messages; the wrappers revalidate the layout on success. signOut ends the Supabase session and redirects to the login
page, so it keeps its body here (a handler never redirects).

Changelog:
29/10/2026 20:46 GMT+10 | P7S2T4: signUp and signIn delegate to ./handlers with authDeps and revalidate on success;
                         ensureProfileExistsSafe and every returned Supabase or thrown message removed (issue #112)
29/10/2026 20:05 GMT+10 | P7S2T1: passes the database client to ensureProfileExists; header added
06/11/2025 13:33 GMT+10 | Created (commit 4af23fa)
*/

"use server"

import type { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { authDeps } from "@/lib/action-runtime"
import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/types/actions"
import * as handlers from "./handlers"
import type { SignInSchema, SignUpSchema } from "./schemas"

/**
 * Create an account with an email and password.
 *
 * @param values - The sign-up form values; parsed again by the handler.
 * @returns `{ redirectTo }` on success; otherwise a fixed message.
 */
export async function signUp(values: z.input<typeof SignUpSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  const result = await handlers.signUp(authDeps, values)
  if (result.success) revalidatePath("/", "layout")
  return result
}

/**
 * Sign in with an email and password.
 *
 * @param values - The sign-in form values; parsed again by the handler.
 * @returns `{ redirectTo }` on success; otherwise a fixed message.
 */
export async function signIn(values: z.input<typeof SignInSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  const result = await handlers.signIn(authDeps, values)
  if (result.success) revalidatePath("/", "layout")
  return result
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
