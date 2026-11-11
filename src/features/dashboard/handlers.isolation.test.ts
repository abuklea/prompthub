/*
Project: PromptHub
Author: Allan James
Source: src/features/dashboard/handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
Tenant-boundary test for getDashboardMetrics against a real Postgres (skipped without TEST_DATABASE_URL): user B's
counts and recent list exclude user A's prompts, folders and versions.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { afterAll, beforeAll, expect, it } from "vitest"
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

describeDb("dashboard handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let folderA: Folder
  const promptsA: Prompt[] = []
  let promptB: Prompt

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    folderA = await createTestFolder(db, userA, { name: "A's folder" })
    for (const title of ["A one", "A two", "A three"]) {
      const prompt = await createTestPrompt(db, userA, { title, folderId: folderA.id })
      // Reason: A's prompts are the newest rows, so a missing user filter would put them first in B's recent list.
      promptsA.push(await db.prompt.update({ where: { id: prompt.id }, data: { updated_at: new Date("2099-01-01") } }))
      await db.promptVersion.create({ data: { prompt_id: prompt.id, content_snapshot: "A's version" } })
      await db.promptVersion.create({ data: { prompt_id: prompt.id, content_snapshot: "A's second version" } })
    }
    promptB = await createTestPrompt(db, userB, { title: "B's prompt" })
    await db.promptVersion.create({ data: { prompt_id: promptB.id, content_snapshot: "B's version" } })
  })

  afterAll(async () => {
    for (const id of [userA, userB]) if (id) await deleteTestUser(getDb(), id)
  })

  it("getDashboardMetrics: user B's counts and recent list exclude A's prompts, folders and versions", async () => {
    const db = getDb()

    const result = await handlers.getDashboardMetrics(testDeps(db, userB), undefined)

    expect(result).toEqual({
      success: true,
      data: {
        totalPrompts: 1,
        totalFolders: 0,
        totalVersions: 1,
        recentlyUpdatedPrompts: [
          { id: promptB.id, title: "B's prompt", updatedAt: promptB.updated_at, folderName: null },
        ],
      },
    })
    const serialised = JSON.stringify(result)
    for (const value of [folderA.name, ...promptsA.map((p) => p.id)]) expect(serialised).not.toContain(value)
    expect(await db.prompt.findMany({ where: { user_id: userA }, orderBy: { title: "asc" } })).toEqual(
      [...promptsA].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    )
    expect(await db.promptVersion.count({ where: { prompt: { user_id: userA } } })).toBe(6)
  })
})
