/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/service.restore.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 22/10/2026 08:51 GMT+10
Last modified: 22/10/2026 09:06 GMT+10
---------------
Tests for restoreVersion and listVersions against a real Postgres (skipped without TEST_DATABASE_URL): a restore
records the working copy when history does not hold it, then the restored state, returns the restored title and
content, never loses autosaved text, and is scoped to the owner; the history is ordered by id and capped at 50.

Changelog:
22/10/2026 09:06 GMT+10 | The failing-transaction seam moved to src/test/failing-db.ts, shared with the save suite
22/10/2026 08:54 GMT+10 | One case added after a mutation check let M10 survive: the newest version is the highest id
                         even when created_at says otherwise
22/10/2026 08:51 GMT+10 | Created (P7S1T3)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { createTestPrompt, createTestUser, describeDb, useTestDatabase } from "@/test/db"
import { withFailingVersionCreate } from "@/test/failing-db"
import { autoSaveDocument, listVersions, restoreVersion, saveVersion } from "./service"

const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }
const VERSION_NOT_FOUND = { success: false, error: "Version not found" }

type Pair = [string | null, string]

/** The history of a prompt as [title, content] pairs, newest (highest id) first, read directly. */
async function history(db: PrismaClient, promptId: string): Promise<Pair[]> {
  const versions = await db.promptVersion.findMany({ where: { prompt_id: promptId }, orderBy: { id: "desc" } })
  return versions.map((v) => [v.title_snapshot, v.content_snapshot])
}

/** The prompt row's [title, content]. */
async function rowOf(db: PrismaClient, promptId: string): Promise<Pair> {
  const row = await db.prompt.findUniqueOrThrow({ where: { id: promptId } })
  return [row.title, row.content]
}

/** Save a state through saveVersion and return the id of the version holding it. */
async function save(db: PrismaClient, userId: string, promptId: string, title: string, content: string) {
  const result = await saveVersion(db, userId, { promptId, newTitle: title, newContent: content })
  if (!result.success) throw new Error(`save failed: ${result.error}`)
  return result.data.versionId
}

/** The [title, content] pairs listVersions returns; fails the test with the error otherwise. */
async function listed(db: PrismaClient, userId: string, promptId: string): Promise<Pair[]> {
  const result = await listVersions(db, userId, { promptId })
  if (!result.success) throw new Error(`list failed: ${result.error}`)
  return result.data.map((v) => [v.title_snapshot, v.content_snapshot])
}

