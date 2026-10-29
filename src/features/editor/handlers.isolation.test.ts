/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
Tenant-boundary tests for the editor handlers against a real Postgres (skipped without TEST_DATABASE_URL): user B
saving or autosaving user A's prompt gets exactly what a missing prompt id gets, and A's row and history are unchanged.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { testDeps } from "@/test/action-deps"
import { createTestPrompt, createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import * as handlers from "./handlers"

const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }

/** A prompt row and its history, read back with the test client. */
async function snapshot(db: PrismaClient, promptId: string) {
  return {
    row: await db.prompt.findUniqueOrThrow({ where: { id: promptId } }),
    history: await db.promptVersion.findMany({ where: { prompt_id: promptId }, orderBy: { id: "desc" } }),
  }
}

describeDb("editor handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let promptA = ""

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    promptA = (await createTestPrompt(db, userA, { title: "A's title", content: "A's content" })).id
    await db.promptVersion.create({
      data: { prompt_id: promptA, title_snapshot: "A's title", content_snapshot: "A's content" },
    })
  })

  afterAll(async () => {
    for (const id of [userA, userB]) if (id) await deleteTestUser(getDb(), id)
  })

  it("saveNewVersion: user B saving user A's prompt gets the missing-id result and changes nothing", async () => {
    const db = getDb()
    const before = await snapshot(db, promptA)
    const deps = testDeps(db, userB)

    const result = await handlers.saveNewVersion(deps, { promptId: promptA, newTitle: "B's", newContent: "B's" })
    const missing = await handlers.saveNewVersion(deps, { promptId: randomUUID(), newTitle: "B's", newContent: "B's" })

    expect(result).toEqual(missing)
    expect(result).toEqual(NOT_FOUND)
    expect(await snapshot(db, promptA)).toEqual(before)
  })

  it("autoSavePrompt: user B autosaving user A's prompt gets the missing-id result and changes nothing", async () => {
    const db = getDb()
    const before = await snapshot(db, promptA)
    const deps = testDeps(db, userB)

    const result = await handlers.autoSavePrompt(deps, { promptId: promptA, title: "B's", content: "B's" })
    const missing = await handlers.autoSavePrompt(deps, { promptId: randomUUID(), title: "B's", content: "B's" })

    expect(result).toEqual(missing)
    expect(result).toEqual(NOT_FOUND)
    expect(await snapshot(db, promptA)).toEqual(before)
  })
})
