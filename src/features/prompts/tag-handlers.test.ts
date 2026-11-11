/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/tag-handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:08 GMT+10
Last modified: 29/10/2026 21:08 GMT+10
---------------
Tests for the tag handlers against a real Postgres (skipped without TEST_DATABASE_URL): getTags lists the caller's tags
by name, optionally only those on a folder's prompts; createTag trims, returns the existing tag for a case-insensitive
duplicate and survives two parallel creates of one name through its P2002 recovery; assignTagsToPrompt sets a
de-duplicated list of the caller's tags, and a prompt deleted between its reads and its write gives the not-found text.
The tag mutations share the mutation limit; getTags has none.

Changelog:
29/10/2026 21:08 GMT+10 | Created (P7S2T7, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
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
import { withRowDeletedBeforeUpdate } from "@/test/racing-db"
import * as handlers from "./tag-handlers"

const TOO_MANY = { success: false, error: "Too many requests. Please slow down." }
const UNAUTHORIZED = { success: false, error: "Unauthorized. Please sign in." }
const INVALID = { success: false, error: "Invalid input data" }
const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }
const CREATE_FAILED = { success: false, error: "Failed to create tag" }
const OK = { success: true, data: undefined }

type CreateArgs = Prisma.TagCreateArgs

/**
 * A client whose `tag.create` is replaced by `create`, given the real delegate; every other call reaches the database.
 * This is an injected seam over the real client, not a module mock.
 */
