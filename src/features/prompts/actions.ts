"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { createPromptSchema, getPromptDetailsSchema } from "./schemas"

// Reason: ActionResult type for consistent server action return values
type ActionResult<T = any> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function getPromptsByFolder(folderId: string) {
  const supabase = createClient()
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

/**
 * Create a new prompt in the specified folder
 *
 * @param data - Object containing folderId and optional title
 * @returns ActionResult with promptId on success, error message on failure
 */
export async function createPrompt(data: unknown): Promise<ActionResult<{ promptId: string }>> {
  try {
    // Validate input
    const parsed = createPromptSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: "Invalid input data" }
    }

    // Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Create prompt in database
    const prompt = await db.prompt.create({
      data: {
        user_id: user.id,
        folder_id: parsed.data.folderId,
        title: parsed.data.title || "Untitled Prompt",
        content: "",
      }
    })

    return { success: true, data: { promptId: prompt.id } }
  } catch (error) {
    // Reason: NEXT_REDIRECT must be re-thrown for Next.js navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("createPrompt error:", error)
    return { success: false, error: "Failed to create prompt" }
  }
}

/**
 * Get full details of a specific prompt
 *
 * @param data - Object containing promptId
 * @returns ActionResult with prompt data including folder, or error message
 */
export async function getPromptDetails(data: unknown): Promise<ActionResult> {
  try {
    // Validate input
    const parsed = getPromptDetailsSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: "Invalid prompt ID" }
    }

    // Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Reason: Fetch prompt with user_id filter to enforce RLS
    const prompt = await db.prompt.findFirst({
      where: {
        id: parsed.data.promptId,
        user_id: user.id, // Enforce user isolation
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    })

    if (!prompt) {
      return { success: false, error: "Prompt not found" }
    }

    return { success: true, data: prompt }
  } catch (error) {
    // Reason: NEXT_REDIRECT must be re-thrown for Next.js navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("getPromptDetails error:", error)
    return { success: false, error: "Failed to fetch prompt details" }
  }
}
