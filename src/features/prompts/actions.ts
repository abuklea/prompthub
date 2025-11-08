"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { createPromptSchema, getPromptDetailsSchema } from "./schemas"
import { ActionResult } from "@/types/actions"

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

    // Reason: Check for duplicate title in the same folder (case-insensitive)
    const title = parsed.data.title || "Untitled Prompt"
    const existing = await db.prompt.findFirst({
      where: {
        folder_id: parsed.data.folderId,
        user_id: user.id,
        title: {
          equals: title,
          mode: 'insensitive'
        }
      }
    })

    if (existing) {
      return {
        success: false,
        error: `A document named "${title}" already exists in this folder. Please choose a different title.`
      }
    }

    // Create prompt in database
    const prompt = await db.prompt.create({
      data: {
        user_id: user.id,
        folder_id: parsed.data.folderId,
        title: title,
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

/**
 * Rename a prompt
 *
 * @param promptId - UUID of the prompt to rename
 * @param newTitle - New title for the prompt
 * @returns ActionResult with success status
 */
export async function renamePrompt(promptId: string, newTitle: string): Promise<ActionResult> {
  try {
    // Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Check for duplicate title in the same folder
    const existingPrompt = await db.prompt.findFirst({
      where: {
        id: promptId,
        user_id: user.id
      },
      select: {
        folder_id: true
      }
    })

    if (!existingPrompt) {
      return { success: false, error: "Prompt not found" }
    }

    const duplicate = await db.prompt.findFirst({
      where: {
        folder_id: existingPrompt.folder_id,
        user_id: user.id,
        title: {
          equals: newTitle,
          mode: 'insensitive'
        },
        NOT: {
          id: promptId
        }
      }
    })

    if (duplicate) {
      return {
        success: false,
        error: `A document named "${newTitle}" already exists in this folder.`
      }
    }

    // Update prompt title
    await db.prompt.update({
      where: {
        id: promptId
      },
      data: {
        title: newTitle,
        updated_at: new Date()
      }
    })

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("renamePrompt error:", error)
    return { success: false, error: "Failed to rename prompt" }
  }
}

/**
 * Delete a prompt and all its versions
 *
 * @param promptId - UUID of the prompt to delete
 * @returns ActionResult with success status
 */
export async function deletePrompt(promptId: string): Promise<ActionResult> {
  try {
    // Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Verify ownership and delete with cascade
    const result = await db.prompt.deleteMany({
      where: {
        id: promptId,
        user_id: user.id
      }
    })

    if (result.count === 0) {
      return { success: false, error: "Prompt not found or access denied" }
    }

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("deletePrompt error:", error)
    return { success: false, error: "Failed to delete prompt" }
  }
}
