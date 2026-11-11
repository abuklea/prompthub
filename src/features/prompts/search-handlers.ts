/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/search-handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
The full-text prompt search, called by the getPromptsByFolder handler when its query is non-blank. Not an action
(decision D3 of P7S2): no "use server" directive, and it trusts the userId it is given, which the caller takes from
the authenticated user. `server-only` makes a Client Component import of this module a build error.

Changelog:
29/10/2026 20:45 GMT+10 | Created: searchPrompts moved from actions.ts unchanged apart from its signature, which takes
                         the database client and the user id (P7S2T6, issue #114)
*/
import "server-only"
import type { PrismaClient } from "@prisma/client"
import type { z } from "zod"
import { searchPromptsSchema } from "./schemas"

/**
 * Search the user's prompts by title and content with the Postgres full-text index, optionally within one folder and
 * restricted to prompts carrying at least one of the given tags of the user.
 *
 * @param db - The database client.
 * @param userId - The authenticated user; only this user's prompts and tags are read.
 * @param input - The query, an optional folder id and optional tag ids; parsed with `searchPromptsSchema`.
 * @returns Up to 100 prompts with their tags, most recently updated first; an empty list for input that does not
 *   parse or a query with no searchable word.
 * @throws Any database error.
 */
export async function searchPrompts(db: PrismaClient, userId: string, input: z.input<typeof searchPromptsSchema>) {
  const parsed = searchPromptsSchema.safeParse(input)
  if (!parsed.success) {
    return []
  }

  const { query, folderId, tagIds } = parsed.data
  const tsQuery = query
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, "").trim())
    .filter(Boolean)
    .join(" & ")

  if (!tsQuery) {
    return []
  }

  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id
    FROM "Prompt" p
    WHERE p.user_id = ${userId}
      AND (${folderId ?? null}::text IS NULL OR p.folder_id = ${folderId ?? null})
      AND p.content_tsv @@ to_tsquery('english', ${tsQuery})
      AND (
        array_length(${tagIds}::text[], 1) IS NULL
        OR EXISTS (
          SELECT 1
          FROM "_PromptToTag" pt
          JOIN "Tag" t ON t.id = pt."B"
          WHERE pt."A" = p.id
            AND t.user_id = ${userId}
            AND pt."B" = ANY(${tagIds}::text[])
        )
      )
    ORDER BY p.updated_at DESC
    LIMIT 100
  `

  if (rows.length === 0) {
    return []
  }

  const prompts = await db.prompt.findMany({
    where: {
      id: {
        in: rows.map((row) => row.id),
      },
      user_id: userId,
    },
    include: {
      tags: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  const order = new Map(rows.map((row, index) => [row.id, index]))
  return prompts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}
