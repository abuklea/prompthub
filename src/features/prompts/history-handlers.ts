/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/history-handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:08 GMT+10
Last modified: 29/10/2026 21:11 GMT+10
---------------
The bodies of the version-history actions (getPromptVersionHistory, restorePromptVersion), run through runAction: parse,
authenticate, rate-limit (restores share the save limit with saveNewVersion; reading the history has none), then
delegate to listVersions and restoreVersion of @/features/editor/service, which scope every query to the authenticated
user. The "use server" wrappers in ./history-actions pass the real dependencies.

A plain module: no "use server" directive (every export of such a file is a public endpoint) and no Next.js, Supabase
or @/lib/db import. `server-only` makes a Client Component import of this module a build error.

Changelog:
29/10/2026 21:11 GMT+10 | Moved from ./actions under runAction specs; restorePromptVersion uses the save limit
                         (P7S2T7, decision D4)
29/10/2026 21:08 GMT+10 | Stub created (P7S2T7, red phase)
*/
import "server-only"
import { runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import { listVersions, restoreVersion } from "@/features/editor/service"
import type { ActionResult } from "@/types/actions"
import { getPromptVersionHistorySchema, restorePromptVersionSchema } from "./schemas"
import type { PromptVersionHistoryItem } from "./types"

/**
 * List the version history of one of the user's prompts.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptId }`.
 * @returns Up to 50 versions, newest first; "Prompt not found or access denied" for a missing prompt and a prompt of
 *   another user alike; "Invalid prompt ID", the runner's unauthorised text, or "Failed to fetch prompt history" on any
 *   other error.
 */
export async function getPromptVersionHistory(
  deps: ActionDeps,
  data: unknown,
): Promise<ActionResult<PromptVersionHistoryItem[]>> {
  return runAction(deps, {
    name: "getPromptVersionHistory",
    schema: getPromptVersionHistorySchema,
    invalid: "Invalid prompt ID",
    failure: "Failed to fetch prompt history",
    limit: "none",
    run: ({ db, user, input }) => listVersions(db, user.id, input),
  }, data)
}

/**
 * Restore one of the user's prompts to the state a version holds; `restoreVersion` writes the prompt and its history in
 * one transaction scoped to the user.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptId, versionId }`.
 * @returns The restored title and content; "Prompt not found or access denied" for a missing prompt and a prompt of
 *   another user alike; "Version not found" for a version of another prompt; "Invalid restore request", the runner's
 *   unauthorised and rate-limit texts, or "Failed to restore prompt version" on any other error.
 */
export async function restorePromptVersion(
  deps: ActionDeps,
  data: unknown,
): Promise<ActionResult<{ title: string | null; content: string }>> {
  return runAction(deps, {
    name: "restorePromptVersion",
    schema: restorePromptVersionSchema,
    invalid: "Invalid restore request",
    failure: "Failed to restore prompt version",
    limit: "save",
    run: ({ db, user, input }) => restoreVersion(db, user.id, input),
  }, data)
}
