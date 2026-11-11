/*
Project: PromptHub
Author: Allan James
Source: src/test/composite-fk.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:43 GMT+10
Last modified: 29/10/2026 21:43 GMT+10
---------------
The composite tenant keys (migration composite_tenant_keys, finding F-2), checked against a real Postgres: the database
itself refuses a folder under another user's folder and a prompt in another user's folder, while root folders,
unfiled prompts, a user's own tree and the cascades keep working. The handlers check the owner first; these keys are
the second layer, so every write here goes straight through the test client, with no handler in front of it.

Changelog:
29/10/2026 21:43 GMT+10 | Created: the two rejections are the red run before the schema change (P7S2T13, issue #119)
*/
import { afterAll, beforeAll, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import type { Profile } from "@prisma/client"
import {
  createTestFolder,
  createTestPrompt,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "./db"

/**
 * Run a write that the database must refuse with a foreign-key violation, and return the Prisma error it raised.
 *
 * @param write - The write to run.
 * @returns The known request error, for further assertions.
 * @throws The assertion error when the write succeeds or fails with anything other than a P2003.
 */
async function expectForeignKeyViolation(write: () => Promise<unknown>): Promise<Prisma.PrismaClientKnownRequestError> {
  let caught: unknown = null
  try {
    await write()
  } catch (error) {
    caught = error
  }
  expect(caught, "the database accepted the write").toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
  const error = caught as Prisma.PrismaClientKnownRequestError
  expect(error.code).toBe("P2003")
  return error
}

describeDb("composite tenant keys", () => {
  const getDb = useTestDatabase()
  let userA: Profile
  let userB: Profile
  // Reason: the profile-cascade test deletes this user itself; afterAll deletes it again in case that test failed.
  let userC: Profile

  beforeAll(async () => {
    userA = await createTestUser(getDb())
    userB = await createTestUser(getDb())
    userC = await createTestUser(getDb())
  })

  afterAll(async () => {
    for (const user of [userA, userB, userC]) await deleteTestUser(getDb(), user.id)
  })

  it("refuses a folder whose parent is another user's folder, and writes no row", async () => {
    const db = getDb()
    const parentOfA = await createTestFolder(db, userA.id)
    const error = await expectForeignKeyViolation(() => createTestFolder(db, userB.id, { parentId: parentOfA.id }))
    expect(JSON.stringify(error.meta)).toContain("Folder_parent_id_user_id_fkey")
    expect(await db.folder.count({ where: { parent_id: parentOfA.id } })).toBe(0)
  })

  it("refuses a prompt whose folder is another user's folder, and writes no row", async () => {
    const db = getDb()
    const folderOfA = await createTestFolder(db, userA.id)
    const error = await expectForeignKeyViolation(() => createTestPrompt(db, userB.id, { folderId: folderOfA.id }))
    expect(JSON.stringify(error.meta)).toContain("Prompt_folder_id_user_id_fkey")
    expect(await db.prompt.count({ where: { folder_id: folderOfA.id } })).toBe(0)
  })

  it("accepts a root folder and an unfiled prompt, whose null column exempts them from the composite key", async () => {
    const db = getDb()
    const root = await createTestFolder(db, userA.id)
    const unfiled = await createTestPrompt(db, userA.id)
    expect(await db.folder.findUnique({ where: { id: root.id } })).toMatchObject({ user_id: userA.id, parent_id: null })
    expect(await db.prompt.findUnique({ where: { id: unfiled.id } })).toMatchObject({
      user_id: userA.id,
      folder_id: null,
    })
  })

  it("accepts a child folder under its owner's folder and a prompt in its owner's folder", async () => {
    const db = getDb()
    const parent = await createTestFolder(db, userB.id)
    const child = await createTestFolder(db, userB.id, { parentId: parent.id })
    const prompt = await createTestPrompt(db, userB.id, { folderId: child.id })
    expect(await db.folder.findUnique({ where: { id: child.id } })).toMatchObject({
      user_id: userB.id,
      parent_id: parent.id,
    })
    expect(await db.prompt.findUnique({ where: { id: prompt.id } })).toMatchObject({
      user_id: userB.id,
      folder_id: child.id,
    })
  })

  it("deleting a folder still cascades to its child folders and to the prompts filed in them", async () => {
    const db = getDb()
    const parent = await createTestFolder(db, userA.id)
    const child = await createTestFolder(db, userA.id, { parentId: parent.id })
    const inParent = await createTestPrompt(db, userA.id, { folderId: parent.id })
    const inChild = await createTestPrompt(db, userA.id, { folderId: child.id })

    await db.folder.delete({ where: { id: parent.id } })

    expect(await db.folder.count({ where: { id: { in: [parent.id, child.id] } } })).toBe(0)
    expect(await db.prompt.count({ where: { id: { in: [inParent.id, inChild.id] } } })).toBe(0)
  })

  it("deleting a profile still cascades to its folders, nested folders and prompts", async () => {
    const db = getDb()
    const owner = userC
    const parent = await createTestFolder(db, owner.id)
    await createTestFolder(db, owner.id, { parentId: parent.id })
    await createTestPrompt(db, owner.id, { folderId: parent.id })
    await createTestPrompt(db, owner.id)

    await db.profile.delete({ where: { id: owner.id } })

    expect(await db.folder.count({ where: { user_id: owner.id } })).toBe(0)
    expect(await db.prompt.count({ where: { user_id: owner.id } })).toBe(0)
  })
})
