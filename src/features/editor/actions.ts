/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 14:30 GMT+10
Last modified: 29/10/2026 20:50 GMT+10
---------------
Server actions for prompt editor operations: saving a version and autosaving.
Each action is a one-line wrapper over its handler in ./handlers, which parses, authenticates, rate-limits and
delegates to ./service; the wrapper passes the real dependencies from @/lib/action-runtime.

Changelog:
29/10/2026 20:50 GMT+10 | P7S2T8: both actions are wrappers over ./handlers; saves use the save limit and autosaves
                         the autosave limit (decision D4); the NEXT_REDIRECT message check is gone (the runner rethrows
                         digest errors)
22/10/2026 08:40 GMT+10 | P7S1T2: the save and autosave logic moved to ./service; the actions keep their shells
17/07/2026 10:00 GMT+10 | F10: Removed dead diff computation; snapshots are now the sole version-storage model
07/11/2025 16:15 GMT+10 | Added autoSavePrompt action (P5S3bT13)
07/11/2025 14:30 GMT+10 | Initial creation with saveNewVersion action
*/

"use server"

import { actionDeps } from "@/lib/action-runtime"
import * as handlers from "./handlers"

/**
 * Save a prompt and record a version. See `saveNewVersion` in ./handlers for the checks and results.
 *
 * @param data - Object containing promptId, newTitle and newContent
 * @returns ActionResult with the versionId on success; a fixed error message on any failure
 */
export async function saveNewVersion(data: unknown) {
  return handlers.saveNewVersion(actionDeps, data)
}

/**
 * Autosave a prompt's title and content without creating a version. See `autoSavePrompt` in ./handlers.
 *
 * @param data - Object containing promptId, title and content
 * @returns ActionResult with no data on success; a fixed error message on any failure
 */
export async function autoSavePrompt(data: unknown) {
  return handlers.autoSavePrompt(actionDeps, data)
}
