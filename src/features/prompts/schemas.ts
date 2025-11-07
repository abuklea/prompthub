/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/schemas.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 13:39 GMT+10
Last modified: 07/11/2025 13:39 GMT+10
---------------
Zod validation schemas for prompt operations.
Provides type-safe input validation for server actions.

Changelog:
07/11/2025 13:39 GMT+10 | Initial creation with createPrompt and getPromptDetails schemas
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
