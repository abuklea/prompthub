/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/service.save.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 22/10/2026 08:41 GMT+10
Last modified: 22/10/2026 08:46 GMT+10
---------------
Tests for saveVersion and autoSaveDocument against a real Postgres (skipped without TEST_DATABASE_URL): a version is
the saved state, an unchanged save records nothing, autosave records nothing, and every write is scoped to the owner.

Changelog:
22/10/2026 08:46 GMT+10 | Three edge cases added after a mutation check let M3 to M5 survive: a title-only save, a
                         content-only save, and saving an earlier state again; two long lines wrapped
22/10/2026 08:41 GMT+10 | Created (P7S1T2)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { Prisma, PrismaClient } from "@prisma/client"
import { createTestPrompt, createTestUser, describeDb, useTestDatabase } from "@/test/db"
import { autoSaveDocument, saveVersion, type EditorDb } from "./service"

const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }

/** The history of a prompt as [title, content] pairs, newest first. */
async function history(db: PrismaClient, promptId: string): Promise<[string | null, string][]> {
  const versions = await db.promptVersion.findMany({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })
  return versions.map((v) => [v.title_snapshot, v.content_snapshot])
}

/** The title and content a version holds, read by its id. */
async function versionState(db: PrismaClient, versionId: number): Promise<[string | null, string]> {
  const v = await db.promptVersion.findUniqueOrThrow({ where: { id: versionId } })
  return [v.title_snapshot, v.content_snapshot]
}

/** The version id of a successful save; fails the test with the error otherwise. */
function versionIdOf(result: Awaited<ReturnType<typeof saveVersion>>): number {
  if (!result.success) throw new Error(`save failed: ${result.error}`)
  return result.data.versionId
}

/**
 * A db whose transactions hand the callback the real transaction client wrapped in a Proxy whose
 * promptVersion.create throws: an injected seam over the real client, not a module mock.
 */
