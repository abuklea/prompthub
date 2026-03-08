"use server"

import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import {
  assignPromptTagsSchema,
  createPromptSchema,
  createTagSchema,
  getPromptDetailsSchema,
  getPromptVersionHistorySchema,
  listTagsSchema,
  restorePromptVersionSchema,
  searchPromptsSchema,
} from "./schemas"
import { ActionResult } from "@/types/actions"
import { PromptListItem, PromptVersionHistoryItem } from "./types"
import { ensureProfileExists } from "@/lib/ensure-profile"

export async function getPromptsByFolder(folderId: string, filters?: { query?: string; tagIds?: string[] }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("User not found")
  }

  const safeQuery = filters?.query?.trim()
  const safeTagIds = filters?.tagIds?.filter(Boolean) ?? []

  if (safeQuery) {
    return searchPrompts({ folderId, query: safeQuery, tagIds: safeTagIds })
  }

  return await db.prompt.findMany({
    where: {
      user_id: user.id,
      folder_id: folderId,
      ...(safeTagIds.length > 0
        ? {
            tags: {
              some: {
                id: {
                  in: safeTagIds,
                },
              },
            },
          }
        : {}),
    },
    include: {
      tags: {
        select: {
          id: true,
          name: true,
        },
      },
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
export async function createPrompt(data: unknown): Promise<ActionResult<PromptListItem>> {
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

    await ensureProfileExists(user.id)

    // Reason: Set title to null for new documents or validate if title provided
    const title = parsed.data.title || null

    // Reason: Check for duplicate custom title only if title is provided (case-insensitive)
    if (title) {
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
    }

    // Create prompt in database with null title for new documents
    const prompt = await db.prompt.create({
      data: {
        user_id: user.id,
        folder_id: parsed.data.folderId,
        title: title,
        content: "",
      }
    })

    // Reason: Return full Prompt object for optimistic updates (P5S5T4 - Performance optimization)
    // This eliminates 2 additional database requests (getPromptsByFolder + getPromptDetails)
    return { success: true, data: { ...prompt, tags: [] } }
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

    return { success: true, data: { ...prompt, tags: [] } }
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

/**
 * Validate multiple promptIds exist in database
 *
 * Used for cleaning orphaned tabs after logout/login.
 * Returns list of valid promptIds that exist for current user.
 *
 * @param promptIds - Array of prompt UUIDs to validate
 * @returns ActionResult with array of valid promptIds
 */
export async function validatePrompts(promptIds: string[]): Promise<ActionResult<{ validIds: string[] }>> {
  try {
    // Get authenticated user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." }
    }

    // Reason: Batch query all promptIds with user_id filter
    const prompts = await db.prompt.findMany({
      where: {
        id: { in: promptIds },
        user_id: user.id
      },
      select: {
        id: true
      }
    })

    const validIds = prompts.map(p => p.id)

    return { success: true, data: { validIds } }
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("validatePrompts error:", error)
    return { success: false, error: "Failed to validate prompts" }
  }
}


export async function searchPrompts(data: unknown) {
  const parsed = searchPromptsSchema.safeParse(data)
  if (!parsed.success) {
    return []
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  const { query, folderId, tagIds } = parsed.data
  const tsQuery = query
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, "").trim())
    .filter(Boolean)
    .join(" & ")

  if (!tsQuery) {
    return []
  }

  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id
    FROM "Prompt" p
    WHERE p.user_id = ${user.id}
      AND (${folderId ?? null}::text IS NULL OR p.folder_id = ${folderId ?? null})
      AND to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.content, '')) @@ to_tsquery('english', ${tsQuery})
      AND (
        array_length(${tagIds}::text[], 1) IS NULL
        OR EXISTS (
          SELECT 1
          FROM "_PromptToTag" pt
          JOIN "Tag" t ON t.id = pt."B"
          WHERE pt."A" = p.id
            AND t.user_id = ${user.id}
            AND pt."B" = ANY(${tagIds}::text[])
        )
      )
    ORDER BY p.updated_at DESC
    LIMIT 100
  `

  if (rows.length === 0) {
    return []
  }

  const prompts = await db.prompt.findMany({
    where: {
      id: {
        in: rows.map((row) => row.id),
      },
      user_id: user.id,
    },
    include: {
      tags: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const order = new Map(rows.map((row, index) => [row.id, index]))
  return prompts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
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

    const tag = await db.tag.create({
      data: {
        user_id: user.id,
        name: parsed.data.name,
      },
      select: { id: true, name: true },
    })

    return { success: true, data: tag }
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

    const versions = await db.promptVersion.findMany({
      where: { prompt_id: parsed.data.promptId },
      select: {
        id: true,
        created_at: true,
        title_snapshot: true,
        content_snapshot: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    })

    return { success: true, data: versions }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error('getPromptVersionHistory error:', error)
    return { success: false, error: 'Failed to fetch prompt history' }
  }
}

export async function restorePromptVersion(data: unknown): Promise<ActionResult<void>> {
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

    const prompt = await db.prompt.findFirst({
      where: {
        id: parsed.data.promptId,
        user_id: user.id,
      },
      select: { id: true, title: true, content: true },
    })

    if (!prompt) {
      return { success: false, error: 'Prompt not found or access denied' }
    }

    const version = await db.promptVersion.findFirst({
      where: {
        id: parsed.data.versionId,
        prompt_id: parsed.data.promptId,
      },
      select: {
        title_snapshot: true,
        content_snapshot: true,
      },
    })

    if (!version) {
      return { success: false, error: 'Version not found' }
    }

    await db.$transaction(async (tx) => {
      await tx.promptVersion.create({
        data: {
          prompt_id: parsed.data.promptId,
          diff: '',
          title_snapshot: prompt.title,
          content_snapshot: prompt.content,
        },
      })

      await tx.prompt.update({
        where: { id: parsed.data.promptId },
        data: {
          title: version.title_snapshot,
          content: version.content_snapshot,
          updated_at: new Date(),
        },
      })
    })

    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error('restorePromptVersion error:', error)
    return { success: false, error: 'Failed to restore prompt version' }
  }
}
