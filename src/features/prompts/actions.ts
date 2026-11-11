/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 06/11/2025 14:33 GMT+10
Last modified: 29/10/2026 21:12 GMT+10
---------------
Server actions for prompts. Listing by folder (with the full-text search when a query is given), creating, reading,
renaming, deleting and validating prompts are one-line wrappers over ./handlers, which parse, authenticate,
rate-limit and scope every query by the user's id. The tag actions are in ./tag-actions and the version-history
actions in ./history-actions.

Changelog:
29/10/2026 21:12 GMT+10 | P7S2T7: getTags, createTag and assignTagsToPrompt moved to ./tag-actions, and
                         getPromptVersionHistory and restorePromptVersion to ./history-actions (issue #51)
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
import { actionDeps } from "@/lib/action-runtime"
import type {
  deletePromptSchema,
  getPromptsByFolderSchema,
  renamePromptSchema,
  validatePromptsSchema,
} from "./schemas"
import { ActionResult } from "@/types/actions"
import { PromptListItem } from "./types"
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
