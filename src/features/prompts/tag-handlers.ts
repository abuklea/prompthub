/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/tag-handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:08 GMT+10
Last modified: 29/10/2026 21:11 GMT+10
---------------
The bodies of the tag actions (getTags, createTag, assignTagsToPrompt), each run through runAction with its schema,
messages and limit class. Every query is scoped by the authenticated user's id, which comes only from deps.getUser.
The "use server" wrappers in ./tag-actions pass the real dependencies; the tests pass the test database and a fake user.

A plain module: no "use server" directive (every export of such a file is a public endpoint) and no Next.js, Supabase
or @/lib/db import. `server-only` makes a Client Component import of this module a build error.

Changelog:
29/10/2026 21:11 GMT+10 | Moved from ./actions under runAction specs: getTags returns an ActionResult; createTag and
                         assignTagsToPrompt use the mutation limit; assignTagsToPrompt reads and writes in one
                         transaction and its write is scoped by user_id (issue #41, P7S2T7)
29/10/2026 21:08 GMT+10 | Stub created (P7S2T7, red phase)
*/
import "server-only"
import { Prisma } from "@prisma/client"
import type { PrismaClient, Tag } from "@prisma/client"
import { runAction } from "@/lib/action-runner"
import type { ActionDeps } from "@/lib/action-runner"
import { isNotFoundError } from "@/lib/prisma-errors"
import type { ActionResult } from "@/types/actions"
import { assignPromptTagsSchema, createTagSchema, listTagsSchema } from "./schemas"

const NOT_FOUND = "Prompt not found or access denied"

/** The id and name of a tag, as createTag returns it. */
type TagSummary = { id: string; name: string }

/**
 * Find one of the user's tags by name, ignoring case.
 *
 * @param db - The database client.
 * @param userId - The authenticated user.
 * @param name - The trimmed tag name.
 * @returns The tag's id and stored name, or null.
 */
function findTagByName(db: Pick<PrismaClient, "tag">, userId: string, name: string): Promise<TagSummary | null> {
  return db.tag.findFirst({
    where: { user_id: userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
}

/**
 * Whether an error is Prisma's unique-constraint violation (P2002).
 *
 * @param error - Any thrown value.
 * @returns True for a Prisma known request error with code P2002.
 */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/**
 * List the user's tags by name, or only those on the prompts of one of the user's folders.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ folderId? }`.
 * @returns The tags, by name; a folder that is not the user's gives an empty list. "Invalid input data" for input that
 *   does not parse; the runner's unauthorised text; "Failed to load tags" on any other error.
 */
export async function getTags(deps: ActionDeps, data: unknown): Promise<ActionResult<Tag[]>> {
  return runAction(deps, {
    name: "getTags",
    schema: listTagsSchema,
    invalid: "Invalid input data",
    failure: "Failed to load tags",
    limit: "none",
    run: async ({ db, user, input }) => {
      const tags = await db.tag.findMany({
        where: {
          user_id: user.id,
          ...(input.folderId ? { prompts: { some: { folder_id: input.folderId, user_id: user.id } } } : {}),
        },
        orderBy: { name: "asc" },
      })
      return { success: true, data: tags }
    },
  }, data)
}

/**
 * Create one of the user's tags, or return the tag the user already has under that name in any case.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ name }`: trimmed, 1 to 50 characters.
 * @returns The new or existing tag's id and stored name; "Invalid input data", the runner's unauthorised and
 *   rate-limit texts, or "Failed to create tag" on any other error.
 */
export async function createTag(deps: ActionDeps, data: unknown): Promise<ActionResult<TagSummary>> {
  return runAction(deps, {
    name: "createTag",
    schema: createTagSchema,
    invalid: "Invalid input data",
    failure: "Failed to create tag",
    limit: "mutation",
    run: async ({ db, user, input }) => {
      const existing = await findTagByName(db, user.id, input.name)
      if (existing) return { success: true, data: existing }

      try {
        const tag = await db.tag.create({
          data: { user_id: user.id, name: input.name },
          select: { id: true, name: true },
        })
        return { success: true, data: tag }
      } catch (error) {
        // Reason: a concurrent request created the same name, in any case, between the lookup and the insert; the
        // case-insensitive index Tag_name_user_id_ci_key (migration 20260717000001) raises P2002, and that request's
        // tag is the answer. Without a tag to return, the error stands.
        if (!isUniqueViolation(error)) throw error
        const raced = await findTagByName(db, user.id, input.name)
        if (!raced) throw error
        return { success: true, data: raced }
      }
    },
  }, data)
}

/**
 * Replace the tags of one of the user's prompts with a list of the user's tags.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Untrusted `{ promptId, tagIds }`: at most 20 tag ids; duplicates are ignored; an empty list clears.
 * @returns Success with no data; "Prompt not found or access denied" for a missing prompt, a prompt of another user, or
 *   a prompt deleted before the write; "One or more tags are invalid" when any id is not one of the user's tags;
 *   "Invalid input data", the runner's unauthorised and rate-limit texts, or "Failed to assign tags" on any other
 *   error.
 */
export async function assignTagsToPrompt(deps: ActionDeps, data: unknown): Promise<ActionResult<void>> {
  return runAction(deps, {
    name: "assignTagsToPrompt",
    schema: assignPromptTagsSchema,
    invalid: "Invalid input data",
    failure: "Failed to assign tags",
    limit: "mutation",
    run: async ({ db, user, input }) => {
      const { promptId } = input
      const tagIds = Array.from(new Set(input.tagIds))
      try {
        return await db.$transaction(async (tx): Promise<ActionResult<void>> => {
          const prompt = await tx.prompt.findFirst({ where: { id: promptId, user_id: user.id }, select: { id: true } })
          if (!prompt) return { success: false, error: NOT_FOUND }

          if (tagIds.length > 0) {
            const owned = await tx.tag.count({ where: { id: { in: tagIds }, user_id: user.id } })
            if (owned !== tagIds.length) return { success: false, error: "One or more tags are invalid" }
          }

          // Reason: updateMany cannot set a relation, so the write is update with the { id, user_id } unique-where
          // form: it cannot reach another user's row, and it raises P2025 when the prompt is gone by now. A tag
          // never changes owner, so the tags counted above are still the user's.
          await tx.prompt.update({
            where: { id: promptId, user_id: user.id },
            data: { tags: { set: tagIds.map((id) => ({ id })) } },
          })
          return { success: true, data: undefined }
        })
      } catch (error) {
        if (isNotFoundError(error)) return { success: false, error: NOT_FOUND }
        throw error
      }
    },
  }, data)
}
