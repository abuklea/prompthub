/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 21:03 GMT+10
---------------
The body of the getWorkspaceSnapshot server action, run through runAction: every folder and every prompt listing (no
content) of the caller, scoped by user_id, for the client's workspace cache. A plain module: no "use server", no
Next.js import; the wrapper in ./actions passes the real dependencies.

Changelog:
29/10/2026 21:03 GMT+10 | getWorkspaceSnapshot uses the shared noInputSchema (P7S2T8)
29/10/2026 20:49 GMT+10 | Implemented: the existing queries moved unchanged behind runAction (P7S2T8, decisions Q3 and
                         Q4)
29/10/2026 20:45 GMT+10 | Stub created (P7S2T8, red phase)
*/
import "server-only"
import type { PrismaClient } from "@prisma/client"
import { noInputSchema, runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import type { ActionResult } from "@/types/actions"

/**
 * Read every folder and prompt listing of one user.
 *
 * @param db - The database client.
 * @param userId - The authenticated user; both queries are scoped to it.
 * @returns The user's id, folders by parent then name, prompt listings newest first with their folder, and the load
 *   time as an ISO string.
 */
async function loadSnapshot(db: PrismaClient, userId: string) {
  const [folders, prompts] = await Promise.all([
    db.folder.findMany({
      where: { user_id: userId },
      orderBy: [{ parent_id: "asc" }, { name: "asc" }],
    }),
    db.prompt.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
        user_id: true,
        folder_id: true,
        folder: { select: { id: true, name: true } },
      },
      orderBy: { updated_at: "desc" },
    }),
  ])
  return { userId, folders, prompts, loadedAt: new Date().toISOString() }
}

/** What getWorkspaceSnapshot returns on success. */
export type WorkspaceSnapshot = Awaited<ReturnType<typeof loadSnapshot>>

/**
 * Read the caller's whole workspace: every folder and every prompt listing, without prompt content.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Must be undefined: the action takes no input.
 * @returns The snapshot; "Invalid input data"; the unauthorised text; "Failed to load workspace" on an unexpected
 *   error.
 */
export async function getWorkspaceSnapshot(deps: ActionDeps, data: unknown): Promise<ActionResult<WorkspaceSnapshot>> {
  return runAction(
    deps,
    {
      name: "getWorkspaceSnapshot",
      schema: noInputSchema,
      invalid: "Invalid input data",
      failure: "Failed to load workspace",
      limit: "none",
      run: async ({ db, user }) => ({ success: true, data: await loadSnapshot(db, user.id) }),
    },
    data,
  )
}
