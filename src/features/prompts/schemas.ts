/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/schemas.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 13:39 GMT+10
Last modified: 08/11/2025 17:26 GMT+10
---------------
Zod validation schemas for prompt operations.
Provides type-safe input validation for server actions.

Changelog:
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