function withFailingVersionCreate(db: PrismaClient): EditorDb {
  const wrap = (tx: Prisma.TransactionClient): Prisma.TransactionClient =>
    new Proxy(tx, {
      get(target, key) {
        const value = Reflect.get(target, key)
        if (key !== "promptVersion") return value
        return new Proxy(value, {
          get(delegate, name) {
            if (name === "create") return async () => { throw new Error("injected failure") }
            return Reflect.get(delegate, name)
          },
        })
      },
    })
  const $transaction = ((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    db.$transaction((tx) => fn(wrap(tx)))) as EditorDb["$transaction"]
  return { prompt: db.prompt, promptVersion: db.promptVersion, $transaction }
}

describeDb("editor service: save and autosave", () => {
  const getDb = useTestDatabase()
  let owner = ""
  let other = ""

  beforeAll(async () => {
    owner = (await createTestUser(getDb())).id
    other = (await createTestUser(getDb())).id
  })

  afterAll(async () => {
    for (const id of [owner, other]) {
      if (id) await getDb().profile.delete({ where: { id } })
    }
  })

  it("save A, autosave B, save C lists C then A, never B, and each version holds its saved state", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)

    const a = versionIdOf(await saveVersion(db, owner, { promptId: prompt.id, newTitle: "A", newContent: "a" }))
    expect(await autoSaveDocument(db, owner, { promptId: prompt.id, title: "B", content: "b" })).toEqual({
      success: true,
      data: undefined,
    })
    const c = versionIdOf(await saveVersion(db, owner, { promptId: prompt.id, newTitle: "C", newContent: "c" }))

    expect(await history(db, prompt.id)).toEqual([["C", "c"], ["A", "a"]])
    expect(await versionState(db, a)).toEqual(["A", "a"])
    expect(await versionState(db, c)).toEqual(["C", "c"])
    const row = await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })
    expect([row.title, row.content]).toEqual(["C", "c"])
  })

  it("returns the id of the version that holds the saved state", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner, { title: "Old", content: "old" })

    const result = await saveVersion(db, owner, { promptId: prompt.id, newTitle: "New", newContent: "new" })

    expect(result.success).toBe(true)
    expect(await versionState(db, versionIdOf(result))).toEqual(["New", "new"])
  })

  it("an identical save twice adds one version, and both saves return its id", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const input = { promptId: prompt.id, newTitle: "Same", newContent: "same" }

    const first = versionIdOf(await saveVersion(db, owner, input))
    const second = versionIdOf(await saveVersion(db, owner, input))

    expect(await history(db, prompt.id)).toEqual([["Same", "same"]])
    expect(second).toBe(first)
  })

  it("two parallel identical saves add one version", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner, { title: "Before", content: "before" })
    const input = { promptId: prompt.id, newTitle: "Same", newContent: "same" }

    const results = await Promise.all([saveVersion(db, owner, input), saveVersion(db, owner, input)])

    expect(await history(db, prompt.id)).toEqual([["Same", "same"]])
    expect(versionIdOf(results[0])).toBe(versionIdOf(results[1]))
  })

  it("a save that changes only the title adds a version", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)

    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "First", newContent: "same" })
    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "Second", newContent: "same" })

    expect(await history(db, prompt.id)).toEqual([["Second", "same"], ["First", "same"]])
  })

  it("a save that changes only the content adds a version", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)

    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "Same", newContent: "first" })
    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "Same", newContent: "second" })

    expect(await history(db, prompt.id)).toEqual([["Same", "second"], ["Same", "first"]])
  })

  it("saving an earlier state again adds a version, because only the newest version counts", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)

    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "A", newContent: "a" })
    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "B", newContent: "b" })
    await saveVersion(db, owner, { promptId: prompt.id, newTitle: "A", newContent: "a" })

    expect(await history(db, prompt.id)).toEqual([["A", "a"], ["B", "b"], ["A", "a"]])
  })

  it("a save after an autosave moved the row to the same content adds one version of the saved state", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "Draft", content: "draft" })

    const saved = { promptId: prompt.id, newTitle: "Draft", newContent: "draft" }
    const id = versionIdOf(await saveVersion(db, owner, saved))

    expect(await history(db, prompt.id)).toEqual([["Draft", "draft"]])
    expect(await versionState(db, id)).toEqual(["Draft", "draft"])
  })

  it("autosave updates the row and adds no version, including for an untitled document", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)

    await autoSaveDocument(db, owner, { promptId: prompt.id, title: null, content: "first" })
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "Titled", content: "second" })

    expect(await history(db, prompt.id)).toEqual([])
    const row = await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })
    expect([row.title, row.content]).toEqual(["Titled", "second"])
  })

  it("user B cannot save or autosave user A's prompt, and nothing changes", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner, { title: "Mine", content: "mine" })
    await db.promptVersion.create({ data: { prompt_id: prompt.id, title_snapshot: "Mine", content_snapshot: "mine" } })
    const rowBefore = await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })
    const historyBefore = await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })

    expect(await saveVersion(db, other, { promptId: prompt.id, newTitle: "Theirs", newContent: "theirs" })).toEqual(
      NOT_FOUND,
    )
    expect(await autoSaveDocument(db, other, { promptId: prompt.id, title: "Theirs", content: "theirs" })).toEqual(
      NOT_FOUND,
    )

    expect(await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).toEqual(rowBefore)
    expect(await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })).toEqual(
      historyBefore,
    )
  })

  it("an unknown prompt returns not found and records nothing", async () => {
    const db = getDb()
    const promptId = randomUUID()

    expect(await saveVersion(db, owner, { promptId, newTitle: "T", newContent: "c" })).toEqual(NOT_FOUND)
    expect(await autoSaveDocument(db, owner, { promptId, title: "T", content: "c" })).toEqual(NOT_FOUND)
    expect(await db.promptVersion.count({ where: { prompt_id: promptId } })).toBe(0)
  })

  it("a failure inside the transaction leaves the row and the history unchanged", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner, { title: "Kept", content: "kept" })
    await db.promptVersion.create({ data: { prompt_id: prompt.id, title_snapshot: "Kept", content_snapshot: "kept" } })
    const rowBefore = await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })
    const historyBefore = await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })

    await expect(
      saveVersion(withFailingVersionCreate(db), owner, { promptId: prompt.id, newTitle: "Lost", newContent: "lost" }),
    ).rejects.toThrow("injected failure")

    expect(await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).toEqual(rowBefore)
    expect(await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })).toEqual(
      historyBefore,
    )
  })
})