function withTagCreate(db: PrismaClient, create: (real: PrismaClient["tag"], args: CreateArgs) => Promise<unknown>) {
  const tag = new Proxy(db.tag, {
    get(target, name) {
      const member = Reflect.get(target, name)
      if (name === "create") return (args: CreateArgs) => create(target, args)
      return typeof member === "function" ? member.bind(target) : member
    },
  })
  return new Proxy(db, {
    get(target, key) {
      if (key === "tag") return tag
      const value = Reflect.get(target, key)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

/**
 * A client whose `tag.create` calls wait until `count` of them have started, so every caller has passed its lookup
 * before any insert runs. `outcomes` records "created" or the Prisma error code of each insert.
 */
function withTagCreateBarrier(db: PrismaClient, count: number) {
  const outcomes: string[] = []
  let arrived = 0
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const client = withTagCreate(db, async (real, args) => {
    arrived += 1
    if (arrived === count) release()
    await gate
    try {
      const row = await real.create(args)
      outcomes.push("created")
      return row
    } catch (error) {
      outcomes.push(error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "other")
      throw error
    }
  })
  return { client, outcomes }
}

/** The ids of a prompt's tags, sorted. */
async function tagIdsOf(db: PrismaClient, promptId: string): Promise<string[]> {
  const prompt = await db.prompt.findUniqueOrThrow({ where: { id: promptId }, include: { tags: true } })
  return prompt.tags.map((t) => t.id).sort()
}

describeDb("tag handlers", () => {
  const getDb = useTestDatabase()
  const users: string[] = []

  /** A fresh user, so that no two tests share a limiter bucket. */
  async function freshUser(): Promise<string> {
    const id = (await createTestUser(getDb())).id
    users.push(id)
    return id
  }

  let owner = ""
  const asOwner = () => testDeps(getDb(), owner)

  beforeAll(async () => {
    owner = await freshUser()
  })

  afterAll(async () => {
    for (const id of users) await deleteTestUser(getDb(), id)
  })

  describe("getTags", () => {
    let alpha = ""
    let beta = ""
    let gamma = ""
    let folderOne = ""
    let lister = ""
    const asLister = () => testDeps(getDb(), lister)

    beforeAll(async () => {
      const db = getDb()
      lister = await freshUser()
      gamma = (await createTestTag(db, lister, { name: "gamma" })).id
      alpha = (await createTestTag(db, lister, { name: "alpha" })).id
      beta = (await createTestTag(db, lister, { name: "beta" })).id
      folderOne = (await createTestFolder(db, lister)).id
      const folderTwo = (await createTestFolder(db, lister)).id
      const inOne = await createTestPrompt(db, lister, { folderId: folderOne })
      const inTwo = await createTestPrompt(db, lister, { folderId: folderTwo })
      await db.prompt.update({ where: { id: inOne.id }, data: { tags: { connect: [{ id: alpha }] } } })
      await db.prompt.update({ where: { id: inTwo.id }, data: { tags: { connect: [{ id: beta }] } } })
    })

    it("getTags: lists the caller's tags by name", async () => {
      const result = await handlers.getTags(asLister(), {})

      if (!result.success) throw new Error(result.error)
      expect(result.data.map((t) => [t.id, t.name])).toEqual([[alpha, "alpha"], [beta, "beta"], [gamma, "gamma"]])
    })

    it("getTags: with a folder id lists only the tags on that folder's prompts", async () => {
      const result = await handlers.getTags(asLister(), { folderId: folderOne })

      if (!result.success) throw new Error(result.error)
      expect(result.data.map((t) => t.id)).toEqual([alpha])
    })

    it("getTags: refuses an invalid folder id and a signed-out caller", async () => {
      expect(await handlers.getTags(asLister(), { folderId: "not-a-uuid" })).toEqual(INVALID)
      expect(await handlers.getTags(signedOutDeps(getDb()), {})).toEqual(UNAUTHORIZED)
    })
  })

  describe("createTag", () => {
    it("createTag: creates a tag with the trimmed name, then returns it for a duplicate in another case", async () => {
      const db = getDb()
      const created = await handlers.createTag(asOwner(), { name: "  Work  " })
      if (!created.success) throw new Error(created.error)
      expect(created.data.name).toBe("Work")

      const duplicate = await handlers.createTag(asOwner(), { name: "WORK" })

      expect(duplicate).toEqual({ success: true, data: { id: created.data.id, name: "Work" } })
      expect(await db.tag.count({ where: { user_id: owner, name: { equals: "work", mode: "insensitive" } } })).toBe(1)
    })

    it("createTag: two parallel creates of one name in two cases return one tag through the P2002 path", async () => {
      const db = getDb()
      const userId = await freshUser()
      const { client, outcomes } = withTagCreateBarrier(db, 2)
      const deps = testDeps(client, userId)

      const [first, second] = await Promise.all([
        handlers.createTag(deps, { name: "Urgent" }),
        handlers.createTag(deps, { name: "urgent" }),
      ])

      if (!first.success || !second.success) throw new Error(`a create failed: ${JSON.stringify([first, second])}`)
      expect(second.data).toEqual(first.data)
      expect(outcomes.sort()).toEqual(["P2002", "created"])
      expect(await db.tag.count({ where: { user_id: userId } })).toBe(1)
    })

    it("createTag: refuses an empty and a 51-character name and a signed-out caller", async () => {
      expect(await handlers.createTag(asOwner(), { name: "   " })).toEqual(INVALID)
      expect(await handlers.createTag(asOwner(), { name: "n".repeat(51) })).toEqual(INVALID)
      expect(await handlers.createTag(signedOutDeps(getDb()), { name: "Signed out" })).toEqual(UNAUTHORIZED)
    })

    it("createTag: returns the failure text when the insert fails, or hits P2002 with no tag to recover", async () => {
      const db = getDb()
      const failing = withTagCreate(db, async () => {
        throw new Error("injected failure")
      })
      const conflicting = withTagCreate(db, async () => {
        throw new Prisma.PrismaClientKnownRequestError("injected conflict", { code: "P2002", clientVersion: "test" })
      })

      expect(await handlers.createTag(testDeps(failing, owner), { name: "Never stored" })).toEqual(CREATE_FAILED)
      expect(await handlers.createTag(testDeps(conflicting, owner), { name: "Never stored" })).toEqual(CREATE_FAILED)
      expect(await db.tag.count({ where: { user_id: owner, name: "Never stored" } })).toBe(0)
    })
  })

  describe("assignTagsToPrompt", () => {
    it("assignTagsToPrompt: sets the de-duplicated tags, replaces them, and clears them", async () => {
      const db = getDb()
      const promptId = (await createTestPrompt(db, owner)).id
      const [one, two, three] = await Promise.all([1, 2, 3].map(() => createTestTag(db, owner)))

      const assign = (tagIds: string[]) => handlers.assignTagsToPrompt(asOwner(), { promptId, tagIds })

      expect(await assign([one.id, two.id, one.id])).toEqual(OK)
      expect(await tagIdsOf(db, promptId)).toEqual([one.id, two.id].sort())

      expect(await assign([three.id])).toEqual(OK)
      expect(await tagIdsOf(db, promptId)).toEqual([three.id])

      expect(await assign([])).toEqual(OK)
      expect(await tagIdsOf(db, promptId)).toEqual([])
    })

    it("assignTagsToPrompt: reports a missing prompt as not found and refuses invalid input", async () => {
      expect(await handlers.assignTagsToPrompt(asOwner(), { promptId: randomUUID(), tagIds: [] })).toEqual(NOT_FOUND)
      expect(await handlers.assignTagsToPrompt(asOwner(), { promptId: "not-a-uuid", tagIds: [] })).toEqual(INVALID)
      const tooMany = Array.from({ length: 21 }, () => randomUUID())
      expect(await handlers.assignTagsToPrompt(asOwner(), { promptId: randomUUID(), tagIds: tooMany })).toEqual(INVALID)
      expect(await handlers.assignTagsToPrompt(signedOutDeps(getDb()), { promptId: randomUUID(), tagIds: [] }))
        .toEqual(UNAUTHORIZED)
    })

    it("assignTagsToPrompt: a prompt deleted between the reads and the write gives the not-found text", async () => {
      const db = getDb()
      const promptId = (await createTestPrompt(db, owner)).id
      const tag = await createTestTag(db, owner)
      const racing = withRowDeletedBeforeUpdate(db, "prompt", promptId)

      const result = await handlers.assignTagsToPrompt(testDeps(racing, owner), { promptId, tagIds: [tag.id] })

      expect(result).toEqual(NOT_FOUND)
      expect(await db.prompt.count({ where: { id: promptId } })).toBe(0)
    })
  })

  it("assignTagsToPrompt and createTag share the mutation limit; getTags has none", async () => {
    const db = getDb()
    const userId = await freshUser()
    const deps = testDeps(db, userId)
    const promptId = (await createTestPrompt(db, userId)).id

    for (let i = 0; i < 30; i += 1) {
      expect(await handlers.assignTagsToPrompt(deps, { promptId, tagIds: [] })).toEqual(OK)
    }

    expect(await handlers.createTag(deps, { name: "Over the limit" })).toEqual(TOO_MANY)
    expect(await handlers.assignTagsToPrompt(deps, { promptId, tagIds: [] })).toEqual(TOO_MANY)
    expect(await db.tag.count({ where: { user_id: userId } })).toBe(0)
    expect(await handlers.getTags(deps, {})).toEqual({ success: true, data: [] })
  })
})
