/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:47 GMT+10
---------------
The bodies of the prompt CRUD and listing actions (getPromptsByFolder, createPrompt, getPromptDetails, renamePrompt,
deletePrompt, validatePrompts), each run through runAction with its schema, messages and limit class. Every query is
scoped by the authenticated user's id, which comes only from deps.getUser. The "use server" wrappers in actions.ts
pass the real dependencies; the tests pass the test database and a fake user.

A plain module: no "use server" directive (every export of such a file is a public endpoint) and no Next.js, Supabase
or @/lib/db import. `server-only` makes a Client Component import of this module a build error.

Changelog:
29/10/2026 20:47 GMT+10 | createPrompt checks the folder's owner in the transaction that creates the prompt (finding
                         F-2); getPromptDetails returns no tags field; documentation (P7S2T6, issue #114)
29/10/2026 20:45 GMT+10 | Red phase: today's bodies moved under runAction specs (P7S2T6, issue #114)
*/
import "server-only"
import type { Prompt } from "@prisma/client"
import { runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import type { ActionResult } from "@/types/actions"
import {
  createPromptSchema,
  deletePromptSchema,
  getPromptDetailsSchema,
  getPromptsByFolderSchema,
  renamePromptSchema,
  validatePromptsSchema,
} from "./schemas"
import { searchPrompts } from "./search-handlers"
import type { PromptListItem } from "./types"

/** A prompt row with the id and name of its folder, or null for an unfiled prompt. */
export type PromptDetails = Prompt & { folder: { id: string; name: string } | null }

/**
 * List the prompts of one of the user's folders, or search them when a query is given.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ folderId, query?, tagIds? }`; a non-blank query uses `searchPrompts`.
 * @returns The folder's prompts with their tags, by title, optionally only those carrying one of the tags; with a
 *   query, up to 100 matches, most recently updated first. A folder that is not the user's gives an empty list.
 *   "Invalid folder ID" for input that does not parse; the runner's unauthorised text; "Failed to load prompts" on
 *   any other error.
 */
export async function getPromptsByFolder(deps: ActionDeps, data: unknown): Promise<ActionResult<PromptListItem[]>> {
  return runAction(deps, {
    name: "getPromptsByFolder",
    schema: getPromptsByFolderSchema,
    invalid: "Invalid folder ID",
    failure: "Failed to load prompts",
    limit: "none",
    run: async ({ db, user, input }) => {
      const { folderId, query, tagIds } = input
      // Reason: the schema trims the query, so a blank one is "" here and lists the folder instead.
      if (query) {
        return { success: true, data: await searchPrompts(db, user.id, { folderId, query, tagIds }) }
      }
      const prompts = await db.prompt.findMany({
        where: {
          user_id: user.id,
          folder_id: folderId,
          ...(tagIds.length > 0 ? { tags: { some: { id: { in: tagIds } } } } : {}),
        },
        include: { tags: { select: { id: true, name: true } } },
        orderBy: { title: "asc" },
      })
      return { success: true, data: prompts }
    },
  }, data)
}

/**
 * Create a prompt in one of the user's folders, creating the user's profile first when it is missing.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ folderId, title? }`; no title stores null (a new, untitled document).
 * @returns The created prompt with `tags: []`, for an optimistic list update; "Folder not found or access denied"
 *   when the folder does not exist or is not the user's; the "already exists" text for a title the folder already
 *   holds, compared case-insensitively; "Invalid input data", the runner's unauthorised and rate-limit texts, or
 *   "Failed to create prompt" on any other error.
 */
export async function createPrompt(deps: ActionDeps, data: unknown): Promise<ActionResult<PromptListItem>> {
  return runAction(deps, {
    name: "createPrompt",
    schema: createPromptSchema,
    invalid: "Invalid input data",
    failure: "Failed to create prompt",
    limit: "mutation",
    ensureProfile: true,
    run: ({ db, user, input }) =>
      db.$transaction(async (tx): Promise<ActionResult<PromptListItem>> => {
        // Reason: the folder's owner is checked in the transaction that creates the prompt (finding F-2). Folder ids
        // never change owner, so a folder that passes here can only be deleted, and then the insert fails on the
        // foreign key or its cascade removes the prompt.
        const folder = await tx.folder.findFirst({
          where: { id: input.folderId, user_id: user.id },
          select: { id: true },
        })
        if (!folder) return { success: false, error: "Folder not found or access denied" }

        const title = input.title || null
        // Reason: the duplicate check is not atomic with the insert and no unique index backs it; kept as it was.
        if (title) {
          const existing = await tx.prompt.findFirst({
            where: { folder_id: input.folderId, user_id: user.id, title: { equals: title, mode: "insensitive" } },
            select: { id: true },
          })
          if (existing) {
            return {
              success: false,
              error: `A document named "${title}" already exists in this folder. Please choose a different title.`,
            }
          }
        }

        const prompt = await tx.prompt.create({
          data: { user_id: user.id, folder_id: input.folderId, title, content: "" },
        })
        return { success: true, data: { ...prompt, tags: [] } }
      }),
  }, data)
}

/**
 * Read one of the user's prompts with its folder.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptId }`.
 * @returns The prompt row and its folder's id and name (no tags field); "Prompt not found" for a missing prompt and a
 *   prompt of another user alike; "Invalid prompt ID", the runner's unauthorised text, or "Failed to fetch prompt
 *   details" on any other error.
 */
export async function getPromptDetails(deps: ActionDeps, data: unknown): Promise<ActionResult<PromptDetails>> {
  return runAction(deps, {
    name: "getPromptDetails",
    schema: getPromptDetailsSchema,
    invalid: "Invalid prompt ID",
    failure: "Failed to fetch prompt details",
    limit: "none",
    run: async ({ db, user, input }) => {
      // Reason: the user_id filter is the tenant boundary; Postgres RLS does not apply to Prisma's connection.
      const prompt = await db.prompt.findFirst({
        where: { id: input.promptId, user_id: user.id },
        include: { folder: { select: { id: true, name: true } } },
      })
      if (!prompt) return { success: false, error: "Prompt not found" }
      return { success: true, data: prompt }
    },
  }, data)
}

/**
 * Rename one of the user's prompts.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptId, newTitle }`; the title is trimmed, 1 to 200 characters, and not a placeholder
 *   such as "[Untitled Doc]".
 * @returns Success with no data; "Prompt not found" for a missing prompt and a prompt of another user alike; the
 *   "already exists" text for a title another prompt of the folder holds, compared case-insensitively; "Prompt not
 *   found or access denied" when the prompt vanished before the write; "Invalid title", the runner's unauthorised and
 *   rate-limit texts, or "Failed to rename prompt" on any other error.
 */
export async function renamePrompt(deps: ActionDeps, data: unknown): Promise<ActionResult<void>> {
  return runAction(deps, {
    name: "renamePrompt",
    schema: renamePromptSchema,
    invalid: "Invalid title",
    failure: "Failed to rename prompt",
    limit: "mutation",
    run: async ({ db, user, input }) => {
      const { promptId, newTitle } = input
      const existingPrompt = await db.prompt.findFirst({
        where: { id: promptId, user_id: user.id },
        select: { folder_id: true },
      })
      if (!existingPrompt) return { success: false, error: "Prompt not found" }

      const duplicate = await db.prompt.findFirst({
        where: {
          folder_id: existingPrompt.folder_id,
          user_id: user.id,
          title: { equals: newTitle, mode: "insensitive" },
          NOT: { id: promptId },
        },
        select: { id: true },
      })
      if (duplicate) return { success: false, error: `A document named "${newTitle}" already exists in this folder.` }

      // Reason: a single user-scoped statement, so the write cannot reach a row that is not the user's.
      const updated = await db.prompt.updateMany({
        where: { id: promptId, user_id: user.id },
        data: { title: newTitle, updated_at: new Date() },
      })
      if (updated.count === 0) return { success: false, error: "Prompt not found or access denied" }
      return { success: true, data: undefined }
    },
  }, data)
}

/**
 * Delete one of the user's prompts; its versions cascade.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptId }`.
 * @returns Success with no data; "Prompt not found or access denied" for a missing prompt and a prompt of another
 *   user alike; "Invalid prompt ID", the runner's unauthorised and rate-limit texts, or "Failed to delete prompt" on
 *   any other error.
 */
export async function deletePrompt(deps: ActionDeps, data: unknown): Promise<ActionResult<void>> {
  return runAction(deps, {
    name: "deletePrompt",
    schema: deletePromptSchema,
    invalid: "Invalid prompt ID",
    failure: "Failed to delete prompt",
    limit: "mutation",
    run: async ({ db, user, input }) => {
      const result = await db.prompt.deleteMany({ where: { id: input.promptId, user_id: user.id } })
      if (result.count === 0) return { success: false, error: "Prompt not found or access denied" }
      return { success: true, data: undefined }
    },
  }, data)
}

/**
 * Keep the ids that name prompts of the user, so the client can close tabs of prompts that are gone.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptIds }`: at most 200 strings of 1 to 64 characters.
 * @returns `{ validIds }`, the given ids that name the user's prompts; "Invalid prompt list", the runner's
 *   unauthorised text, or "Failed to validate prompts" on any other error.
 */
export async function validatePrompts(
  deps: ActionDeps,
  data: unknown,
): Promise<ActionResult<{ validIds: string[] }>> {
  return runAction(deps, {
    name: "validatePrompts",
    schema: validatePromptsSchema,
    invalid: "Invalid prompt list",
    failure: "Failed to validate prompts",
    limit: "none",
    run: async ({ db, user, input }) => {
      const prompts = await db.prompt.findMany({
        where: { id: { in: input.promptIds }, user_id: user.id },
        select: { id: true },
      })
      return { success: true, data: { validIds: prompts.map((p) => p.id) } }
    },
  }, data)
}
