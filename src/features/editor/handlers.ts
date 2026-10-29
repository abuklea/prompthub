/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
The bodies of the editor's server actions, saveNewVersion and autoSavePrompt, run through runAction: parse,
authenticate, rate-limit (saves 30 a minute, autosaves 240 a minute, each in its own store), then delegate to ./service,
which scopes every write to the authenticated user. A plain module: no "use server", no Next.js import; the wrappers
in ./actions pass the real dependencies.

Changelog:
29/10/2026 20:49 GMT+10 | Implemented: both run through runAction and delegate to the service; saveNewVersion uses the
                         save limit and checks the title first in its body; autoSavePrompt uses the autosave limit
                         (P7S2T8, decision D4)
29/10/2026 20:45 GMT+10 | Stub created (P7S2T8, red phase)
*/
import "server-only"
import { runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import { titleValidationSchema } from "@/features/prompts/schemas"
import type { ActionResult } from "@/types/actions"
import { autoSaveSchema, saveNewVersionSchema } from "./schemas"
import { autoSaveDocument, saveVersion } from "./service"

/**
 * Save a prompt's title and content and record the saved state as a version.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted input: `{ promptId, newTitle, newContent }`.
 * @returns The id of the version holding the saved state; "Invalid input data"; the unauthorised or rate-limit text;
 *   "Please provide a valid title for your document" for an empty or placeholder title; the not-found text when the
 *   prompt is missing or not the caller's; "Failed to save version" on an unexpected error.
 */
export async function saveNewVersion(deps: ActionDeps, data: unknown): Promise<ActionResult<{ versionId: number }>> {
  return runAction(
    deps,
    {
      name: "saveNewVersion",
      schema: saveNewVersionSchema,
      invalid: "Invalid input data",
      failure: "Failed to save version",
      limit: "save",
      run: async ({ db, user, input }) => {
        // Reason: an explicit save must name the document; a placeholder title is refused before anything is read or
        // written. It runs after authentication and the limit, so a signed-out caller learns nothing from it.
        if (!titleValidationSchema.safeParse(input.newTitle).success) {
          return { success: false, error: "Please provide a valid title for your document" }
        }
        return saveVersion(db, user.id, input)
      },
    },
    data,
  )
}

/**
 * Autosave a prompt's title and content without recording a version.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted input: `{ promptId, title, content }`, where title may be null for an untitled document.
 * @returns Success with no data; "Invalid input data"; the unauthorised or rate-limit text; the not-found text when the
 *   prompt is missing or not the caller's; "Failed to auto-save" on an unexpected error.
 */
export async function autoSavePrompt(deps: ActionDeps, data: unknown): Promise<ActionResult<void>> {
  return runAction(
    deps,
    {
      name: "autoSavePrompt",
      schema: autoSaveSchema,
      invalid: "Invalid input data",
      failure: "Failed to auto-save",
      limit: "autosave",
      run: ({ db, user, input }) => autoSaveDocument(db, user.id, input),
    },
    data,
  )
}
