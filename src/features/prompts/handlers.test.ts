/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:46 GMT+10
Last modified: 29/10/2026 20:46 GMT+10
---------------
Behaviour of the prompt CRUD and listing handlers and of the search function against a real Postgres (skipped without
TEST_DATABASE_URL): creating in an owned folder, the duplicate-title and null-title rules, the rename title rules,
details without a tags field, the validate bound, and listing with and without a search query. The tenant boundary is
tested in handlers.isolation.test.ts.

Changelog:
29/10/2026 20:46 GMT+10 | Created (P7S2T6, issue #114)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { signedOutDeps, testDeps } from "@/test/action-deps"
import {
  createTestFolder,
  createTestPrompt,
  createTestTag,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "@/test/db"
import * as handlers from "./handlers"
import { searchPrompts } from "./search-handlers"

describeDb("prompt handlers", () => {
  const getDb = useTestDatabase()
  const users: string[] = []

  /** A fresh user, deleted in afterAll. Each group has its own, so no group nears the 30-per-minute limit. */
  async function newUser(): Promise<string> {
    const id = (await createTestUser(getDb())).id
    users.push(id)
    return id
  }

  afterAll(async () => {
    for (const id of users) await deleteTestUser(getDb(), id)
  })

  describe("createPrompt", () => {
    let userId = ""
    let folderId = ""

    beforeAll(async () => {
      userId = await newUser()
      folderId = (await createTestFolder(getDb(), userId)).id
    })

    it("createPrompt: creates an untitled prompt in an owned folder and stores a null title", async () => {
      const result = await handlers.createPrompt(testDeps(getDb(), userId), { folderId })

      if (!result.success) throw new Error(result.error)
      expect(result.data).toMatchObject({ user_id: userId, folder_id: folderId, title: null, content: "", tags: [] })
      const row = await getDb().prompt.findUniqueOrThrow({ where: { id: result.data.id } })
      expect([row.user_id, row.folder_id, row.title, row.content]).toEqual([userId, folderId, null, ""])
    })

    it("createPrompt: stores a custom title in an owned folder", async () => {
      const result = await handlers.createPrompt(testDeps(getDb(), userId), { folderId, title: "Quarterly plan" })

      if (!result.success) throw new Error(result.error)
      const row = await getDb().prompt.findUniqueOrThrow({ where: { id: result.data.id } })
      expect(row.title).toBe("Quarterly plan")
    })

    it("createPrompt: rejects a title the folder holds in another case and creates nothing", async () => {
      await createTestPrompt(getDb(), userId, { folderId, title: "Weekly Report" })
      const before = await getDb().prompt.count({ where: { folder_id: folderId } })

      const result = await handlers.createPrompt(testDeps(getDb(), userId), { folderId, title: "WEEKLY report" })

      expect(result).toEqual({
        success: false,
        error: 'A document named "WEEKLY report" already exists in this folder. Please choose a different title.',
      })
      expect(await getDb().prompt.count({ where: { folder_id: folderId } })).toBe(before)
    })

    it("createPrompt: allows a title that exists only in another folder", async () => {
      const other = await createTestFolder(getDb(), userId, { name: "other" })
      await createTestPrompt(getDb(), userId, { folderId: other.id, title: "Shared name" })

      const result = await handlers.createPrompt(testDeps(getDb(), userId), { folderId, title: "Shared name" })

      expect(result.success).toBe(true)
    })

    it("createPrompt: refuses invalid input and a signed-out caller", async () => {
      expect(await handlers.createPrompt(testDeps(getDb(), userId), { folderId: "not-a-uuid" })).toEqual({
        success: false,
        error: "Invalid input data",
      })
      expect(await handlers.createPrompt(signedOutDeps(getDb()), { folderId })).toEqual({
        success: false,
        error: "Unauthorized. Please sign in.",
      })
    })
  })

  describe("getPromptDetails", () => {
    it("getPromptDetails: returns the caller's prompt with its folder and no tags field", async () => {
      const userId = await newUser()
      const folder = await createTestFolder(getDb(), userId, { name: "Drafts" })
      const prompt = await createTestPrompt(getDb(), userId, { folderId: folder.id, title: "T", content: "body" })

      const result = await handlers.getPromptDetails(testDeps(getDb(), userId), { promptId: prompt.id })

      if (!result.success) throw new Error(result.error)
      expect(result.data).toMatchObject({ id: prompt.id, title: "T", content: "body" })
      expect(result.data.folder).toEqual({ id: folder.id, name: "Drafts" })
      expect("tags" in result.data).toBe(false)
    })

    it("getPromptDetails: refuses an invalid id and reports a missing one as not found", async () => {
      const deps = testDeps(getDb(), await newUser())
      expect(await handlers.getPromptDetails(deps, { promptId: "x" })).toEqual({
        success: false,
        error: "Invalid prompt ID",
      })
      expect(await handlers.getPromptDetails(deps, { promptId: randomUUID() })).toEqual({
        success: false,
        error: "Prompt not found",
      })
    })
  })

  describe("renamePrompt", () => {
    let userId = ""
    let promptId = ""

    beforeAll(async () => {
      userId = await newUser()
      const folder = await createTestFolder(getDb(), userId)
      promptId = (await createTestPrompt(getDb(), userId, { folderId: folder.id, title: "Original" })).id
      await createTestPrompt(getDb(), userId, { folderId: folder.id, title: "Taken" })
    })

    const titleOf = async () => (await getDb().prompt.findUniqueOrThrow({ where: { id: promptId } })).title

    it.each([
      ["an empty title", ""],
      ["a blank title", "   "],
      ["a 201-character title", "x".repeat(201)],
      ["a placeholder title", "[Untitled Doc]"],
      ["a numbered placeholder title in another case", "  [untitled doc 7]  "],
    ])("renamePrompt: refuses %s and changes nothing", async (_label, newTitle) => {
      expect(await handlers.renamePrompt(testDeps(getDb(), userId), { promptId, newTitle })).toEqual({
        success: false,
        error: "Invalid title",
      })
      expect(await titleOf()).toBe("Original")
    })

    it("renamePrompt: refuses a duplicate title in the folder case-insensitively", async () => {
      expect(await handlers.renamePrompt(testDeps(getDb(), userId), { promptId, newTitle: "taken" })).toEqual({
        success: false,
        error: 'A document named "taken" already exists in this folder.',
      })
      expect(await titleOf()).toBe("Original")
    })

    it("renamePrompt: trims the title it stores, and accepts 200 characters", async () => {
      const deps = testDeps(getDb(), userId)
      expect(await handlers.renamePrompt(deps, { promptId, newTitle: "  Renamed  " })).toEqual({
        success: true,
        data: undefined,
      })
      expect(await titleOf()).toBe("Renamed")

      expect((await handlers.renamePrompt(deps, { promptId, newTitle: "y".repeat(200) })).success).toBe(true)
      expect(await titleOf()).toBe("y".repeat(200))
    })

    it("renamePrompt: reports a missing prompt as not found", async () => {
      expect(await handlers.renamePrompt(testDeps(getDb(), userId), { promptId: randomUUID(), newTitle: "N" })).toEqual(
        { success: false, error: "Prompt not found" },
      )
    })
  })

  describe("deletePrompt", () => {
    it("deletePrompt: deletes the caller's prompt, then reports it as not found", async () => {
      const userId = await newUser()
      const prompt = await createTestPrompt(getDb(), userId)
      const deps = testDeps(getDb(), userId)

      expect(await handlers.deletePrompt(deps, { promptId: prompt.id })).toEqual({ success: true, data: undefined })
      expect(await getDb().prompt.findUnique({ where: { id: prompt.id } })).toBeNull()
      expect(await handlers.deletePrompt(deps, { promptId: prompt.id })).toEqual({
        success: false,
        error: "Prompt not found or access denied",
      })
      expect(await handlers.deletePrompt(deps, { promptId: "x" })).toEqual({
        success: false,
        error: "Invalid prompt ID",
      })
    })
  })

  describe("validatePrompts", () => {
    it("validatePrompts: refuses 201 ids", async () => {
      const promptIds = Array.from({ length: 201 }, () => randomUUID())
      expect(await handlers.validatePrompts(testDeps(getDb(), await newUser()), { promptIds })).toEqual({
        success: false,
        error: "Invalid prompt list",
      })
    })

    it("validatePrompts: returns the caller's ids and ignores unknown and non-uuid strings", async () => {
      const userId = await newUser()
      const prompt = await createTestPrompt(getDb(), userId)
      const promptIds = [prompt.id, randomUUID(), "stale-tab-id"]

      expect(await handlers.validatePrompts(testDeps(getDb(), userId), { promptIds })).toEqual({
        success: true,
        data: { validIds: [prompt.id] },
      })
    })
  })

  describe("getPromptsByFolder and searchPrompts", () => {
    let userId = ""
    let folderId = ""
    let zebraId = ""
    let plainId = ""
    let tagId = ""

    beforeAll(async () => {
      const db = getDb()
      userId = await newUser()
      folderId = (await createTestFolder(db, userId)).id
      const elsewhere = await createTestFolder(db, userId, { name: "elsewhere" })
      tagId = (await createTestTag(db, userId)).id
      zebraId = (await createTestPrompt(db, userId, { folderId, title: "b zebra", content: "striped zebra notes" })).id
      plainId = (await createTestPrompt(db, userId, { folderId, title: "a plain", content: "ordinary notes" })).id
      await createTestPrompt(db, userId, { folderId: elsewhere.id, title: "c zebra", content: "zebra elsewhere" })
      await db.prompt.update({ where: { id: plainId }, data: { tags: { set: [{ id: tagId }] } } })
    })

    const idsOf = (result: Awaited<ReturnType<typeof handlers.getPromptsByFolder>>) => {
      if (!result.success) throw new Error(result.error)
      return result.data.map((p) => p.id)
    }

    it("getPromptsByFolder: lists the folder's prompts by title with their tags", async () => {
      const result = await handlers.getPromptsByFolder(testDeps(getDb(), userId), { folderId })

      expect(idsOf(result)).toEqual([plainId, zebraId])
      if (!result.success) throw new Error(result.error)
      expect(result.data[0].tags).toEqual([{ id: tagId, name: expect.any(String) }])
    })

    it("getPromptsByFolder: filters by tag, and treats a blank query as none", async () => {
      const deps = testDeps(getDb(), userId)
      expect(idsOf(await handlers.getPromptsByFolder(deps, { folderId, tagIds: [tagId] }))).toEqual([plainId])
      expect(idsOf(await handlers.getPromptsByFolder(deps, { folderId, query: "   " }))).toEqual([plainId, zebraId])
    })

    it("getPromptsByFolder: with a query delegates to the search, within the folder", async () => {
      const deps = testDeps(getDb(), userId)
      expect(idsOf(await handlers.getPromptsByFolder(deps, { folderId, query: "  zebra " }))).toEqual([zebraId])
      expect(idsOf(await handlers.getPromptsByFolder(deps, { folderId, query: "notes", tagIds: [tagId] }))).toEqual([
        plainId,
      ])
    })

    it("getPromptsByFolder: refuses an invalid folder id", async () => {
      expect(await handlers.getPromptsByFolder(testDeps(getDb(), userId), { folderId: "x" })).toEqual({
        success: false,
        error: "Invalid folder ID",
      })
    })

    it("searchPrompts: searches every folder without a folder id, newest first", async () => {
      const found = await searchPrompts(getDb(), userId, { query: "zebra" })
      expect(found.map((p) => p.title)).toEqual(["c zebra", "b zebra"])
    })

    it("searchPrompts: returns nothing for an unparsable input, a query with no word, or no match", async () => {
      const db = getDb()
      expect(await searchPrompts(db, userId, { query: "" })).toEqual([])
      expect(await searchPrompts(db, userId, { query: "!!! ???" })).toEqual([])
      expect(await searchPrompts(db, userId, { query: "giraffe" })).toEqual([])
    })
  })
})
