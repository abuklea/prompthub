/*
Project: PromptHub
Author: Allan James
Source: src/features/profile/handlers.isolation.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
Tenant-boundary tests for the profile handlers against a real Postgres (skipped without TEST_DATABASE_URL): user B
reads and changes only B's own profile, even when the input names user A's id.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { afterAll, beforeAll, expect, it } from "vitest"
import { testDeps } from "@/test/action-deps"
import { createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import * as handlers from "./handlers"

describeDb("profile handlers: tenant isolation", () => {
  const getDb = useTestDatabase()
  let userA = ""
  let userB = ""

  beforeAll(async () => {
    const db = getDb()
    userA = (await createTestUser(db)).id
    userB = (await createTestUser(db)).id
    await db.profile.update({ where: { id: userA }, data: { display_name: "A's name" } })
    await db.profile.update({ where: { id: userB }, data: { display_name: "B's name" } })
  })

  afterAll(async () => {
    for (const id of [userA, userB]) if (id) await deleteTestUser(getDb(), id)
  })

  it("updateDisplayName: user B naming user A's id in the input changes only B's profile", async () => {
    const db = getDb()
    const before = await db.profile.findUniqueOrThrow({ where: { id: userA } })

    const result = await handlers.updateDisplayName(testDeps(db, userB), {
      displayName: "Renamed by B",
      id: userA,
      userId: userA,
      user_id: userA,
    })

    expect(result).toEqual({ success: true, data: { displayName: "Renamed by B" } })
    expect(await db.profile.findUniqueOrThrow({ where: { id: userA } })).toEqual(before)
    expect((await db.profile.findUniqueOrThrow({ where: { id: userB } })).display_name).toBe("Renamed by B")
  })

  it("getProfileDetails: user B gets B's details and none of user A's data", async () => {
    const db = getDb()
    const before = await db.profile.findUniqueOrThrow({ where: { id: userA } })

    const result = await handlers.getProfileDetails(testDeps(db, userB), undefined)

    if (!result.success) throw new Error(result.error)
    expect(result.data.id).toBe(userB)
    expect(JSON.stringify(result.data)).not.toContain(userA)
    expect(JSON.stringify(result.data)).not.toContain("A's name")
    expect(await db.profile.findUniqueOrThrow({ where: { id: userA } })).toEqual(before)
  })
})
