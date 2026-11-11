/*
Project: PromptHub
Author: Allan James
Source: src/features/prompts/history-handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:08 GMT+10
Last modified: 29/10/2026 21:08 GMT+10
---------------
The tenant boundary of the version-history handlers against a real Postgres (skipped without TEST_DATABASE_URL). User B
reads or restores user A's prompt with A's ids: the result equals what a missing prompt id returns, and A's row and
versions read back unchanged. Each test is titled "<action>: user B ..." for the isolation coverage rule.

Changelog:
29/10/2026 21:08 GMT+10 | Created (P7S2T7, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeAll, expect, it } from "vitest"
import { testDeps } from "@/test/action-deps"
import { createTestPrompt, createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import * as handlers from "./history-handlers"

const NOT_FOUND = { success: false, error: "Prompt not found or access denied" }

describeDb("history handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let promptA = ""
  let versionA = 0
  let snapshotOfA: unknown

  /** User A's prompt row and its versions, read back with the test client. */
  async function rowsOfA(): Promise<unknown> {
    const db = getDb()
    return {
      row: await db.prompt.findUniqueOrThrow({ where: { id: promptA } }),
      versions: await db.promptVersion.findMany({ where: { prompt_id: promptA }, orderBy: { id: "asc" } }),
    }
  }

  const asB = () => testDeps(getDb(), userB)

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    promptA = (await createTestPrompt(db, userA, { title: "A's title", content: "A's content" })).id
    versionA = (
      await db.promptVersion.create({ data: { prompt_id: promptA, title_snapshot: "A old", content_snapshot: "old" } })
    ).id
    await db.promptVersion.create({
      data: { prompt_id: promptA, title_snapshot: "A's title", content_snapshot: "A's content" },
    })
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

  it("getPromptVersionHistory: user B reading user A's history gets the missing-prompt result", async () => {
    const foreign = await handlers.getPromptVersionHistory(asB(), { promptId: promptA })
    const missing = await handlers.getPromptVersionHistory(asB(), { promptId: randomUUID() })

    expect(foreign).toEqual(NOT_FOUND)
    expect(foreign).toEqual(missing)
  })

  it("restorePromptVersion: user B restoring user A's version gets the missing-prompt result", async () => {
    const foreign = await handlers.restorePromptVersion(asB(), { promptId: promptA, versionId: versionA })
    const missing = await handlers.restorePromptVersion(asB(), { promptId: randomUUID(), versionId: versionA })

    expect(foreign).toEqual(NOT_FOUND)
    expect(foreign).toEqual(missing)
  })
})
