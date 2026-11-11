/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/history-handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:08 GMT+10
Last modified: 29/10/2026 21:08 GMT+10
---------------
Tests for the version-history handlers against a real Postgres (skipped without TEST_DATABASE_URL): the handler path
over listVersions and restoreVersion (their own cases are in src/features/editor/service.restore.test.ts), the existing
invalid-input texts, and the limits: restorePromptVersion is refused on the 31st call in a minute by the save limit,
which is independent of the shared mutation limit, and getPromptVersionHistory has no limit.

Changelog:
29/10/2026 21:08 GMT+10 | Created (P7S2T7, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { signedOutDeps, testDeps } from "@/test/action-deps"
import { createTestPrompt, createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import * as promptHandlers from "./handlers"
import * as handlers from "./history-handlers"

const TOO_MANY = { success: false, error: "Too many requests. Please slow down." }
const UNAUTHORIZED = { success: false, error: "Unauthorized. Please sign in." }
const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }
const RESTORED_ONE = { success: true, data: { title: "One", content: "one" } }

/** A prompt row's [title, content]. */
async function rowOf(db: PrismaClient, promptId: string): Promise<[string | null, string]> {
  const row = await db.prompt.findUniqueOrThrow({ where: { id: promptId } })
  return [row.title, row.content]
}

describeDb("history handlers", () => {
  const getDb = useTestDatabase()
  const users: string[] = []

  /** A fresh user, so that no two tests share a limiter bucket, with a prompt at "Two" whose history is One, Two. */
  async function freshOwner(): Promise<{ userId: string; promptId: string; one: number; two: number }> {
    const db = getDb()
    const userId = (await createTestUser(db)).id
    users.push(userId)
    const promptId = (await createTestPrompt(db, userId, { title: "Two", content: "two" })).id
    const version = (title: string) =>
      db.promptVersion.create({
        data: { prompt_id: promptId, title_snapshot: title, content_snapshot: title.toLowerCase() },
      })
    const one = (await version("One")).id
    const two = (await version("Two")).id
    return { userId, promptId, one, two }
  }

  let owner = { userId: "", promptId: "", one: 0, two: 0 }

  beforeAll(async () => {
    owner = await freshOwner()
  })

  afterAll(async () => {
    for (const id of users) await deleteTestUser(getDb(), id)
  })

  it("getPromptVersionHistory: lists the caller's versions, newest first", async () => {
    const result = await handlers.getPromptVersionHistory(testDeps(getDb(), owner.userId), { promptId: owner.promptId })

    if (!result.success) throw new Error(result.error)
    expect(result.data.map((v) => [v.id, v.title_snapshot, v.content_snapshot])).toEqual([
      [owner.two, "Two", "two"],
      [owner.one, "One", "one"],
    ])
  })

  it("getPromptVersionHistory: refuses a bad id and a signed-out caller; a missing prompt is not found", async () => {
    const deps = testDeps(getDb(), owner.userId)

    expect(await handlers.getPromptVersionHistory(deps, { promptId: "not-a-uuid" })).toEqual({
      success: false,
      error: "Invalid prompt ID",
    })
    expect(await handlers.getPromptVersionHistory(signedOutDeps(getDb()), { promptId: owner.promptId })).toEqual(
      UNAUTHORIZED,
    )
    expect(await handlers.getPromptVersionHistory(deps, { promptId: randomUUID() })).toEqual(NOT_FOUND)
  })

  it("restorePromptVersion: restores the caller's prompt to a version and returns the restored state", async () => {
    const db = getDb()
    const { userId, promptId, one } = await freshOwner()

    const result = await handlers.restorePromptVersion(testDeps(db, userId), { promptId, versionId: one })

    expect(result).toEqual(RESTORED_ONE)
    expect(await rowOf(db, promptId)).toEqual(["One", "one"])
  })

  it("restorePromptVersion: refuses invalid input and a signed-out caller, and reports a foreign version", async () => {
    const db = getDb()
    const deps = testDeps(db, owner.userId)
    const invalid = { success: false, error: "Invalid restore request" }
    const other = await freshOwner()

    expect(await handlers.restorePromptVersion(deps, { promptId: owner.promptId, versionId: 0 })).toEqual(invalid)
    expect(await handlers.restorePromptVersion(deps, { promptId: "not-a-uuid", versionId: owner.one })).toEqual(invalid)
    const signedOut = await handlers.restorePromptVersion(signedOutDeps(db), {
      promptId: owner.promptId,
      versionId: owner.one,
    })
    expect(signedOut).toEqual(UNAUTHORIZED)
    expect(await handlers.restorePromptVersion(deps, { promptId: owner.promptId, versionId: other.one })).toEqual({
      success: false,
      error: "Version not found",
    })
    expect(await rowOf(db, owner.promptId)).toEqual(["Two", "two"])
  })

  it("restorePromptVersion: the 31st restore in a minute is refused; history and mutations still run", async () => {
    const db = getDb()
    const { userId, promptId, one, two } = await freshOwner()
    const deps = testDeps(db, userId)

    for (let i = 0; i < 30; i += 1) {
      expect(await handlers.restorePromptVersion(deps, { promptId, versionId: one })).toEqual(RESTORED_ONE)
    }
    const versionsBefore = await db.promptVersion.count({ where: { prompt_id: promptId } })

    expect(await handlers.restorePromptVersion(deps, { promptId, versionId: two })).toEqual(TOO_MANY)
    expect(await rowOf(db, promptId)).toEqual(["One", "one"])
    expect(await db.promptVersion.count({ where: { prompt_id: promptId } })).toBe(versionsBefore)

    const history = await handlers.getPromptVersionHistory(deps, { promptId })
    expect(history.success).toBe(true)
    const renamed = await promptHandlers.renamePrompt(deps, { promptId, newTitle: "Renamed" })
    expect(renamed).toEqual({ success: true, data: undefined })
  })

  it("restorePromptVersion: an exhausted mutation limit does not refuse a restore", async () => {
    const db = getDb()
    const { userId, promptId, one } = await freshOwner()
    const deps = testDeps(db, userId)

    for (let i = 0; i < 30; i += 1) {
      await promptHandlers.renamePrompt(deps, { promptId, newTitle: `Name ${i}` })
    }
    expect(await promptHandlers.renamePrompt(deps, { promptId, newTitle: "Late" })).toEqual(TOO_MANY)

    expect(await handlers.restorePromptVersion(deps, { promptId, versionId: one })).toEqual(RESTORED_ONE)
  })
})
