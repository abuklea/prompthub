/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:47 GMT+10
Last modified: 29/10/2026 20:47 GMT+10
---------------
The tenant boundary of the prompt CRUD and listing handlers against a real Postgres (skipped without
TEST_DATABASE_URL). User B calls each handler with user A's ids: the result equals what a missing id returns, so B
cannot tell A's rows from absent ones, and A's folders and prompts read back unchanged. Each test is titled
"<action>: user B ..." for the isolation coverage rule.

Changelog:
29/10/2026 20:47 GMT+10 | Created (P7S2T6, issue #114)
*/
import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeAll, expect, it } from "vitest"
import type { Folder, Prompt } from "@prisma/client"
import { testDeps } from "@/test/action-deps"
import {
  createTestFolder,
  createTestPrompt,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "@/test/db"
import * as handlers from "./handlers"

describeDb("prompt handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let folderA: Folder
  let promptA: Prompt
  let promptB: Prompt
  let snapshotOfA: unknown

  /** Everything user A owns, and every prompt filed in A's folders whoever owns it, as stored, in a stable order. */
  async function rowsOfA(): Promise<unknown> {
    const db = getDb()
    return {
      folders: await db.folder.findMany({ where: { user_id: userA }, orderBy: { id: "asc" } }),
      prompts: await db.prompt.findMany({
        where: { OR: [{ user_id: userA }, { folder: { user_id: userA } }] },
        orderBy: { id: "asc" },
      }),
    }
  }

  const asB = () => testDeps(getDb(), userB)

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    folderA = await createTestFolder(db, userA, { name: "A's folder" })
    promptA = await createTestPrompt(db, userA, { folderId: folderA.id, title: "A secret", content: "alpha secret" })
    const folderB = await createTestFolder(db, userB, { name: "B's folder" })
    promptB = await createTestPrompt(db, userB, { folderId: folderB.id, title: "B note", content: "beta" })
    snapshotOfA = await rowsOfA()
  })

  afterEach(async () => {
    expect(await rowsOfA()).toEqual(snapshotOfA)
  })

  afterAll(async () => {
    for (const id of [userA, userB]) {
      if (id) await deleteTestUser(getDb(), id)
    }
  })

  it("createPrompt: user B creating a prompt in user A's folder gets the missing-folder result", async () => {
    const foreign = await handlers.createPrompt(asB(), { folderId: folderA.id, title: "Intruder" })
    const missing = await handlers.createPrompt(asB(), { folderId: randomUUID(), title: "Intruder" })

    expect(foreign).toEqual({ success: false, error: "Folder not found or access denied" })
    expect(foreign).toEqual(missing)
    expect(await getDb().prompt.count({ where: { folder_id: folderA.id } })).toBe(1)
    expect(await getDb().prompt.count({ where: { user_id: userB } })).toBe(1)
  })

  it("renamePrompt: user B renaming user A's prompt gets the missing-prompt result", async () => {
    const foreign = await handlers.renamePrompt(asB(), { promptId: promptA.id, newTitle: "Hijacked" })
    const missing = await handlers.renamePrompt(asB(), { promptId: randomUUID(), newTitle: "Hijacked" })

    expect(foreign).toEqual({ success: false, error: "Prompt not found" })
    expect(foreign).toEqual(missing)
  })

  it("deletePrompt: user B deleting user A's prompt gets the missing-prompt result", async () => {
    const foreign = await handlers.deletePrompt(asB(), { promptId: promptA.id })
    const missing = await handlers.deletePrompt(asB(), { promptId: randomUUID() })

    expect(foreign).toEqual({ success: false, error: "Prompt not found or access denied" })
    expect(foreign).toEqual(missing)
  })

  it("validatePrompts: user B validating a list with user A's id gets only B's ids", async () => {
    const foreign = await handlers.validatePrompts(asB(), { promptIds: [promptA.id, promptB.id] })
    const missing = await handlers.validatePrompts(asB(), { promptIds: [randomUUID(), promptB.id] })

    expect(foreign).toEqual({ success: true, data: { validIds: [promptB.id] } })
    expect(foreign).toEqual(missing)
  })

  it("getPromptDetails: user B reading user A's prompt gets the missing-prompt result and no data", async () => {
    const foreign = await handlers.getPromptDetails(asB(), { promptId: promptA.id })
    const missing = await handlers.getPromptDetails(asB(), { promptId: randomUUID() })

    expect(foreign).toEqual({ success: false, error: "Prompt not found" })
    expect(foreign).toEqual(missing)
    expect("data" in foreign || "tags" in foreign).toBe(false)
  })

  it("getPromptsByFolder: user B listing or searching user A's folder gets an empty list", async () => {
    const foreign = await handlers.getPromptsByFolder(asB(), { folderId: folderA.id })
    const missing = await handlers.getPromptsByFolder(asB(), { folderId: randomUUID() })
    const searched = await handlers.getPromptsByFolder(asB(), { folderId: folderA.id, query: "alpha secret" })

    expect(foreign).toEqual({ success: true, data: [] })
    expect(foreign).toEqual(missing)
    expect(searched).toEqual({ success: true, data: [] })
  })
})
