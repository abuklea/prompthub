/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:44 GMT+10
Last modified: 29/10/2026 21:03 GMT+10
---------------
The bodies of the five folder actions, each run through runAction against the dependencies it is given: the "use
server" wrappers in actions.ts pass the real ones, the tests pass the test database and a fake user. Every query is
scoped by the caller's id, and a missing folder and another user's folder give the same result.

Changelog:
29/10/2026 21:03 GMT+10 | noInputSchema comes from @/lib/action-runner (P7S2T8)
29/10/2026 20:46 GMT+10 | Handlers implemented: parent checked in the create transaction, rename maps P2025, delete
                         reads the whole tree before the cascade (P7S2T5, issue #113)
29/10/2026 20:44 GMT+10 | Created: stub handlers for the red run (P7S2T5, issue #113)
*/
import "server-only"
import type { Folder, Prisma } from "@prisma/client"
import { noInputSchema, runAction, type ActionDeps } from "@/lib/action-runner"
import { isNotFoundError } from "@/lib/prisma-errors"
import type { ActionResult } from "@/types/actions"
import { createFolderSchema, deleteFolderSchema, getFolderChildrenSchema, renameFolderSchema } from "./schemas"

/** The ids a deleteFolder removed: the folder, its descendants and every prompt filed in them. */
export interface DeletedFolderTree {
  /** The deleted folder and every descendant folder. */
  folderIds: string[]
  /** Every prompt filed in one of those folders. */
  promptIds: string[]
}

// Reason: one text for a missing and a foreign folder, so a response cannot reveal that another user's id exists.
const NOT_FOUND: { success: false; error: string } = { success: false, error: "Folder not found or access denied" }

/**
 * Read the ids a delete of `folderId` would remove: the folder, every descendant folder and every prompt filed in one
 * of them, all owned by `userId`. It must run before the delete, because the foreign keys cascade.
 *
 * @param tx - The transaction the delete runs in.
 * @param userId - The caller; every row read is scoped to it.
 * @param folderId - The root of the tree.
 * @returns The folder ids (empty when the folder is missing or foreign) and the prompt ids.
 */
async function readFolderTree(
  tx: Prisma.TransactionClient,
  userId: string,
  folderId: string,
): Promise<DeletedFolderTree> {
  // Reason: UNION, not UNION ALL, in the recursion, so it terminates even if corrupt data holds a parent cycle. The
  // recursive step is scoped by user_id as well, so a corrupt cross-user parent link never reads another user's ids.
  const rows = await tx.$queryRaw<{ kind: string; id: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id FROM "Folder" WHERE id = ${folderId} AND user_id = ${userId}
      UNION
      SELECT f.id FROM "Folder" f JOIN tree t ON f.parent_id = t.id WHERE f.user_id = ${userId}
    )
    SELECT 'folder' AS kind, id FROM tree
    UNION ALL
    SELECT 'prompt' AS kind, p.id FROM "Prompt" p WHERE p.folder_id IN (SELECT id FROM tree) AND p.user_id = ${userId}
  `
  return {
    folderIds: rows.filter((row) => row.kind === "folder").map((row) => row.id),
    promptIds: rows.filter((row) => row.kind === "prompt").map((row) => row.id),
  }
}

/**
 * List the caller's root folders by name.
 *
 * @param deps - The database client and the user resolver.
 * @param data - Must be undefined: the action takes no argument.
 * @returns The root folders; "Invalid input data" for any argument; "Failed to load folders" on an unexpected error.
 */
export function getRootFolders(deps: ActionDeps, data: unknown): Promise<ActionResult<Folder[]>> {
  return runAction(deps, {
    name: "getRootFolders",
    schema: noInputSchema,
    invalid: "Invalid input data",
    failure: "Failed to load folders",
    limit: "none",
    run: async ({ db, user }) => ({
      success: true,
      data: await db.folder.findMany({ where: { user_id: user.id, parent_id: null }, orderBy: { name: "asc" } }),
    }),
  }, data)
}

/**
 * Create a folder for the caller, at the root or under a parent the caller owns.
 *
 * @param deps - The database client and the user resolver.
 * @param data - `{ name, parentId }`, parsed with createFolderSchema; the name is trimmed, 1 to 100 characters.
 * @returns The created folder; the not-found result for a missing or foreign parent, with nothing written;
 *   "Invalid folder name or parent" for input that does not parse; "Failed to create folder" on an unexpected error.
 */
export function createFolder(deps: ActionDeps, data: unknown): Promise<ActionResult<Folder>> {
  return runAction(deps, {
    name: "createFolder",
    schema: createFolderSchema,
    invalid: "Invalid folder name or parent",
    failure: "Failed to create folder",
    limit: "mutation",
    ensureProfile: true,
    // Reason: no lock is needed: no action changes a folder's user_id, so ownership cannot change between the check
    // and the insert, and a parent deleted in between fails the foreign key, which the runner turns into `failure`.
    run: ({ db, user, input }) =>
      db.$transaction(async (tx): Promise<ActionResult<Folder>> => {
        if (input.parentId !== null) {
          const parent = await tx.folder.findFirst({
            where: { id: input.parentId, user_id: user.id },
            select: { id: true },
          })
          if (!parent) return NOT_FOUND
        }
        const folder = await tx.folder.create({
          data: { name: input.name, user_id: user.id, parent_id: input.parentId },
        })
        return { success: true, data: folder }
      }),
  }, data)
}

/**
 * Rename one of the caller's folders.
 *
 * @param deps - The database client and the user resolver.
 * @param data - `{ folderId, name }`, parsed with renameFolderSchema; the name is trimmed, 1 to 100 characters.
 * @returns The updated folder; the not-found result for a missing or foreign folder; "Invalid folder name" for input
 *   that does not parse; "Failed to rename folder" on an unexpected error.
 */
export function renameFolder(deps: ActionDeps, data: unknown): Promise<ActionResult<Folder>> {
  return runAction(deps, {
    name: "renameFolder",
    schema: renameFolderSchema,
    invalid: "Invalid folder name",
    failure: "Failed to rename folder",
    limit: "mutation",
    run: async ({ db, user, input }) => {
      try {
        const folder = await db.folder.update({
          where: { id: input.folderId, user_id: user.id },
          data: { name: input.name },
        })
        return { success: true, data: folder }
      } catch (error) {
        // Reason: the scoped update raises P2025 when no row matches, whether the folder is missing or foreign.
        if (isNotFoundError(error)) return NOT_FOUND
        throw error
      }
    },
  }, data)
}

/**
 * Delete one of the caller's folders with its descendants and every prompt filed in them (the foreign keys cascade).
 *
 * The tree is read and deleted in one transaction. A prompt that another session of the same user files in a
 * descendant between the two statements is deleted without being listed; no lock is taken against that.
 *
 * @param deps - The database client and the user resolver.
 * @param data - `{ folderId }`, parsed with deleteFolderSchema.
 * @returns Every folder id and prompt id removed, so the caller can purge its caches and close tabs; the not-found
 *   result for a missing or foreign folder; "Invalid folder ID" for input that does not parse; "Failed to delete
 *   folder" on an unexpected error.
 */
export function deleteFolder(deps: ActionDeps, data: unknown): Promise<ActionResult<DeletedFolderTree>> {
  return runAction(deps, {
    name: "deleteFolder",
    schema: deleteFolderSchema,
    invalid: "Invalid folder ID",
    failure: "Failed to delete folder",
    limit: "mutation",
    run: ({ db, user, input }) =>
      db.$transaction(async (tx): Promise<ActionResult<DeletedFolderTree>> => {
        const tree = await readFolderTree(tx, user.id, input.folderId)
        if (tree.folderIds.length === 0) return NOT_FOUND
        const deleted = await tx.folder.deleteMany({ where: { id: input.folderId, user_id: user.id } })
        // Reason: another request may have deleted the folder after the read; report it as gone, not as deleted here.
        if (deleted.count === 0) return NOT_FOUND
        return { success: true, data: tree }
      }),
  }, data)
}

/**
 * List the children of a folder by name. A parent the caller does not own gives an empty list, as an owned parent
 * without children does, so the action cannot be used to probe for folder ids.
 *
 * @param deps - The database client and the user resolver.
 * @param data - `{ parentId }`, parsed with getFolderChildrenSchema.
 * @returns The caller's folders under the parent; "Invalid folder ID" for input that does not parse; "Failed to load
 *   folders" on an unexpected error.
 */
export function getFolderChildren(deps: ActionDeps, data: unknown): Promise<ActionResult<Folder[]>> {
  return runAction(deps, {
    name: "getFolderChildren",
    schema: getFolderChildrenSchema,
    invalid: "Invalid folder ID",
    failure: "Failed to load folders",
    limit: "none",
    run: async ({ db, user, input }) => ({
      success: true,
      data: await db.folder.findMany({
        where: { user_id: user.id, parent_id: input.parentId },
        orderBy: { name: "asc" },
      }),
    }),
  }, data)
}
