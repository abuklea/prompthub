/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/tag-actions.ts
MIME: text/typescript
Type: TypeScript

Created: 29/10/2026 21:12 GMT+10
Last modified: 29/10/2026 21:12 GMT+10
---------------
Server actions for tags: listing the user's tags, creating a tag and assigning tags to a prompt. Each is a one-line
wrapper over its handler in ./tag-handlers, which parses, authenticates, rate-limits and scopes every query by the
user's id; the wrapper passes the real dependencies from @/lib/action-runtime. Split from ./actions (issue #51).

Changelog:
29/10/2026 21:12 GMT+10 | Created: getTags, createTag and assignTagsToPrompt moved from ./actions as wrappers over
                         ./tag-handlers; getTags returns an ActionResult (P7S2T7, issues #41 and #51)
*/

"use server"

import type { Tag } from "@prisma/client"
import { actionDeps } from "@/lib/action-runtime"
import type { ActionResult } from "@/types/actions"
import * as handlers from "./tag-handlers"

/**
 * List the user's tags by name. See `getTags` in ./tag-handlers for the checks and results.
 *
 * @param data - Object containing an optional folderId, which keeps only the tags on that folder's prompts
 * @returns ActionResult with the tags (an empty list for a folder that is not the user's), or an error message
 */
// Reason: the default keeps a call without an argument listing every tag, as it did before the split.
export async function getTags(data: unknown = {}): Promise<ActionResult<Tag[]>> {
  return handlers.getTags(actionDeps, data)
}

/**
 * Create a tag, or return the user's existing tag of that name in any case. See `createTag` in ./tag-handlers.
 *
 * @param data - Object containing name (trimmed; 1 to 50 characters)
 * @returns ActionResult with the tag's id and name, or an error message
 */
export async function createTag(data: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  return handlers.createTag(actionDeps, data)
}

/**
 * Replace the tags of one of the user's prompts. See `assignTagsToPrompt` in ./tag-handlers.
 *
 * @param data - Object containing promptId and tagIds (at most 20 of the user's tag ids; an empty list clears)
 * @returns ActionResult with no data on success, or an error message
 */
export async function assignTagsToPrompt(data: unknown): Promise<ActionResult<void>> {
  return handlers.assignTagsToPrompt(actionDeps, data)
}
