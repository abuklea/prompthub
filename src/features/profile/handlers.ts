/*
Project: PromptHub
Author: Allan James
Source: src/features/profile/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 21:03 GMT+10
---------------
The bodies of the profile's server actions, getProfileDetails and updateDisplayName, run through runAction. Both create
the caller's profile first when it is missing, and both read or write only the profile whose id is the caller's: the
input carries no id. A plain module: no "use server", no Next.js import; the wrappers in ./actions pass the real
dependencies.

Changelog:
29/10/2026 21:03 GMT+10 | getProfileDetails uses the shared noInputSchema (P7S2T8)
29/10/2026 20:49 GMT+10 | Implemented: runAction with ensureProfile; updateDisplayName parses { displayName } and is
                         limited as a mutation (P7S2T8, decisions Q3 and Q4)
29/10/2026 20:45 GMT+10 | Stub created (P7S2T8, red phase)
*/
import "server-only"
import { noInputSchema, runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import type { ActionResult } from "@/types/actions"
import { updateDisplayNameSchema } from "./schemas"

/** The account page's view of the signed-in user. */
export interface ProfileDetails {
  /** The user's id, which is also the Profile id. */
  id: string
  /** The user's email from Supabase Auth, or "" when it has none. */
  email: string
  /** The stored display name, or "" when none is set. */
  displayName: string
  /** When the profile row was created. */
  createdAt: Date
}

/**
 * Read the caller's profile details, creating the profile first when it is missing.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Must be undefined: the action takes no input.
 * @returns The caller's id, email, display name and profile creation time; "Invalid input data"; the unauthorised
 *   text; "Failed to load profile" on an unexpected error.
 */
export async function getProfileDetails(deps: ActionDeps, data: unknown): Promise<ActionResult<ProfileDetails>> {
  return runAction(
    deps,
    {
      name: "getProfileDetails",
      schema: noInputSchema,
      invalid: "Invalid input data",
      failure: "Failed to load profile",
      limit: "none",
      ensureProfile: true,
      run: async ({ db, user }) => {
        // Reason: ensureProfile has just created the row, so a missing one (deleted in between) is an unexpected error.
        const profile = await db.profile.findUniqueOrThrow({
          where: { id: user.id },
          select: { display_name: true, created_at: true },
        })
        return {
          success: true,
          data: {
            id: user.id,
            email: user.email ?? "",
            displayName: profile.display_name ?? "",
            createdAt: profile.created_at,
          },
        }
      },
    },
    data,
  )
}

/**
 * Set the caller's display name, creating the profile first when it is missing. A blank name clears it (stored null).
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted input: `{ displayName }`, at most 100 characters after trimming.
 * @returns The stored name ("" when cleared); "Invalid display name"; the unauthorised or rate-limit text; "Failed to
 *   update profile" on an unexpected error.
 */
export async function updateDisplayName(
  deps: ActionDeps,
  data: unknown,
): Promise<ActionResult<{ displayName: string }>> {
  return runAction(
    deps,
    {
      name: "updateDisplayName",
      schema: updateDisplayNameSchema,
      invalid: "Invalid display name",
      failure: "Failed to update profile",
      limit: "mutation",
      ensureProfile: true,
      run: async ({ db, user, input }) => {
        // Reason: Profile.id is the user's id, so this unique where is the tenant scope.
        const updated = await db.profile.update({
          where: { id: user.id },
          data: { display_name: input.displayName || null },
          select: { display_name: true },
        })
        return { success: true, data: { displayName: updated.display_name ?? "" } }
      },
    },
    data,
  )
}
