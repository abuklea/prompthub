"use server"

import { createClient } from "@/lib/supabase/server"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signUp(values: z.infer<typeof SignUpSchema>) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp(values)
  if (error) {
    throw error
  }
  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signIn(values: z.infer<typeof SignInSchema>) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword(values)
  if (error) {
    throw error
  }
  revalidatePath("/", "layout")
  redirect("/dashboard")
}
