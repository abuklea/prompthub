/*
Project: PromptHub
Author: Allan James
Source: src/features/dashboard/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:49 GMT+10
---------------
The body of the getDashboardMetrics server action, run through runAction: the caller's prompt, folder and version
counts and five most recently updated prompts, every query scoped by user_id. A plain module: no "use server", no
Next.js import; the wrapper in ./actions passes the real dependencies.

Changelog:
29/10/2026 20:49 GMT+10 | Implemented: the existing queries moved behind runAction; a signed-out caller now gets a
                         failure result instead of zeros (P7S2T8, decisions Q3 and Q4)
29/10/2026 20:45 GMT+10 | Stub created (P7S2T8, red phase); DashboardMetrics moved here from ./actions
*/
import "server-only"
import { z } from "zod"
import { runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import type { ActionResult } from "@/types/actions"

/** The counts and recent prompts the dashboard shows, all scoped to the signed-in user. */
export type DashboardMetrics = {
  totalPrompts: number
  totalFolders: number
  totalVersions: number
  recentlyUpdatedPrompts: Array<{
    id: string
    title: string
    updatedAt: Date
    folderName: string | null
  }>
}

/**
 * Read the caller's dashboard metrics.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Must be undefined: the action takes no input.
 * @returns The metrics; "Invalid input data"; the unauthorised text; "Failed to load dashboard" on an unexpected error.
 */
export async function getDashboardMetrics(deps: ActionDeps, data: unknown): Promise<ActionResult<DashboardMetrics>> {
  return runAction(
    deps,
    {
      name: "getDashboardMetrics",
      schema: z.undefined(),
      invalid: "Invalid input data",
      failure: "Failed to load dashboard",
      limit: "none",
      run: async ({ db, user }) => {
        const [totalPrompts, totalFolders, totalVersions, recent] = await Promise.all([
          db.prompt.count({ where: { user_id: user.id } }),
          db.folder.count({ where: { user_id: user.id } }),
          // Reason: PromptVersion has no user_id; the relation filter scopes it through its prompt's owner.
          db.promptVersion.count({ where: { prompt: { user_id: user.id } } }),
          db.prompt.findMany({
            where: { user_id: user.id },
            orderBy: { updated_at: "desc" },
            take: 5,
            select: { id: true, title: true, updated_at: true, folder: { select: { name: true } } },
          }),
        ])
        return {
          success: true,
          data: {
            totalPrompts,
            totalFolders,
            totalVersions,
            recentlyUpdatedPrompts: recent.map((prompt) => ({
              id: prompt.id,
              title: prompt.title?.trim() || "Untitled prompt",
              updatedAt: prompt.updated_at,
              folderName: prompt.folder?.name || null,
            })),
          },
        }
      },
    },
    data,
  )
}
