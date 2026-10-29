/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 06/11/2025 14:33 GMT+10
Last modified: 29/10/2026 20:48 GMT+10
---------------
Server actions for prompts. Listing by folder (with the full-text search when a query is given), creating, reading,
renaming, deleting and validating prompts are one-line wrappers over ./handlers, which parse, authenticate,
rate-limit and scope every query by the user's id. Listing, creating and assigning tags, and reading and restoring the
version history (which delegate to @/features/editor/service), keep their bodies here.

Changelog:
29/10/2026 20:48 GMT+10 | P7S2T6: the six CRUD and listing actions are wrappers over ./handlers and take object
                         arguments; getPromptsByFolder returns an ActionResult; searchPrompts moved to
                         ./search-handlers and is no longer an action; eslint-disable max-lines removed (issue #114)
29/10/2026 20:04 GMT+10 | P7S2T1: createPrompt passes the database client to ensureProfileExists
22/10/2026 08:59 GMT+10 | P7S1T3: header description tightened
22/10/2026 08:52 GMT+10 | P7S1T3: restorePromptVersion returns the restored { title, content }; the restore write is
                         scoped to the user (issue #41)
22/10/2026 08:50 GMT+10 | P7S1T3: getPromptVersionHistory and restorePromptVersion delegate to listVersions and
                         restoreVersion in @/features/editor/service; the actions keep their shells; header added
*/

"use server"

import type { z } from "zod"
import db from "@/lib/db"
import { actionDeps } from "@/lib/action-runtime"
import { createClient } from "@/lib/supabase/server"
import {
  assignPromptTagsSchema,
  createTagSchema,
  getPromptVersionHistorySchema,
  listTagsSchema,
  restorePromptVersionSchema,
} from "./schemas"
import type {
  deletePromptSchema,
  getPromptsByFolderSchema,
  renamePromptSchema,
  validatePromptsSchema,
} from "./schemas"
import { ActionResult } from "@/types/actions"
import { PromptListItem, PromptVersionHistoryItem } from "./types"
import { listVersions, restoreVersion } from "@/features/editor/service"
import * as handlers from "./handlers"

/**
 * List the prompts of one of the user's folders, or search them when `query` is non-blank.
 *
 * @param data - Object containing folderId, an optional query and optional tagIds
 * @returns ActionResult with the prompts and their tags (an empty list for a folder that is not the user's), or an
 *   error message
 */
export async function getPromptsByFolder(
  data: z.input<typeof getPromptsByFolderSchema>,
): Promise<ActionResult<PromptListItem[]>> {
  return handlers.getPromptsByFolder(actionDeps, data)
}

/**
 * Create a new prompt in one of the user's folders
 *
 * @param data - Object containing folderId and optional title
 * @returns ActionResult with the created prompt (with `tags: []`) on success, error message on failure
 */
export async function createPrompt(data: unknown): Promise<ActionResult<PromptListItem>> {
  return handlers.createPrompt(actionDeps, data)
}

/**
 * Get full details of a specific prompt
 *
 * @param data - Object containing promptId
 * @returns ActionResult with the prompt row and its folder, or error message
 */
// Reason: the result stays ActionResult (data: any), as before, so the unchanged callers type-check; the handler's
// own result type is PromptDetails.
export async function getPromptDetails(data: unknown): Promise<ActionResult> {
  return handlers.getPromptDetails(actionDeps, data)
}

/**
 * Rename a prompt
 *
 * @param data - Object containing promptId and newTitle (trimmed; 1 to 200 characters; not a placeholder title)
 * @returns ActionResult with success status
 */
export async function renamePrompt(data: z.input<typeof renamePromptSchema>): Promise<ActionResult<void>> {
  return handlers.renamePrompt(actionDeps, data)
}

/**
 * Delete a prompt and all its versions
 *
 * @param data - Object containing promptId
 * @returns ActionResult with success status
 */
export async function deletePrompt(data: z.input<typeof deletePromptSchema>): Promise<ActionResult<void>> {
  return handlers.deletePrompt(actionDeps, data)
}

/**
 * Validate multiple promptIds exist in database
 *
 * Used for cleaning orphaned tabs after logout/login.
 * Returns list of valid promptIds that exist for current user.
 *
 * @param data - Object containing promptIds, at most 200
 * @returns ActionResult with array of valid promptIds
 */
export async function validatePrompts(
  data: z.input<typeof validatePromptsSchema>,
): Promise<ActionResult<{ validIds: string[] }>> {
  return handlers.validatePrompts(actionDeps, data)
}

export async function getTags(data: unknown = {}) {
  const parsed = listTagsSchema.safeParse(data)
  if (!parsed.success) {
    return []
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  const tags = await db.tag.findMany({
    where: {
      user_id: user.id,
      ...(parsed.data.folderId
        ? {
            prompts: {
              some: {
                folder_id: parsed.data.folderId,
                user_id: user.id,
              },
            },
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })

  return tags
}

export async function createTag(data: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const parsed = createTagSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Invalid input data' }
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const existing = await db.tag.findFirst({
      where: {
        user_id: user.id,
        name: {
          equals: parsed.data.name,
          mode: 'insensitive',
        },
      },
      select: { id: true, name: true },
    })

    if (existing) {
      return { success: true, data: existing }
    }

    try {
      const tag = await db.tag.create({
        data: {
          user_id: user.id,
          name: parsed.data.name,
        },
        select: { id: true, name: true },
      })
      return { success: true, data: tag }
    } catch (createError) {
      // Reason: Handle race condition where a concurrent request
      // created the same tag (case-insensitive match) between our
      // findFirst check and this create call, triggering the
      // Tag_name_user_id_ci_key unique index violation.
      if (
        createError instanceof Error &&
        'code' in createError &&
        (createError as any).code === 'P2002'
      ) {
        const raced = await db.tag.findFirst({
          where: {
            user_id: user.id,
            name: {
              equals: parsed.data.name,
              mode: 'insensitive',
            },
          },
          select: { id: true, name: true },
        })
        if (raced) {
          return { success: true, data: raced }
        }
      }
      throw createError
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error('createTag error:', error)
    return { success: false, error: 'Failed to create tag' }
  }
}

export async function assignTagsToPrompt(data: unknown): Promise<ActionResult<void>> {
  try {
    const parsed = assignPromptTagsSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Invalid input data' }
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const prompt = await db.prompt.findFirst({
      where: {
        id: parsed.data.promptId,
        user_id: user.id,
      },
      select: { id: true },
    })

    if (!prompt) {
      return { success: false, error: 'Prompt not found or access denied' }
    }

    const uniqueTagIds = Array.from(new Set(parsed.data.tagIds))

    if (uniqueTagIds.length > 0) {
      const ownedTags = await db.tag.count({
        where: {
          id: { in: uniqueTagIds },
          user_id: user.id,
        },
      })

      if (ownedTags !== uniqueTagIds.length) {
        return { success: false, error: 'One or more tags are invalid' }
      }
    }

    await db.prompt.update({
      where: { id: parsed.data.promptId },
      data: {
        tags: {
          set: uniqueTagIds.map((tagId) => ({ id: tagId })),
        },
      },
    })

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error('assignTagsToPrompt error:', error)
    return { success: false, error: 'Failed to assign tags' }
  }
}

/**
 * List the version history of one of the user's prompts.
 *
 * Validates the input and authenticates the user (no rate limit), then calls `listVersions`.
 *
 * @param data - Object containing promptId
 * @returns ActionResult with up to 50 versions, newest first; a not-found failure for a prompt that is not the user's;
 *   a generic error message on any other failure
 * @throws The Next.js redirect error, rethrown
 */
export async function getPromptVersionHistory(data: unknown): Promise<ActionResult<PromptVersionHistoryItem[]>> {
  try {
    const parsed = getPromptVersionHistorySchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Invalid prompt ID' }
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    return await listVersions(db, user.id, parsed.data)
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error('getPromptVersionHistory error:', error)
    return { success: false, error: 'Failed to fetch prompt history' }
  }
}

/**
 * Restore one of the user's prompts to the state a version holds.
 *
 * Validates the input and authenticates the user (no rate limit), then calls `restoreVersion`, which writes the
 * prompt and its version history in one transaction scoped to the user.
 *
 * @param data - Object containing promptId and versionId
 * @returns ActionResult with the restored title and content; a not-found failure for a prompt that is not the user's
 *   or a version of another prompt; a generic error message on any other failure
 * @throws The Next.js redirect error, rethrown
 */
export async function restorePromptVersion(
  data: unknown,
): Promise<ActionResult<{ title: string | null; content: string }>> {
  try {
    const parsed = restorePromptVersionSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Invalid restore request' }
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    return await restoreVersion(db, user.id, parsed.data)
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error('restorePromptVersion error:', error)
    return { success: false, error: 'Failed to restore prompt version' }
  }
}
