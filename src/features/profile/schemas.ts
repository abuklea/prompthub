/*
Project: PromptHub
Author: Allan James
Source: src/features/profile/schemas.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:49 GMT+10
Last modified: 29/10/2026 20:49 GMT+10
---------------
Zod schemas for the profile actions. The display name is trimmed before it is bounded (in Zod 3 a bound placed before
.trim() checks the untrimmed text) and capped at 100 characters; an empty name is allowed and stored as null.

Changelog:
29/10/2026 20:49 GMT+10 | Created with updateDisplayNameSchema (P7S2T8)
*/
import { z } from "zod"

/** The input of updateDisplayName: the new name, trimmed, at most 100 characters; empty clears it. */
export const updateDisplayNameSchema = z.object({
  displayName: z.string().trim().max(100, "Display name is too long"),
})

/** What a caller passes to updateDisplayName. */
export type UpdateDisplayNameInput = z.input<typeof updateDisplayNameSchema>
