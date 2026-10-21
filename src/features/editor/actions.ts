/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 14:30 GMT+10
Last modified: 22/10/2026 08:40 GMT+10
---------------
Server actions for prompt editor operations: saving a version and autosaving.
Each action validates its input, authenticates the user and delegates to ./service, which holds the database logic.

Changelog:
22/10/2026 08:40 GMT+10 | P7S1T2: the save and autosave logic moved to ./service; the actions keep their shells
17/07/2026 10:00 GMT+10 | F10: Removed dead diff computation; snapshots are now the sole version-storage model
07/11/2025 16:15 GMT+10 | Added autoSavePrompt action (P5S3bT13)
07/11/2025 14:30 GMT+10 | Initial creation with saveNewVersion action
*/

"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { saveNewVersionSchema, autoSaveSchema } from "./schemas"
import { ActionResult } from "@/types/actions"
import { titleValidationSchema } from "@/features/prompts/schemas"
import { checkMutationRateLimit } from "@/lib/rate-limit"
import { autoSaveDocument, saveVersion } from "./service"

/**
 * Save a prompt and record a version.
 *
 * Validates the input and the title, authenticates the user, applies the mutation rate limit, then calls
 * `saveVersion`, which writes the prompt and its version history in one transaction scoped to the user.
 *
 * @param data - Object containing promptId, newTitle, and newContent
 * @returns ActionResult with the versionId on success; a generic error message on any failure
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

    // Step 2: Validate title before saving
    // Reason: Prevent saving with empty or placeholder titles
    const titleResult = titleValidationSchema.safeParse(parsed.data.newTitle)
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

    const { allowed } = checkMutationRateLimit(user.id)
    if (!allowed) {
      return { success: false, error: "Too many requests. Please slow down." }
    }

    // Step 4: Save, scoped to the authenticated user
    return await saveVersion(db, user.id, parsed.data)
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
 * Updates the prompt title, content, and updated_at timestamp only, through `autoSaveDocument`.
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

    // Step 2: Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Step 3: Update the prompt, scoped to the authenticated user (no version creation)
    return await autoSaveDocument(db, user.id, parsed.data)
  } catch (error) {
    // Reason: NEXT_REDIRECT must be re-thrown for Next.js navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("autoSavePrompt error:", error)
    return { success: false, error: "Failed to auto-save" }
  }
}
