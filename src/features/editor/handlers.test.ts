/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
Tests for the editor handlers against a real Postgres (skipped without TEST_DATABASE_URL): autosave has its own limit
of 240 a minute and explicit saves their own of 30, independent of each other; saveNewVersion checks the title first in
its body, after authentication and the limit; both keep their invalid-input and unauthorised results.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { signedOutDeps, testDeps } from "@/test/action-deps"
import { createTestPrompt, createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import type { ActionResult } from "@/types/actions"
import * as handlers from "./handlers"

const TOO_MANY = { success: false, error: "Too many requests. Please slow down." }
const UNAUTHORIZED = { success: false, error: "Unauthorized. Please sign in." }
const INVALID = { success: false, error: "Invalid input data" }
const BAD_TITLE = { success: false, error: "Please provide a valid title for your document" }

/** How many of `results` succeeded. */
const successes = (results: ActionResult<unknown>[]): number => results.filter((r) => r.success).length

/** Autosave a prompt `times` times in sequence, with distinct content each time. */
async function autosaveTimes(db: PrismaClient, userId: string, promptId: string, times: number) {
  const results: ActionResult<void>[] = []
  for (let i = 0; i < times; i += 1) {
    results.push(await handlers.autoSavePrompt(testDeps(db, userId), { promptId, title: "Auto", content: `a${i}` }))
  }
  return results
}

/** Save a prompt `times` times in sequence, with distinct content each time. */
async function saveTimes(db: PrismaClient, userId: string, promptId: string, times: number) {
  const results: ActionResult<{ versionId: number }>[] = []
  for (let i = 0; i < times; i += 1) {
    const input = { promptId, newTitle: "Saved", newContent: `s${i}` }
    results.push(await handlers.saveNewVersion(testDeps(db, userId), input))
  }
  return results
}

describeDb("editor handlers", () => {
  const getDb = useTestDatabase()
  const users: string[] = []

  /** A fresh user with one prompt, so that no two tests share a limiter bucket. */
  async function freshOwner(): Promise<{ userId: string; promptId: string }> {
    const userId = (await createTestUser(getDb())).id
    users.push(userId)
    const promptId = (await createTestPrompt(getDb(), userId, { title: "Start", content: "start" })).id
    return { userId, promptId }
  }

  let owner = { userId: "", promptId: "" }

  beforeAll(async () => {
    owner = await freshOwner()
  })

  afterAll(async () => {
    for (const id of users) await deleteTestUser(getDb(), id)
  })

  it("allows 240 autosaves a minute, refuses the 241st, and saves still run until their own 31st", async () => {
    const db = getDb()
    const { userId, promptId } = await freshOwner()

    expect(successes(await autosaveTimes(db, userId, promptId, 240))).toBe(240)
    const late = { promptId, title: "x", content: "late" }
    expect(await handlers.autoSavePrompt(testDeps(db, userId), late)).toEqual(TOO_MANY)

    expect(successes(await saveTimes(db, userId, promptId, 30))).toBe(30)
    const refused = await handlers.saveNewVersion(testDeps(db, userId), { promptId, newTitle: "T", newContent: "late" })
    expect(refused).toEqual(TOO_MANY)
    expect(await db.promptVersion.count({ where: { prompt_id: promptId, content_snapshot: "late" } })).toBe(0)
  })

  it("refuses the 31st save, before the title check, while autosave still runs", async () => {
    const db = getDb()
    const { userId, promptId } = await freshOwner()

    expect(successes(await saveTimes(db, userId, promptId, 30))).toBe(30)
    expect(await handlers.saveNewVersion(testDeps(db, userId), { promptId, newTitle: "T", newContent: "x" })).toEqual(
      TOO_MANY,
    )
    const placeholder = { promptId, newTitle: "[Untitled Doc]", newContent: "x" }
    expect(await handlers.saveNewVersion(testDeps(db, userId), placeholder)).toEqual(TOO_MANY)

    const autosaved = await handlers.autoSavePrompt(testDeps(db, userId), { promptId, title: "A", content: "after" })
    expect(autosaved).toEqual({ success: true, data: undefined })
    expect((await db.prompt.findUniqueOrThrow({ where: { id: promptId } })).content).toBe("after")
  })

  it("saveNewVersion saves the prompt and returns the id of the version holding the saved state", async () => {
    const db = getDb()
    const input = { promptId: owner.promptId, newTitle: "Saved title", newContent: "saved content" }

    const result = await handlers.saveNewVersion(testDeps(db, owner.userId), input)

    if (!result.success) throw new Error(`save failed: ${result.error}`)
    const version = await db.promptVersion.findUniqueOrThrow({ where: { id: result.data.versionId } })
    expect([version.prompt_id, version.title_snapshot, version.content_snapshot]).toEqual([
      owner.promptId,
      "Saved title",
      "saved content",
    ])
  })

  it("autoSavePrompt writes the row, including an untitled document, and records no version", async () => {
    const db = getDb()
    const { userId, promptId } = await freshOwner()

    const result = await handlers.autoSavePrompt(testDeps(db, userId), { promptId, title: null, content: "draft" })

    expect(result).toEqual({ success: true, data: undefined })
    const row = await db.prompt.findUniqueOrThrow({ where: { id: promptId } })
    expect([row.title, row.content]).toEqual([null, "draft"])
    expect(await db.promptVersion.count({ where: { prompt_id: promptId } })).toBe(0)
  })

  it.each(["[Untitled Doc]", "[untitled doc 3]", "  [Untitled Doc 12]  "])(
    "saveNewVersion refuses the placeholder title %j before the service runs, and writes nothing",
    async (newTitle) => {
      const db = getDb()
      const before = await db.prompt.findUniqueOrThrow({ where: { id: owner.promptId } })
      const versionsBefore = await db.promptVersion.count({ where: { prompt_id: owner.promptId } })

      const result = await handlers.saveNewVersion(testDeps(db, owner.userId), {
        promptId: owner.promptId,
        newTitle,
        newContent: "never saved",
      })

      expect(result).toEqual(BAD_TITLE)
      expect(await db.prompt.findUniqueOrThrow({ where: { id: owner.promptId } })).toEqual(before)
      expect(await db.promptVersion.count({ where: { prompt_id: owner.promptId } })).toBe(versionsBefore)
    },
  )

  it("saveNewVersion checks the title before the prompt: an unknown prompt gets the title text", async () => {
    const input = { promptId: randomUUID(), newTitle: "[Untitled Doc]", newContent: "x" }

    expect(await handlers.saveNewVersion(testDeps(getDb(), owner.userId), input)).toEqual(BAD_TITLE)
  })

  it("saveNewVersion checks the title after authentication: a signed-out placeholder is unauthorised", async () => {
    const input = { promptId: owner.promptId, newTitle: "[Untitled Doc]", newContent: "x" }

    expect(await handlers.saveNewVersion(signedOutDeps(getDb()), input)).toEqual(UNAUTHORIZED)
  })

  it("autoSavePrompt is unauthorised without a session and writes nothing", async () => {
    const db = getDb()
    const before = await db.prompt.findUniqueOrThrow({ where: { id: owner.promptId } })

    const input = { promptId: owner.promptId, title: "T", content: "c" }
    const result = await handlers.autoSavePrompt(signedOutDeps(db), input)

    expect(result).toEqual(UNAUTHORIZED)
    expect(await db.prompt.findUniqueOrThrow({ where: { id: owner.promptId } })).toEqual(before)
  })

  it.each([
    ["a non-uuid prompt id", { promptId: "not-a-uuid", newTitle: "T", newContent: "c" }],
    ["an empty title", { promptId: randomUUID(), newTitle: "", newContent: "c" }],
    ["a missing content", { promptId: randomUUID(), newTitle: "T" }],
    ["no input", undefined],
  ])("saveNewVersion returns the invalid-input text for %s", async (_label, data) => {
    expect(await handlers.saveNewVersion(testDeps(getDb(), owner.userId), data)).toEqual(INVALID)
  })

  it.each([
    ["a non-uuid prompt id", { promptId: "not-a-uuid", title: "T", content: "c" }],
    ["a missing title", { promptId: randomUUID(), content: "c" }],
    ["a title over 200 characters", { promptId: randomUUID(), title: "t".repeat(201), content: "c" }],
  ])("autoSavePrompt returns the invalid-input text for %s", async (_label, data) => {
    expect(await handlers.autoSavePrompt(testDeps(getDb(), owner.userId), data)).toEqual(INVALID)
  })
})
