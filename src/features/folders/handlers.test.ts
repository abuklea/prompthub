/*
Project: PromptHub
Author: Allan James
Source: src/features/folders/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
Behaviour of the folder handlers against a real Postgres (skipped without TEST_DATABASE_URL): names are trimmed and
bounded, children are created under owned parents, a rename of a vanished folder gives the not-found result through
P2025, the listings are sorted by name, and the 31st mutation of a minute is refused.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T5, issue #113)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { Folder } from "@prisma/client"
import type { ActionResult } from "@/types/actions"
import { signedOutDeps, testDeps } from "@/test/action-deps"
import { createTestFolder, createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import { withRowDeletedBeforeUpdate } from "@/test/racing-db"
import { createFolder, deleteFolder, getFolderChildren, getRootFolders, renameFolder } from "./handlers"

const NOT_FOUND = { success: false, error: "Folder not found or access denied" }

/** The data of a successful result; fails the test with the error otherwise. */
function dataOf<T>(result: ActionResult<T>): T {
  if (!result.success) throw new Error(`action failed: ${result.error}`)
  return result.data
}

describeDb("folder handlers", () => {
  const getDb = useTestDatabase()
  const created: string[] = []

  /** A new profile, deleted with everything it owns in afterAll. */
  async function newUser(): Promise<string> {
    const id = (await createTestUser(getDb())).id
    created.push(id)
    return id
  }

  let owner = ""

  beforeAll(async () => {
    owner = await newUser()
  })

  afterAll(async () => {
    for (const id of created) await deleteTestUser(getDb(), id)
  })

  it("createFolder trims the name and stores a root folder for the caller", async () => {
    const folder = dataOf(await createFolder(testDeps(getDb(), owner), { name: "  Trimmed  ", parentId: null }))

    expect([folder.name, folder.parent_id, folder.user_id]).toEqual(["Trimmed", null, owner])
    const row = await getDb().folder.findUniqueOrThrow({ where: { id: folder.id } })
    expect([row.name, row.parent_id, row.user_id]).toEqual(["Trimmed", null, owner])
  })

  it("createFolder accepts a 100-character name and refuses a 101-character one", async () => {
    const deps = testDeps(getDb(), owner)
    const longest = "a".repeat(100)

    expect(dataOf(await createFolder(deps, { name: longest, parentId: null })).name).toBe(longest)
    expect(await createFolder(deps, { name: `${longest}b`, parentId: null })).toEqual({
      success: false,
      error: "Invalid folder name or parent",
    })
    expect(await getDb().folder.count({ where: { user_id: owner, name: `${longest}b` } })).toBe(0)
  })

  it("createFolder refuses a blank name and writes nothing", async () => {
    const before = await getDb().folder.count({ where: { user_id: owner } })

    expect(await createFolder(testDeps(getDb(), owner), { name: " \t ", parentId: null })).toEqual({
      success: false,
      error: "Invalid folder name or parent",
    })
    expect(await getDb().folder.count({ where: { user_id: owner } })).toBe(before)
  })

  it("createFolder creates a child under an owned parent", async () => {
    const parent = await createTestFolder(getDb(), owner, { name: "parent" })

    const child = dataOf(await createFolder(testDeps(getDb(), owner), { name: "child", parentId: parent.id }))

    expect([child.name, child.parent_id, child.user_id]).toEqual(["child", parent.id, owner])
    const rows = await getDb().folder.findMany({ where: { parent_id: parent.id } })
    expect(rows.map((r) => r.id)).toEqual([child.id])
  })

  it("createFolder under a missing parent gives the not-found result and writes nothing", async () => {
    const before = await getDb().folder.count({ where: { user_id: owner } })

    expect(await createFolder(testDeps(getDb(), owner), { name: "orphan", parentId: randomUUID() })).toEqual(NOT_FOUND)
    expect(await getDb().folder.count({ where: { user_id: owner } })).toBe(before)
  })

  it("createFolder creates the profile of a first-time user", async () => {
    const id = randomUUID()
    created.push(id)

    const folder = dataOf(await createFolder(testDeps(getDb(), id), { name: "first", parentId: null }))

    expect(folder.user_id).toBe(id)
    expect(await getDb().profile.count({ where: { id } })).toBe(1)
  })

  it("createFolder refuses a signed-out caller and writes nothing", async () => {
    const name = `signed-out-${randomUUID()}`

    expect(await createFolder(signedOutDeps(getDb()), { name, parentId: null })).toEqual({
      success: false,
      error: "Unauthorized. Please sign in.",
    })
    expect(await getDb().folder.count({ where: { name } })).toBe(0)
  })

  it("renameFolder trims the new name and returns the updated folder", async () => {
    const folder = await createTestFolder(getDb(), owner, { name: "before" })

    const renamed = dataOf(await renameFolder(testDeps(getDb(), owner), { folderId: folder.id, name: "  after " }))

    expect([renamed.id, renamed.name, renamed.user_id]).toEqual([folder.id, "after", owner])
    expect((await getDb().folder.findUniqueOrThrow({ where: { id: folder.id } })).name).toBe("after")
  })

  it("renameFolder refuses a blank name, a 101-character name and a temporary id, and changes nothing", async () => {
    const folder = await createTestFolder(getDb(), owner, { name: "kept" })
    const deps = testDeps(getDb(), owner)
    const refused = { success: false, error: "Invalid folder name" }

    expect(await renameFolder(deps, { folderId: folder.id, name: "   " })).toEqual(refused)
    expect(await renameFolder(deps, { folderId: folder.id, name: "a".repeat(101) })).toEqual(refused)
    expect(await renameFolder(deps, { folderId: `temp-${Date.now()}`, name: "new" })).toEqual(refused)
    expect((await getDb().folder.findUniqueOrThrow({ where: { id: folder.id } })).name).toBe("kept")
  })

  it("renameFolder of a folder deleted between the read and the write gives the not-found result (P2025)", async () => {
    const folder = await createTestFolder(getDb(), owner, { name: "vanishing" })
    const racing = withRowDeletedBeforeUpdate(getDb(), "folder", folder.id)

    expect(await renameFolder(testDeps(racing, owner), { folderId: folder.id, name: "too late" })).toEqual(NOT_FOUND)
    expect(await getDb().folder.count({ where: { id: folder.id } })).toBe(0)
  })

  it("renameFolder of a missing id gives the not-found result", async () => {
    expect(await renameFolder(testDeps(getDb(), owner), { folderId: randomUUID(), name: "x" })).toEqual(NOT_FOUND)
  })

  it("deleteFolder of a missing id gives the not-found result, and a temporary id is refused", async () => {
    const deps = testDeps(getDb(), owner)

    expect(await deleteFolder(deps, { folderId: randomUUID() })).toEqual(NOT_FOUND)
    expect(await deleteFolder(deps, { folderId: "temp-1" })).toEqual({ success: false, error: "Invalid folder ID" })
  })

  it("deleteFolder of an empty folder returns its id and no prompt id", async () => {
    const folder = await createTestFolder(getDb(), owner, { name: "empty" })

    expect(dataOf(await deleteFolder(testDeps(getDb(), owner), { folderId: folder.id }))).toEqual({
      folderIds: [folder.id],
      promptIds: [],
    })
    expect(await getDb().folder.count({ where: { id: folder.id } })).toBe(0)
  })

  it("getRootFolders and getFolderChildren list the caller's folders by name", async () => {
    const user = await newUser()
    const b = await createTestFolder(getDb(), user, { name: "b" })
    const a = await createTestFolder(getDb(), user, { name: "a" })
    const a2 = await createTestFolder(getDb(), user, { name: "a2", parentId: a.id })
    const a1 = await createTestFolder(getDb(), user, { name: "a1", parentId: a.id })
    const deps = testDeps(getDb(), user)
    const ids = (folders: Folder[]) => folders.map((f) => f.id)

    expect(ids(dataOf(await getRootFolders(deps, undefined)))).toEqual([a.id, b.id])
    expect(ids(dataOf(await getFolderChildren(deps, { parentId: a.id })))).toEqual([a1.id, a2.id])
    expect(dataOf(await getFolderChildren(deps, { parentId: b.id }))).toEqual([])
  })

  it("getRootFolders refuses an argument and getFolderChildren a temporary id", async () => {
    const deps = testDeps(getDb(), owner)

    expect(await getRootFolders(deps, { userId: owner })).toEqual({ success: false, error: "Invalid input data" })
    expect(await getFolderChildren(deps, { parentId: "temp-1" })).toEqual({
      success: false,
      error: "Invalid folder ID",
    })
  })

  it("the 31st folder mutation of a minute is refused while reads go on", async () => {
    const user = await newUser()
    const folder = await createTestFolder(getDb(), user, { name: "limited" })
    const deps = testDeps(getDb(), user)

    for (let i = 1; i <= 30; i++) {
      expect(dataOf(await renameFolder(deps, { folderId: folder.id, name: `name ${i}` })).name).toBe(`name ${i}`)
    }

    expect(await renameFolder(deps, { folderId: folder.id, name: "name 31" })).toEqual({
      success: false,
      error: "Too many requests. Please slow down.",
    })
    expect(await createFolder(deps, { name: "refused", parentId: null })).toEqual({
      success: false,
      error: "Too many requests. Please slow down.",
    })
    expect((await getDb().folder.findUniqueOrThrow({ where: { id: folder.id } })).name).toBe("name 30")
    expect(dataOf(await getRootFolders(deps, undefined)).map((f) => f.id)).toEqual([folder.id])
  })
})
