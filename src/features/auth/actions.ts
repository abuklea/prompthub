"use server"

import { createServer } from "@/lib/supabase"
import { SignUpSchema, SignInSchema } from "./schemas"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signUp(values: z.infer<typeof SignUpSchema>) {
  const supabase = createServer()
  const { data, error } = await supabase.auth.signUp(values)
  if (error) {
    throw error
  }
  revalidatePath("/", "layout")
  return data
}

export async function signIn(values: z.infer<typeof SignInSchema>) {
  const supabase = createServer()
  const { data, error } = await supabase.auth.signInWithPassword(values)
  if (error) {
    throw error
  }
  revalidatePath("/", "layout")
  redirect("/")
}

export async function signOut() {
  const supabase = createServer()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
