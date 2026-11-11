/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
Tenant-boundary test for getWorkspaceSnapshot against a real Postgres (skipped without TEST_DATABASE_URL): user B's
snapshot holds B's folders and prompts and none of user A's.

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

describeDb("workspace handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""
  let folderA: Folder
  let promptA: Prompt
  let folderB: Folder
  let promptB: Prompt

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    folderA = await createTestFolder(db, userA, { name: "A's folder" })
    promptA = await createTestPrompt(db, userA, { title: "A's prompt", folderId: folderA.id })
    folderB = await createTestFolder(db, userB, { name: "B's folder" })
    promptB = await createTestPrompt(db, userB, { title: "B's prompt", folderId: folderB.id })
  })

  afterAll(async () => {
    for (const id of [userA, userB]) if (id) await deleteTestUser(getDb(), id)
  })

  it("getWorkspaceSnapshot: user B's snapshot holds B's folders and prompts and none of user A's", async () => {
    const db = getDb()

    const result = await handlers.getWorkspaceSnapshot(testDeps(db, userB), undefined)

    if (!result.success) throw new Error(result.error)
    expect(result.data.userId).toBe(userB)
    expect(result.data.folders.map((f: { id: string }) => f.id)).toEqual([folderB.id])
    expect(result.data.prompts.map((p: { id: string }) => p.id)).toEqual([promptB.id])
    const serialised = JSON.stringify(result.data)
    for (const value of [userA, folderA.id, promptA.id, "A's folder", "A's prompt"]) {
      expect(serialised).not.toContain(value)
    }
    expect(await db.folder.findUniqueOrThrow({ where: { id: folderA.id } })).toEqual(folderA)
    expect(await db.prompt.findUniqueOrThrow({ where: { id: promptA.id } })).toEqual(promptA)
  })
})
