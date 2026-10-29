/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/history-actions.ts
MIME: text/typescript
Type: TypeScript

Created: 29/10/2026 21:12 GMT+10
Last modified: 29/10/2026 21:12 GMT+10
---------------
Server actions for a prompt's version history: listing the versions and restoring one. Each is a one-line wrapper over
its handler in ./history-handlers, which parses, authenticates, rate-limits and delegates to @/features/editor/service;
the wrapper passes the real dependencies from @/lib/action-runtime. Split from ./actions (issue #51).

Changelog:
29/10/2026 21:12 GMT+10 | Created: getPromptVersionHistory and restorePromptVersion moved from ./actions as wrappers
                         over ./history-handlers; restores use the save limit (P7S2T7, issue #51, decision D4)
*/

"use server"

import { actionDeps } from "@/lib/action-runtime"
import type { ActionResult } from "@/types/actions"
import * as handlers from "./history-handlers"
import type { PromptVersionHistoryItem } from "./types"

/**
 * List the version history of one of the user's prompts. See `getPromptVersionHistory` in ./history-handlers.
 *
 * @param data - Object containing promptId
 * @returns ActionResult with up to 50 versions, newest first, or an error message
 */
export async function getPromptVersionHistory(data: unknown): Promise<ActionResult<PromptVersionHistoryItem[]>> {
  return handlers.getPromptVersionHistory(actionDeps, data)
}

/**
 * Restore one of the user's prompts to the state a version holds. See `restorePromptVersion` in ./history-handlers.
 *
 * @param data - Object containing promptId and versionId
 * @returns ActionResult with the restored title and content, or an error message
 */
export async function restorePromptVersion(
  data: unknown,
): Promise<ActionResult<{ title: string | null; content: string }>> {
  return handlers.restorePromptVersion(actionDeps, data)
}
