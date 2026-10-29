/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/schemas.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 13:39 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
Zod validation schemas for prompt operations.
Provides type-safe input validation for server actions.

Changelog:
29/10/2026 20:45 GMT+10 | Added renamePromptSchema, deletePromptSchema, validatePromptsSchema and
                         getPromptsByFolderSchema (P7S2T6, issue #114)
07/11/2025 13:39 GMT+10 | Initial creation with createPrompt and getPromptDetails schemas
08/11/2025 17:26 GMT+10 | Added title validation helpers (isPlaceholderTitle, titleValidationSchema)
*/

import { z } from 'zod'

export const createPromptSchema = z.object({
  folderId: z.string().uuid('Invalid folder ID'),
  title: z.string().min(1, 'Title required').max(200, 'Title too long').optional(),
})

export type CreatePromptInput = z.infer<typeof createPromptSchema>

export const getPromptDetailsSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
})

export type GetPromptDetailsInput = z.infer<typeof getPromptDetailsSchema>

/**
 * Helper function to detect placeholder title patterns.
 * Matches "[Untitled Doc]", "[Untitled Doc 2]", etc. (case-insensitive)
 */
export function isPlaceholderTitle(title: string): boolean {
  const placeholderPattern = /^\[Untitled Doc( \d+)?\]$/i
  return placeholderPattern.test(title.trim())
}

/**
 * Validation schema for document titles.
 * Rejects empty strings and placeholder patterns.
 */
export const titleValidationSchema = z.string()
  .min(1, 'Title cannot be empty')
  .refine(
    (val) => !isPlaceholderTitle(val),
    'Please provide a custom title for your document'
  )

export type ValidTitle = z.infer<typeof titleValidationSchema>

const promptId = z.string().uuid('Invalid prompt ID')

/** Input of renamePrompt: the title is trimmed, then bounded, and may not be a placeholder title. */
export const renamePromptSchema = z.object({
  promptId,
  newTitle: z.string().trim().min(1, 'Title required').max(200, 'Title too long')
    .refine((value) => !isPlaceholderTitle(value), 'Please provide a custom title for your document'),
})

/** Input of deletePrompt. */
export const deletePromptSchema = z.object({ promptId })

/** Input of validatePrompts: at most 200 ids. */
// Reason: not .uuid(): a stale persisted tab may hold any string, and one failing element would fail the whole
// batch and leave every orphaned tab open. The ids only feed a parameterised `in` list.
export const validatePromptsSchema = z.object({ promptIds: z.array(z.string().min(1).max(64)).max(200) })

/** Input of getPromptsByFolder: a non-blank query switches the listing to the full-text search. */
export const getPromptsByFolderSchema = z.object({
  folderId: z.string().uuid('Invalid folder ID'),
  query: z.string().trim().max(200).optional(),
  tagIds: z.array(z.string().uuid('Invalid tag ID')).max(20).optional().default([]),
})


export const searchPromptsSchema = z.object({
  folderId: z.string().uuid('Invalid folder ID').optional(),
  query: z.string().trim().min(1, 'Query required').max(200, 'Query too long'),
  tagIds: z.array(z.string().uuid('Invalid tag ID')).max(20).optional().default([]),
})

export const listTagsSchema = z.object({
  folderId: z.string().uuid('Invalid folder ID').optional(),
})

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50, 'Tag name too long'),
})

export const assignPromptTagsSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
  tagIds: z.array(z.string().uuid('Invalid tag ID')).max(20),
})

export const getPromptVersionHistorySchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
})

export const restorePromptVersionSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
  versionId: z.number().int().positive('Invalid version ID'),
})
