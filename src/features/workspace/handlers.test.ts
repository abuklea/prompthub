/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
Tests for getWorkspaceSnapshot against a real Postgres (skipped without TEST_DATABASE_URL): the caller's folders in
parent then name order, the caller's prompt listings (no content) newest first with their folder, the load time, and
the unauthorised and invalid-input results.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { afterAll, beforeAll, expect, it } from "vitest"
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

describeDb("workspace handlers", () => {
  const getDb = useTestDatabase()
  let owner = ""

  beforeAll(async () => {
    owner = (await createTestUser(getDb())).id
  })

  afterAll(async () => {
    if (owner) await deleteTestUser(getDb(), owner)
  })

  it("returns the user's folders and prompt listings in order, without content, with the load time", async () => {
    const db = getDb()
    const bRoot = await createTestFolder(db, owner, { name: "b-root" })
    const aRoot = await createTestFolder(db, owner, { name: "a-root" })
    const child = await createTestFolder(db, owner, { name: "c-child", parentId: aRoot.id })
    const filed = await createTestPrompt(db, owner, { title: "Filed", content: "secret body", folderId: child.id })
    const unfiled = await createTestPrompt(db, owner, { title: null, content: "other body" })
    await db.prompt.update({ where: { id: filed.id }, data: { updated_at: new Date("2026-01-01T00:00:00Z") } })
    await db.prompt.update({ where: { id: unfiled.id }, data: { updated_at: new Date("2026-02-01T00:00:00Z") } })
    const startedAt = Date.now()

    const result = await handlers.getWorkspaceSnapshot(testDeps(db, owner), undefined)

    if (!result.success) throw new Error(result.error)
    const { userId, folders, prompts, loadedAt } = result.data
    expect(userId).toBe(owner)
    // Reason: Postgres sorts NULL last in ascending order, so child folders precede root folders.
    expect(folders.map((f: { id: string }) => f.id)).toEqual([child.id, aRoot.id, bRoot.id])
    expect(prompts).toEqual([
      {
        id: unfiled.id,
        title: null,
        created_at: unfiled.created_at,
        updated_at: new Date("2026-02-01T00:00:00Z"),
        user_id: owner,
        folder_id: null,
        folder: null,
      },
      {
        id: filed.id,
        title: "Filed",
        created_at: filed.created_at,
        updated_at: new Date("2026-01-01T00:00:00Z"),
        user_id: owner,
        folder_id: child.id,
        folder: { id: child.id, name: "c-child" },
      },
    ])
    expect(Date.parse(loadedAt)).toBeGreaterThanOrEqual(startedAt - 1000)
    expect(new Date(loadedAt).toISOString()).toBe(loadedAt)
  })

  it("is unauthorised without a session", async () => {
    expect(await handlers.getWorkspaceSnapshot(signedOutDeps(getDb()), undefined)).toEqual({
      success: false,
      error: "Unauthorized. Please sign in.",
    })
  })

  it.each([
    ["an object", {}],
    ["a string", "some-user-id"],
  ])("returns the invalid-input text for %s", async (_label, data) => {
    expect(await handlers.getWorkspaceSnapshot(testDeps(getDb(), owner), data)).toEqual({
      success: false,
      error: "Invalid input data",
    })
  })
})
