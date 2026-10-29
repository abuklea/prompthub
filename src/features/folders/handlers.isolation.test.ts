/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
The tenant boundary of the folder handlers against a real Postgres (skipped without TEST_DATABASE_URL). User B calls
each handler with user A's ids: the result equals what a missing id returns, and A's rows, read back with the test
client, are unchanged. A delete of a nested tree returns every folder and prompt id the cascade removes and leaves
another user's tree alone.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T5, issue #113)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { testDeps } from "@/test/action-deps"
import {
  createTestFolder,
  createTestPrompt,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "@/test/db"
import { createFolder, deleteFolder, getFolderChildren, getRootFolders, renameFolder } from "./handlers"

const NOT_FOUND = { success: false, error: "Folder not found or access denied" }

/** A folder X with a child Y and a grandchild Z, and one prompt filed in each, ids listed X, Y, Z. */
interface Tree {
  folderIds: string[]
  promptIds: string[]
}

/** Build a three-level tree for a user. */
async function createTree(db: PrismaClient, userId: string): Promise<Tree> {
  const x = await createTestFolder(db, userId, { name: "X" })
  const y = await createTestFolder(db, userId, { name: "Y", parentId: x.id })
  const z = await createTestFolder(db, userId, { name: "Z", parentId: y.id })
  const folderIds = [x.id, y.id, z.id]
  const promptIds: string[] = []
  for (const folderId of folderIds) promptIds.push((await createTestPrompt(db, userId, { folderId })).id)
  return { folderIds, promptIds }
}

/** Every folder and prompt row of a user, in a stable order, for before-and-after comparison. */
async function snapshot(db: PrismaClient, userId: string): Promise<unknown> {
  const folders = await db.folder.findMany({ where: { user_id: userId }, orderBy: { id: "asc" } })
  const prompts = await db.prompt.findMany({
    where: { user_id: userId },
    orderBy: { id: "asc" },
    select: { id: true, title: true, content: true, folder_id: true, updated_at: true },
  })
  return { folders, prompts }
}

const sorted = (ids: string[]): string[] => [...ids].sort()

describeDb("folder handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let treeA: Tree = { folderIds: [], promptIds: [] }

  beforeAll(async () => {
    userA = (await createTestUser(getDb())).id
    userB = (await createTestUser(getDb())).id
    treeA = await createTree(getDb(), userA)
  })

  afterAll(async () => {
    for (const id of [userA, userB]) if (id) await deleteTestUser(getDb(), id)
  })

  it("createFolder: user B with user A's folder as parent gets the missing-id result and no row", async () => {
    const before = await snapshot(getDb(), userA)
    const deps = testDeps(getDb(), userB)
    const name = `intruder-${randomUUID()}`

    const foreign = await createFolder(deps, { name, parentId: treeA.folderIds[0] })
    const missing = await createFolder(deps, { name, parentId: randomUUID() })

    expect(foreign).toEqual(missing)
    expect(foreign).toEqual(NOT_FOUND)
    expect(await getDb().folder.count({ where: { name } })).toBe(0)
    expect(await snapshot(getDb(), userA)).toEqual(before)
  })

  it("renameFolder: user B renaming user A's folder gets the missing-id result; A's keeps its name", async () => {
    const before = await snapshot(getDb(), userA)
    const deps = testDeps(getDb(), userB)

    const foreign = await renameFolder(deps, { folderId: treeA.folderIds[0], name: "hijacked" })
    const missing = await renameFolder(deps, { folderId: randomUUID(), name: "hijacked" })

    expect(foreign).toEqual(missing)
    expect(foreign).toEqual(NOT_FOUND)
    expect(await snapshot(getDb(), userA)).toEqual(before)
  })

  it("deleteFolder: user B deleting user A's folder gets the missing-id result and A's tree is intact", async () => {
    const before = await snapshot(getDb(), userA)
    const deps = testDeps(getDb(), userB)

    const foreign = await deleteFolder(deps, { folderId: treeA.folderIds[0] })
    const missing = await deleteFolder(deps, { folderId: randomUUID() })

    expect(foreign).toEqual(missing)
    expect(foreign).toEqual(NOT_FOUND)
    expect(await snapshot(getDb(), userA)).toEqual(before)
  })

  it("getFolderChildren: user B listing user A's folder gets an empty list, as for a missing id", async () => {
    const deps = testDeps(getDb(), userB)

    const foreign = await getFolderChildren(deps, { parentId: treeA.folderIds[0] })
    const missing = await getFolderChildren(deps, { parentId: randomUUID() })

    expect(foreign).toEqual({ success: true, data: [] })
    expect(foreign).toEqual(missing)
  })

  it("getRootFolders: user B gets only B's root folders and none of user A's", async () => {
    const own = await createTestFolder(getDb(), userB, { name: "B root" })

    const result = await getRootFolders(testDeps(getDb(), userB), undefined)

    expect(result.success && result.data.map((f) => f.id)).toEqual([own.id])
    await getDb().folder.delete({ where: { id: own.id } })
  })

  it("deleteFolder: a nested tree returns every folder and prompt id removed; user B's tree is untouched", async () => {
    const nested = await createTree(getDb(), userA)
    const treeB = await createTree(getDb(), userB)
    const beforeB = await snapshot(getDb(), userB)

    const result = await deleteFolder(testDeps(getDb(), userA), { folderId: nested.folderIds[0] })

    if (!result.success) throw new Error(`deleteFolder failed: ${result.error}`)
    expect(sorted(result.data.folderIds)).toEqual(sorted(nested.folderIds))
    expect(sorted(result.data.promptIds)).toEqual(sorted(nested.promptIds))
    expect(await getDb().folder.count({ where: { id: { in: nested.folderIds } } })).toBe(0)
    expect(await getDb().prompt.count({ where: { id: { in: nested.promptIds } } })).toBe(0)
    expect(await snapshot(getDb(), userB)).toEqual(beforeB)
    expect(await getDb().folder.count({ where: { id: { in: [...treeA.folderIds, ...treeB.folderIds] } } })).toBe(6)
  })
})
