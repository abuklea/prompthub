/*
Project: PromptHub
Author: Allan James
Source: src/features/dashboard/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
Tests for getDashboardMetrics against a real Postgres (skipped without TEST_DATABASE_URL): the caller's prompt, folder
and version counts and five most recently updated prompts, with the untitled fallback and the folder name; zeros for a
user with nothing; a failure result, not zeros, for a signed-out caller; the invalid-input result.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { afterAll, beforeAll, expect, it } from "vitest"
import type { Prompt } from "@prisma/client"
import { signedOutDeps, testDeps } from "@/test/action-deps"
import {
  createTestFolder,
  createTestPrompt,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
} from "@/test/db"
import * as handlers from "./handlers"

describeDb("dashboard handlers", () => {
  const getDb = useTestDatabase()
  const users: string[] = []

  /** A fresh user, deleted in afterAll. */
  async function freshUser(): Promise<string> {
    const id = (await createTestUser(getDb())).id
    users.push(id)
    return id
  }

  let owner = ""

  beforeAll(async () => {
    owner = await freshUser()
  })

  afterAll(async () => {
    for (const id of users) await deleteTestUser(getDb(), id)
  })

  it("counts the user's prompts, folders and versions and lists the five most recently updated", async () => {
    const db = getDb()
    const folder = await createTestFolder(db, owner, { name: "Work" })
    await createTestFolder(db, owner, { name: "Empty" })
    const titles: (string | null)[] = ["Oldest", "Second", null, "   ", "Filed", "Newest"]
    const prompts: Prompt[] = []
    for (let i = 0; i < titles.length; i += 1) {
      const title = titles[i]
      const prompt = await createTestPrompt(db, owner, { title, folderId: title === "Filed" ? folder.id : null })
      const updatedAt = new Date(Date.UTC(2026, 0, i + 1))
      prompts.push(await db.prompt.update({ where: { id: prompt.id }, data: { updated_at: updatedAt } }))
    }
    for (const content of ["v1", "v2", "v3"]) {
      await db.promptVersion.create({ data: { prompt_id: prompts[0].id, content_snapshot: content } })
    }

    const result = await handlers.getDashboardMetrics(testDeps(db, owner), undefined)

    const recent = (index: number, title: string, folderName: string | null) => ({
      id: prompts[index].id,
      title,
      updatedAt: prompts[index].updated_at,
      folderName,
    })
    expect(result).toEqual({
      success: true,
      data: {
        totalPrompts: 6,
        totalFolders: 2,
        totalVersions: 3,
        recentlyUpdatedPrompts: [
          recent(5, "Newest", null),
          recent(4, "Filed", "Work"),
          recent(3, "Untitled prompt", null),
          recent(2, "Untitled prompt", null),
          recent(1, "Second", null),
        ],
      },
    })
  })

  it("returns zeros and an empty list for a user with nothing", async () => {
    const id = await freshUser()

    expect(await handlers.getDashboardMetrics(testDeps(getDb(), id), undefined)).toEqual({
      success: true,
      data: { totalPrompts: 0, totalFolders: 0, totalVersions: 0, recentlyUpdatedPrompts: [] },
    })
  })

  it("is a failure result, not zeros, without a session", async () => {
    expect(await handlers.getDashboardMetrics(signedOutDeps(getDb()), undefined)).toEqual({
      success: false,
      error: "Unauthorized. Please sign in.",
    })
  })

  it.each([
    ["an object", {}],
    ["a string", "some-user-id"],
  ])("returns the invalid-input text for %s", async (_label, data) => {
    expect(await handlers.getDashboardMetrics(testDeps(getDb(), owner), data)).toEqual({
      success: false,
      error: "Invalid input data",
    })
  })
})
