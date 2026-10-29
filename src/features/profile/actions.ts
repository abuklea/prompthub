/*
Project: PromptHub
Author: Allan James
Source: src/features/profile/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 25/02/2026 16:11 GMT+10
Last modified: 29/10/2026 20:50 GMT+10
---------------
Server actions for the account page: reading the user's profile details and updating the display name, each creating
the profile first when it is missing. Each action is a one-line wrapper over its handler in ./handlers; the wrapper
passes the real dependencies from @/lib/action-runtime.

Changelog:
29/10/2026 20:50 GMT+10 | P7S2T8: both actions are wrappers over ./handlers and return ActionResult instead of throwing;
                         updateDisplayName takes { displayName }, capped at 100 characters, and is rate-limited
29/10/2026 20:05 GMT+10 | P7S2T1: passes the database client to ensureProfileExists; header added
25/02/2026 16:11 GMT+10 | Created (commit b8fb4db)
*/

"use server"

import { actionDeps } from "@/lib/action-runtime"
import * as handlers from "./handlers"
import type { UpdateDisplayNameInput } from "./schemas"

/**
 * Read the signed-in user's profile details. See `getProfileDetails` in ./handlers.
 *
 * @returns ActionResult with `{ id, email, displayName, createdAt }` on success; a fixed error message on any failure
 */
export async function getProfileDetails() {
  return handlers.getProfileDetails(actionDeps, undefined)
}

/**
 * Set the signed-in user's display name; a blank name clears it. See `updateDisplayName` in ./handlers.
 *
 * @param data - `{ displayName }`, at most 100 characters after trimming
 * @returns ActionResult with the stored `{ displayName }` on success; a fixed error message on any failure
 */
export async function updateDisplayName(data: UpdateDisplayNameInput) {
  return handlers.updateDisplayName(actionDeps, data)
}
