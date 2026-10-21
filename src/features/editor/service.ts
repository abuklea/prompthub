/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/service.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:39 GMT+10
Last modified: 22/10/2026 08:41 GMT+10
---------------
Server-side editor persistence: saving a version and autosaving a document, taking the database, the authenticated
user id and validated input, so it can be tested against a real Postgres without the action shells.

No "use server" directive: every export of such a file is a public endpoint, and these functions trust the userId they
are given. Only server actions call them, with user.id from supabase.auth.getUser().

Changelog:
22/10/2026 08:41 GMT+10 | saveVersion records the saved state, skipping it when it equals the newest version; the
                         scoped update runs first as the ownership check and row lock (P7S1T2, decision D1)
22/10/2026 08:39 GMT+10 | Created by extracting saveNewVersion and autoSavePrompt unchanged (P7S1T2)
*/
import type { PrismaClient } from "@prisma/client"
import type { ActionResult } from "@/types/actions"
import type { AutoSaveInput, SaveNewVersionInput } from "./schemas"

/** The part of the Prisma client the editor service uses; a test may wrap it to inject a failure. */
export type EditorDb = Pick<PrismaClient, "prompt" | "promptVersion" | "$transaction">

const NOT_FOUND = "Prompt not found or access denied"

/**
 * Save a prompt's title and content and record the saved state as a version, in one transaction.
 *
 * A version is the saved state, not the state it replaced. When the newest version already holds the saved title and
 * content, no version is added and its id is returned, so a repeated or concurrent identical save records one row.
 *
 * @param db - The database client.
 * @param userId - The authenticated user; the prompt must belong to this user.
 * @param input - The validated prompt id, title and content.
 * @returns The id of the version holding the saved state, or a not-found failure when the prompt does not exist or is
 *   not the user's (nothing is written then).
 * @throws Any database error, after the transaction has rolled back.
 */
export async function saveVersion(
  db: EditorDb,
  userId: string,
  input: SaveNewVersionInput,
): Promise<ActionResult<{ versionId: number }>> {
  const { promptId, newTitle, newContent } = input
  return db.$transaction(async (tx): Promise<ActionResult<{ versionId: number }>> => {
    // Reason: the scoped update comes first. It is the ownership check (PromptVersion has no user_id, so no version is
    // read or written before it) and it takes the prompt row lock, so concurrent saves of one prompt run one at a time
    // and each sees the versions the previous one committed. Ids are assigned in that order, hence "newest" is id desc.
    const written = await tx.prompt.updateMany({
      where: { id: promptId, user_id: userId },
      data: { title: newTitle, content: newContent, updated_at: new Date() },
    })
    if (written.count === 0) {
      return { success: false, error: NOT_FOUND }
    }
    const newest = await tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })
    if (newest && newest.title_snapshot === newTitle && newest.content_snapshot === newContent) {
      return { success: true, data: { versionId: newest.id } }
    }
    const created = await tx.promptVersion.create({
      data: { prompt_id: promptId, title_snapshot: newTitle, content_snapshot: newContent },
    })
    return { success: true, data: { versionId: created.id } }
  })
}

/**
 * Autosave a prompt's title and content without recording a version.
 *
 * @param db - The database client.
 * @param userId - The authenticated user; the prompt must belong to this user.
 * @param input - The validated prompt id, title (null for an untitled document) and content.
 * @returns Success with no data, or a not-found failure when the prompt does not exist or is not the user's.
 * @throws Any database error.
 */
export async function autoSaveDocument(
  db: EditorDb,
  userId: string,
  input: AutoSaveInput,
): Promise<ActionResult<void>> {
  const { promptId, title, content } = input
  // Reason: the composite (id, user_id) predicate is the ownership check; update() cannot express it.
  const result = await db.prompt.updateMany({
    where: { id: promptId, user_id: userId },
    data: { title, content, updated_at: new Date() },
  })
  if (result.count === 0) {
    return { success: false, error: NOT_FOUND }
  }
  return { success: true, data: undefined }
}
