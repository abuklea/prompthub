/*
Project: PromptHub
Author: Allan James
Source: src/test/composite-fk.update.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 30/10/2026 01:00 GMT+10
Last modified: 30/10/2026 01:00 GMT+10
---------------
The update rule of the composite tenant keys (migration composite_tenant_keys, review finding S-4), checked against a
real Postgres: changing the owner of a folder that a sub-folder or a prompt references is refused by the database,
instead of cascading the new user_id through the subtree, while deleting a folder still cascades. No code under src
changes a folder's owner; every write here goes straight through the test client, with no handler in front of it.

Changelog:
30/10/2026 01:00 GMT+10 | Created: the two refusals are the red run against ON UPDATE CASCADE (P7S2T13, issue #119)
*/
import { afterAll, beforeAll, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import type { PrismaClient, Profile } from "@prisma/client"
import {
  createTestFolder,
  createTestPrompt,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "./db"

/**
 * Give a folder to another owner and return what the database answered.
 *
 * @param db - The client from useTestDatabase.
 * @param folderId - The folder to change.
 * @param newOwnerId - The profile id written into the folder's user_id.
 * @returns The error the write raised, or null when the database accepted it.
 */
async function changeFolderOwner(db: PrismaClient, folderId: string, newOwnerId: string): Promise<unknown> {
  try {
    await db.folder.update({ where: { id: folderId }, data: { user_id: newOwnerId } })
    return null
  } catch (error) {
    return error
  }
}

/**
 * Read back the owners of some folders and prompts, in the order of the ids given.
 *
 * @param db - The client from useTestDatabase.
 * @param ids - The folder and prompt ids to read.
 * @returns The user_id of each row found, folders first; a missing row is left out, so the length shows it.
 */
async function ownersOf(db: PrismaClient, ids: { folders: string[]; prompts: string[] }): Promise<string[]> {
  const folders = await db.folder.findMany({ where: { id: { in: ids.folders } } })
  const prompts = await db.prompt.findMany({ where: { id: { in: ids.prompts } } })
  const owner = (rows: { id: string; user_id: string }[], id: string) => rows.find((row) => row.id === id)?.user_id
  return [...ids.folders.map((id) => owner(folders, id)), ...ids.prompts.map((id) => owner(prompts, id))].filter(
    (userId): userId is string => userId !== undefined,
  )
}

/**
 * Assert that a write was refused with a foreign-key violation on the named constraint.
 *
 * @param caught - What changeFolderOwner returned.
 * @param constraint - The constraint the database must name.
 * @throws The assertion error when the write succeeded or failed with anything else.
 */
function expectRefusedBy(caught: unknown, constraint: string): void {
  expect(caught, "the database accepted the owner change").toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
  const error = caught as Prisma.PrismaClientKnownRequestError
  expect(error.code).toBe("P2003")
  expect(JSON.stringify(error.meta)).toContain(constraint)
}

describeDb("composite tenant keys: owner changes", () => {
  const getDb = useTestDatabase()
  let userA: Profile
  let userB: Profile

  beforeAll(async () => {
    userA = await createTestUser(getDb())
    userB = await createTestUser(getDb())
  })

  afterAll(async () => {
    for (const user of [userA, userB]) await deleteTestUser(getDb(), user.id)
  })

  it("refuses a new owner for a folder that has a sub-folder, and moves nothing", async () => {
    const db = getDb()
    // Reason: a root folder, so its own parent key cannot refuse the write, and no prompt filed directly in it, so the
    // sub-folder is the only row that references it and the refusal names one constraint.
    const folder = await createTestFolder(db, userA.id)
    const subFolder = await createTestFolder(db, userA.id, { parentId: folder.id })
    const prompt = await createTestPrompt(db, userA.id, { folderId: subFolder.id })

    const caught = await changeFolderOwner(db, folder.id, userB.id)

    // Reason: soft, so a red run reports both that the write went through and that the subtree moved with it.
    expect.soft(await ownersOf(db, { folders: [folder.id, subFolder.id], prompts: [prompt.id] })).toEqual([
      userA.id,
      userA.id,
      userA.id,
    ])
    expectRefusedBy(caught, "Folder_parent_id_user_id_fkey")
  })

  it("refuses a new owner for a folder that holds a prompt, and moves nothing", async () => {
    const db = getDb()
    const folder = await createTestFolder(db, userA.id)
    const prompt = await createTestPrompt(db, userA.id, { folderId: folder.id })

    const caught = await changeFolderOwner(db, folder.id, userB.id)

    expect.soft(await ownersOf(db, { folders: [folder.id], prompts: [prompt.id] })).toEqual([userA.id, userA.id])
    expectRefusedBy(caught, "Prompt_folder_id_user_id_fkey")
  })

  it("still cascades a folder delete to its sub-folders and prompts", async () => {
    const db = getDb()
    const folder = await createTestFolder(db, userA.id)
    const subFolder = await createTestFolder(db, userA.id, { parentId: folder.id })
    const prompt = await createTestPrompt(db, userA.id, { folderId: subFolder.id })

    await db.folder.delete({ where: { id: folder.id } })

    expect(await ownersOf(db, { folders: [folder.id, subFolder.id], prompts: [prompt.id] })).toEqual([])
  })
})
