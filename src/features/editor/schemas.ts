/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/schemas.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 14:15 GMT+10
Last modified: 07/11/2025 16:14 GMT+10
---------------
Zod validation schemas for editor operations.
Provides type-safe input validation for prompt version saving and auto-save.

Changelog:
07/11/2025 16:14 GMT+10 | Added autoSaveSchema for auto-save action (P5S3bT13)
07/11/2025 14:15 GMT+10 | Initial creation with saveNewVersion schema
*/

import { z } from 'zod'

export const saveNewVersionSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
  newTitle: z.string().min(1, 'Title required').max(200, 'Title too long'),
  newContent: z.string(),
})

export type SaveNewVersionInput = z.infer<typeof saveNewVersionSchema>

export const autoSaveSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
  title: z.string().max(200, 'Title too long').nullable(),
  content: z.string(),
})

export type AutoSaveInput = z.infer<typeof autoSaveSchema>
