/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 25/02/2026 16:11 GMT+10
Last modified: 29/10/2026 20:50 GMT+10
---------------
Server action that loads the signed-in user's workspace snapshot for the client cache. A one-line wrapper over its
handler in ./handlers; the wrapper passes the real dependencies from @/lib/action-runtime.

Changelog:
29/10/2026 20:50 GMT+10 | P7S2T8: a wrapper over ./handlers that returns ActionResult instead of throwing; header added
25/02/2026 16:11 GMT+10 | Created (commit b8fb4db)
*/

"use server"

import { actionDeps } from "@/lib/action-runtime"
import * as handlers from "./handlers"

/**
 * Read the signed-in user's folders and prompt listings. See `getWorkspaceSnapshot` in ./handlers.
 *
 * @returns ActionResult with `{ userId, folders, prompts, loadedAt }` on success; a fixed error message on any failure
 */
export async function getWorkspaceSnapshot() {
  return handlers.getWorkspaceSnapshot(actionDeps, undefined)
}
