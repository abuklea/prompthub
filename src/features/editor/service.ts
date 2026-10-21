/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/service.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:39 GMT+10
Last modified: 22/10/2026 08:59 GMT+10
---------------
Server-side editor persistence: saving a version, autosaving a document, restoring a version and listing the version
history, taking the database, the authenticated user id and validated input, so it can be tested against a real
Postgres without the action shells.

No "use server" directive: every export of such a file is a public endpoint, and these functions trust the userId they
are given. Only server actions call them, with user.id from supabase.auth.getUser().

Changelog:
22/10/2026 08:59 GMT+10 | saveVersion reads the newest version through findNewest, the one definition of "newest"
22/10/2026 08:52 GMT+10 | restoreVersion locks the row, snapshots a working copy the newest version lacks, writes the
                         restored state scoped to the user, records it unless the newest version holds it, and returns
                         it; listVersions orders by id (P7S1T3, decisions D1 and D4)
22/10/2026 08:49 GMT+10 | restoreVersion and listVersions extracted unchanged from restorePromptVersion and
                         getPromptVersionHistory (P7S1T3)
22/10/2026 08:41 GMT+10 | saveVersion records the saved state, skipping it when it equals the newest version; the
                         scoped update runs first as the ownership check and row lock (P7S1T2, decision D1)
22/10/2026 08:39 GMT+10 | Created by extracting saveNewVersion and autoSavePrompt unchanged (P7S1T2)
*/
import type { Prisma, PrismaClient } from "@prisma/client"
import type { z } from "zod"
import type { ActionResult } from "@/types/actions"
import type { getPromptVersionHistorySchema, restorePromptVersionSchema } from "@/features/prompts/schemas"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"
import type { AutoSaveInput, SaveNewVersionInput } from "./schemas"

/** The part of the Prisma client the editor service uses; a test may wrap it to inject a failure. */
export type EditorDb = Pick<PrismaClient, "prompt" | "promptVersion" | "$transaction">

const NOT_FOUND = "Prompt not found or access denied"

/** The title and content a prompt row or a version holds. */
type State = { title: string | null; content: string }

const stateOf = (v: { title_snapshot: string | null; content_snapshot: string }): State => ({
  title: v.title_snapshot,
  content: v.content_snapshot,
})

// Reason: strict equality, because null (an untitled document) is not "" and Prisma filters null as IS NULL.
const same = (a: State, b: State): boolean => a.title === b.title && a.content === b.content

const snapshotOf = (promptId: string, s: State) => ({
  prompt_id: promptId,
  title_snapshot: s.title,
  content_snapshot: s.content,
})

// Reason: ids are assigned in write order under the prompt row lock, while created_at is stamped by each app
// instance's own clock, so the newest version is the highest id.
const findNewest = (tx: Prisma.TransactionClient, promptId: string) =>
  tx.promptVersion.findFirst({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })

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
    const newest = await findNewest(tx, promptId)
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

/**
 * Restore a prompt to the state a version holds, in one transaction that holds the prompt row lock.
 *
 * The working copy (the row as it stands, which may hold autosaved text) is recorded first when the newest version
 * differs from it, so a restore never destroys it. The restored state is then written to the row and recorded as a new
 * version unless the newest version already holds it, so history lists it first.
 *
 * @param db - The database client.
 * @param userId - The authenticated user; the prompt must belong to this user.
 * @param input - The validated prompt id and version id.
 * @returns The restored title and content; a not-found failure when the prompt does not exist or is not the user's; or
 *   a "Version not found" failure when the version does not belong to the prompt. Nothing is written on a failure.
 * @throws Any database error, after the transaction has rolled back.
 */
export async function restoreVersion(
  db: EditorDb,
  userId: string,
  input: z.infer<typeof restorePromptVersionSchema>,
): Promise<ActionResult<State>> {
  const { promptId, versionId } = input
  return db.$transaction(async (tx): Promise<ActionResult<State>> => {
    // Reason: the locked, user-scoped read comes first. It is the ownership check (PromptVersion has no user_id, so no
    // version is read or written before it), and it holds the row lock, so a concurrent autosave or save waits for the
    // commit and the working copy read here cannot change before it is recorded.
    const rows = await tx.$queryRaw<State[]>`
      SELECT title, content FROM "Prompt" WHERE id = ${promptId} AND user_id = ${userId} FOR UPDATE`
    if (rows.length === 0) {
      return { success: false, error: NOT_FOUND }
    }
    const working = rows[0]
    const version = await tx.promptVersion.findFirst({ where: { id: versionId, prompt_id: promptId } })
    if (!version) {
      return { success: false, error: "Version not found" }
    }
    const restored = stateOf(version)
    let newest = await findNewest(tx, promptId)
    if (!newest || !same(stateOf(newest), working)) {
      newest = await tx.promptVersion.create({ data: snapshotOf(promptId, working) })
    }
    await tx.prompt.updateMany({
      where: { id: promptId, user_id: userId },
      data: { title: restored.title, content: restored.content, updated_at: new Date() },
    })
    if (!same(stateOf(newest), restored)) {
      await tx.promptVersion.create({ data: snapshotOf(promptId, restored) })
    }
    return { success: true, data: restored }
  })
}

/**
 * List the newest versions of a prompt, by id descending (write order), at most 50.
 *
 * @param db - The database client.
 * @param userId - The authenticated user; the prompt must belong to this user.
 * @param input - The validated prompt id.
 * @returns Up to 50 versions, newest first, or a not-found failure when the prompt does not exist or is not the user's.
 * @throws Any database error.
 */
export async function listVersions(
  db: EditorDb,
  userId: string,
  input: z.infer<typeof getPromptVersionHistorySchema>,
): Promise<ActionResult<PromptVersionHistoryItem[]>> {
  const { promptId } = input
  // Reason: the ownership read precedes the version read, because PromptVersion has no user_id to scope by.
  const owned = await db.prompt.findFirst({ where: { id: promptId, user_id: userId }, select: { id: true } })
  if (!owned) {
    return { success: false, error: NOT_FOUND }
  }
  // Reason: id, not created_at, is the write order (see findNewest).
  const versions = await db.promptVersion.findMany({
    where: { prompt_id: promptId },
    select: { id: true, created_at: true, title_snapshot: true, content_snapshot: true },
    orderBy: { id: "desc" },
    take: 50,
  })
  return { success: true, data: versions }
}
