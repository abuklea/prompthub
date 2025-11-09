/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 14:30 GMT+10
Last modified: 07/11/2025 16:15 GMT+10
---------------
Server actions for prompt editor operations.
Handles version saving with Git-style diff generation, atomic transactions, and auto-save.

Changelog:
07/11/2025 16:15 GMT+10 | Added autoSavePrompt action (P5S3bT13)
07/11/2025 14:30 GMT+10 | Initial creation with saveNewVersion action
*/

"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { saveNewVersionSchema, autoSaveSchema } from "./schemas"
import { ActionResult } from "@/types/actions"
import { createPatch } from "@/lib/diff-utils"
import { titleValidationSchema } from "@/features/prompts/schemas"

/**
 * Save a new version of a prompt with Git-style diff
 *
 * Creates a PromptVersion record with the diff between current and new content,
 * then updates the Prompt record with new title and content. Both operations
 * are wrapped in a transaction for atomicity.
 *
 * @param data - Object containing promptId, newTitle, and newContent
 * @returns ActionResult with versionId on success, error message on failure
 */
export async function saveNewVersion(
  data: unknown
): Promise<ActionResult<{ versionId: number }>> {
  try {
    // Step 1: Validate input
    const parsed = saveNewVersionSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: "Invalid input data" }
    }

    const { promptId, newTitle, newContent } = parsed.data

    // Step 2: Validate title before saving
    // Reason: Prevent saving with empty or placeholder titles
    const titleResult = titleValidationSchema.safeParse(newTitle)
    if (!titleResult.success) {
      return {
        success: false,
        error: "Please provide a valid title for your document"
      }
    }

    // Step 3: Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Step 4: Fetch current prompt with user isolation
    // Reason: MUST filter by both id AND user_id to enforce ownership
    const currentPrompt = await db.prompt.findFirst({
      where: {
        id: promptId,
        user_id: user.id, // Enforce user isolation
      },
    })

    if (!currentPrompt) {
      return { success: false, error: "Prompt not found or access denied" }
    }

    // Step 5: Calculate patch using diff-utils
    const diff = createPatch(currentPrompt.content, newContent)

    // Step 6: Execute transaction (atomic operation)
    // Reason: Both version creation and prompt update must succeed or both fail
    const result = await db.$transaction(async (tx) => {
      // Create new version with diff
      const promptVersion = await tx.promptVersion.create({
        data: {
          prompt_id: promptId,
          diff: diff, // Git-style patch from diff-match-patch
        },
      })

      // Update prompt with new content
      await tx.prompt.update({
        where: { id: promptId },
        data: {
          title: newTitle,
          content: newContent,
          updated_at: new Date(),
        },
      })

      return promptVersion
    })

    // Step 7: Return success with versionId
    return { success: true, data: { versionId: result.id } }
  } catch (error) {
    // Reason: NEXT_REDIRECT must be re-thrown for Next.js navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("saveNewVersion error:", error)
    return { success: false, error: "Failed to save version" }
  }
}

/**
 * Auto-save prompt title and content without creating a version
 *
 * Updates the prompt title, content, and updated_at timestamp only.
 * Does NOT create a PromptVersion record (silent background save).
 * Used for debounced auto-save while editing.
 *
 * @param data - Object containing promptId, title, and content
 * @returns ActionResult with success status
 */
export async function autoSavePrompt(
  data: unknown
): Promise<ActionResult<void>> {
  try {
    // Step 1: Validate input
    const parsed = autoSaveSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: "Invalid input data" }
    }

    const { promptId, title, content } = parsed.data

    // Step 2: Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Step 3: Update prompt title and content (no version creation)
    // Reason: MUST filter by both id AND user_id to enforce ownership
    const result = await db.prompt.updateMany({
      where: {
        id: promptId,
        user_id: user.id, // Enforce user isolation (RLS)
      },
      data: {
        title: title,
        content: content,
        updated_at: new Date(),
      },
    })

    // Step 4: Check if prompt was found and updated
    if (result.count === 0) {
      return { success: false, error: "Prompt not found or access denied" }
    }

    // Step 5: Return success
    return { success: true, data: undefined }
  } catch (error) {
    // Reason: NEXT_REDIRECT must be re-thrown for Next.js navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("autoSavePrompt error:", error)
    return { success: false, error: "Failed to auto-save" }
  }
}