describeDb("editor service: restore and history", () => {
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

  it("snapshots a working copy that history lacks, then records the restored state, and returns it", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "B", content: "b" })

    const result = await restoreVersion(db, owner, { promptId: prompt.id, versionId: a })

    expect(result).toEqual({ success: true, data: { title: "A", content: "a" } })
    expect(await rowOf(db, prompt.id)).toEqual(["A", "a"])
    expect(await history(db, prompt.id)).toEqual([["A", "a"], ["B", "b"], ["A", "a"]])
    expect(await listed(db, owner, prompt.id)).toEqual([["A", "a"], ["B", "b"], ["A", "a"]])
  })

  it("adds no snapshot when the working copy equals the newest version", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")
    await save(db, owner, prompt.id, "B", "b")

    const result = await restoreVersion(db, owner, { promptId: prompt.id, versionId: a })

    expect(result).toEqual({ success: true, data: { title: "A", content: "a" } })
    expect(await history(db, prompt.id)).toEqual([["A", "a"], ["B", "b"], ["A", "a"]])
  })

  it("restoring the newest version when the working copy equals it adds nothing", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")

    const result = await restoreVersion(db, owner, { promptId: prompt.id, versionId: a })

    expect(result).toEqual({ success: true, data: { title: "A", content: "a" } })
    expect(await rowOf(db, prompt.id)).toEqual(["A", "a"])
    expect(await history(db, prompt.id)).toEqual([["A", "a"]])
  })

  it("restoring the newest version over a changed working copy adds the snapshot and the restored state", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    await save(db, owner, prompt.id, "A", "a")
    const b = await save(db, owner, prompt.id, "B", "b")
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "C", content: "c" })

    const result = await restoreVersion(db, owner, { promptId: prompt.id, versionId: b })

    expect(result).toEqual({ success: true, data: { title: "B", content: "b" } })
    expect(await rowOf(db, prompt.id)).toEqual(["B", "b"])
    expect(await history(db, prompt.id)).toEqual([["B", "b"], ["C", "c"], ["B", "b"], ["A", "a"]])
  })

  it("restore then autosave keeps the restored text plus the edit, and the autosave leaves history alone", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")
    await save(db, owner, prompt.id, "B", "b")

    await restoreVersion(db, owner, { promptId: prompt.id, versionId: a })
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "A", content: "a edited" })

    expect(await rowOf(db, prompt.id)).toEqual(["A", "a edited"])
    expect(await history(db, prompt.id)).toEqual([["A", "a"], ["B", "b"], ["A", "a"]])
  })

  it("autosave then restore keeps the autosaved text in history", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")
    await save(db, owner, prompt.id, "B", "b")
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "B", content: "autosaved" })

    await restoreVersion(db, owner, { promptId: prompt.id, versionId: a })

    expect(await rowOf(db, prompt.id)).toEqual(["A", "a"])
    expect(await history(db, prompt.id)).toEqual([["A", "a"], ["B", "autosaved"], ["B", "b"], ["A", "a"]])
  })

  it("a restore and an autosave started together never lose the autosaved text", async () => {
    const db = getDb()
    for (let run = 0; run < 5; run += 1) {
      const prompt = await createTestPrompt(db, owner)
      const a = await save(db, owner, prompt.id, "A", "a")
      await save(db, owner, prompt.id, "B", "b")

      const [restored, autosaved] = await Promise.all([
        restoreVersion(db, owner, { promptId: prompt.id, versionId: a }),
        autoSaveDocument(db, owner, { promptId: prompt.id, title: "B", content: "autosaved" }),
      ])

      expect(restored.success).toBe(true)
      expect(autosaved.success).toBe(true)
      const [, content] = await rowOf(db, prompt.id)
      const kept = content === "autosaved" || (await history(db, prompt.id)).some(([, c]) => c === "autosaved")
      expect(kept).toBe(true)
    }
  })

  it("takes the highest id as the newest version even when created_at says otherwise", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner, { title: "B", content: "b" })
    // Reason: the older id gets the later created_at, so a newest-by-created_at lookup picks A and snapshots B again.
    const later = new Date(Date.UTC(2026, 1))
    const earlier = new Date(Date.UTC(2026, 0))
    const older = await db.promptVersion.create({
      data: { prompt_id: prompt.id, title_snapshot: "A", content_snapshot: "a", created_at: later },
    })
    await db.promptVersion.create({
      data: { prompt_id: prompt.id, title_snapshot: "B", content_snapshot: "b", created_at: earlier },
    })

    await restoreVersion(db, owner, { promptId: prompt.id, versionId: older.id })

    expect(await history(db, prompt.id)).toEqual([["A", "a"], ["B", "b"], ["A", "a"]])
  })

  it("compares titles strictly: a null working title differs from an empty version title", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner, { title: null, content: "c" })
    const first = await db.promptVersion.create({
      data: { prompt_id: prompt.id, title_snapshot: null, content_snapshot: "draft" },
    })
    await db.promptVersion.create({ data: { prompt_id: prompt.id, title_snapshot: "", content_snapshot: "c" } })

    const result = await restoreVersion(db, owner, { promptId: prompt.id, versionId: first.id })

    expect(result).toEqual({ success: true, data: { title: null, content: "draft" } })
    expect(await rowOf(db, prompt.id)).toEqual([null, "draft"])
    expect(await history(db, prompt.id)).toEqual([[null, "draft"], [null, "c"], ["", "c"], [null, "draft"]])
  })

  it("user B cannot restore or list user A's history, and nothing changes", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "Mine", content: "mine" })
    const rowBefore = await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })
    const historyBefore = await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })

    expect(await restoreVersion(db, other, { promptId: prompt.id, versionId: a })).toEqual(NOT_FOUND)
    expect(await listVersions(db, other, { promptId: prompt.id })).toEqual(NOT_FOUND)

    expect(await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).toEqual(rowBefore)
    expect(await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })).toEqual(
      historyBefore,
    )
  })

  it("an unknown prompt returns not found for restore and list", async () => {
    const db = getDb()
    const promptId = randomUUID()

    expect(await restoreVersion(db, owner, { promptId, versionId: 1 })).toEqual(NOT_FOUND)
    expect(await listVersions(db, owner, { promptId })).toEqual(NOT_FOUND)
    expect(await db.promptVersion.count({ where: { prompt_id: promptId } })).toBe(0)
  })

  it("a version of another prompt returns not found and writes nothing", async () => {
    const db = getDb()
    const source = await createTestPrompt(db, owner)
    const foreign = await save(db, owner, source.id, "Elsewhere", "elsewhere")
    const target = await createTestPrompt(db, owner, { title: "Target", content: "unsaved" })
    const rowBefore = await db.prompt.findUniqueOrThrow({ where: { id: target.id } })

    expect(await restoreVersion(db, owner, { promptId: target.id, versionId: foreign })).toEqual(VERSION_NOT_FOUND)

    expect(await db.prompt.findUniqueOrThrow({ where: { id: target.id } })).toEqual(rowBefore)
    expect(await history(db, target.id)).toEqual([])
    expect(await history(db, source.id)).toEqual([["Elsewhere", "elsewhere"]])
  })

  it("a failure of the last write inside the transaction leaves the row and the history unchanged", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const a = await save(db, owner, prompt.id, "A", "a")
    await save(db, owner, prompt.id, "B", "b")
    await autoSaveDocument(db, owner, { promptId: prompt.id, title: "X", content: "x" })
    const rowBefore = await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })
    const historyBefore = await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })

    await expect(
      restoreVersion(withFailingVersionCreate(db, 2), owner, { promptId: prompt.id, versionId: a }),
    ).rejects.toThrow("injected failure")

    expect(await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).toEqual(rowBefore)
    expect(await db.promptVersion.findMany({ where: { prompt_id: prompt.id }, orderBy: { id: "desc" } })).toEqual(
      historyBefore,
    )
  })

  it("lists versions by id descending, capped at 50, whatever their created_at says", async () => {
    const db = getDb()
    const prompt = await createTestPrompt(db, owner)
    const base = Date.UTC(2026, 0, 1)
    // Reason: each later id gets an earlier created_at, so an order by created_at returns the oldest ids first.
    for (let i = 0; i < 55; i += 1) {
      await db.promptVersion.create({
        data: {
          prompt_id: prompt.id,
          title_snapshot: `T${i}`,
          content_snapshot: `c${i}`,
          created_at: new Date(base - i * 60_000),
        },
      })
    }
    const all = await db.promptVersion.findMany({
      where: { prompt_id: prompt.id },
      select: { id: true, created_at: true, title_snapshot: true, content_snapshot: true },
      orderBy: { id: "desc" },
    })
    const byCreatedAt = [...all].sort((x, y) => y.created_at.getTime() - x.created_at.getTime())
    expect(byCreatedAt.slice(0, 50)).not.toEqual(all.slice(0, 50))

    expect(await listVersions(db, owner, { promptId: prompt.id })).toEqual({ success: true, data: all.slice(0, 50) })
  })
})
