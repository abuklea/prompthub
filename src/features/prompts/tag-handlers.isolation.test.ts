/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/tag-handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:08 GMT+10
Last modified: 29/10/2026 21:08 GMT+10
---------------
The tenant boundary of the tag handlers against a real Postgres (skipped without TEST_DATABASE_URL). User B calls each
handler with user A's ids: the result equals what a missing id returns, so B cannot tell A's rows from absent ones, and
A's tags and prompts, with the links between them, read back unchanged. Each test is titled "<action>: user B ..." for
the isolation coverage rule.

Changelog:
29/10/2026 21:08 GMT+10 | Created (P7S2T7, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeAll, expect, it } from "vitest"
import type { Folder, Prompt, Tag } from "@prisma/client"
import { testDeps } from "@/test/action-deps"
import {
  createTestFolder,
  createTestPrompt,
  createTestTag,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "@/test/db"
import * as handlers from "./tag-handlers"

const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }
const INVALID_TAGS = { success: false, error: "One or more tags are invalid" }

describeDb("tag handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let folderA: Folder
  let promptA: Prompt
  let promptB: Prompt
  let tagA: Tag
  let tagB: Tag
  let snapshotOfA: unknown

  /** User A's tags and prompts, each with the ids it links to, as stored, in a stable order. */
  async function rowsOfA(): Promise<unknown> {
    const db = getDb()
    return {
      tags: await db.tag.findMany({
        where: { user_id: userA },
        include: { prompts: { select: { id: true }, orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      }),
      prompts: await db.prompt.findMany({
        where: { user_id: userA },
        include: { tags: { select: { id: true }, orderBy: { id: "asc" } } },
        orderBy: { id: "asc" },
      }),
    }
  }

  /** The ids of the tags linked to one of B's prompts. */
  async function tagIdsOfB(promptId: string): Promise<string[]> {
    const prompt = await getDb().prompt.findUniqueOrThrow({ where: { id: promptId }, include: { tags: true } })
    return prompt.tags.map((t) => t.id)
  }

  const asB = () => testDeps(getDb(), userB)

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    folderA = await createTestFolder(db, userA, { name: "A's folder" })
    promptA = await createTestPrompt(db, userA, { folderId: folderA.id, title: "A's prompt" })
    tagA = await createTestTag(db, userA, { name: "Shared name" })
    await createTestTag(db, userA, { name: "A only" })
    await db.prompt.update({ where: { id: promptA.id }, data: { tags: { connect: [{ id: tagA.id }] } } })
    promptB = await createTestPrompt(db, userB, { title: "B's prompt" })
    tagB = await createTestTag(db, userB, { name: "B's tag" })
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

  it("getTags: user B listing tags gets only B's, and user A's folder gives the missing-folder result", async () => {
    const all = await handlers.getTags(asB(), {})
    const foreign = await handlers.getTags(asB(), { folderId: folderA.id })
    const missing = await handlers.getTags(asB(), { folderId: randomUUID() })

    if (!all.success) throw new Error(all.error)
    expect(all.data.map((t) => t.id)).toEqual([tagB.id])
    expect(foreign).toEqual({ success: true, data: [] })
    expect(foreign).toEqual(missing)
  })

  it("createTag: user B creating a tag with the name of user A's tag gets a new tag of B's own", async () => {
    const result = await handlers.createTag(asB(), { name: "Shared name" })
    const otherCase = await handlers.createTag(asB(), { name: "SHARED NAME" })

    if (!result.success) throw new Error(result.error)
    expect(result.data.id).not.toBe(tagA.id)
    expect(result.data.name).toBe("Shared name")
    expect(otherCase).toEqual(result)
    expect(await getDb().tag.findUniqueOrThrow({ where: { id: result.data.id } })).toMatchObject({ user_id: userB })
    expect(await getDb().tag.findUniqueOrThrow({ where: { id: tagA.id } })).toEqual(tagA)
  })

  it("assignTagsToPrompt: user B tagging or clearing user A's prompt gets the missing-prompt result", async () => {
    const tagged = await handlers.assignTagsToPrompt(asB(), { promptId: promptA.id, tagIds: [tagB.id] })
    const cleared = await handlers.assignTagsToPrompt(asB(), { promptId: promptA.id, tagIds: [] })
    const missing = await handlers.assignTagsToPrompt(asB(), { promptId: randomUUID(), tagIds: [tagB.id] })

    expect(tagged).toEqual(NOT_FOUND)
    expect(cleared).toEqual(NOT_FOUND)
    expect(tagged).toEqual(missing)
  })

  it("assignTagsToPrompt: user B assigning user A's tag to B's prompt gets the unknown-tag result", async () => {
    const foreign = await handlers.assignTagsToPrompt(asB(), { promptId: promptB.id, tagIds: [tagB.id, tagA.id] })
    const missing = await handlers.assignTagsToPrompt(asB(), { promptId: promptB.id, tagIds: [tagB.id, randomUUID()] })

    expect(foreign).toEqual(INVALID_TAGS)
    expect(foreign).toEqual(missing)
    expect(await tagIdsOfB(promptB.id)).toEqual([])
  })
})
