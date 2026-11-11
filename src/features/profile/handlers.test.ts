/*
Project: PromptHub
Author: Allan James
Source: src/features/profile/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:45 GMT+10
Last modified: 29/10/2026 20:52 GMT+10
---------------
Tests for the profile handlers against a real Postgres (skipped without TEST_DATABASE_URL): both create a missing
profile first; getProfileDetails returns the caller's details; updateDisplayName trims, caps the name at 100
characters, stores a blank name as null and is limited to 30 a minute; both refuse a signed-out caller and bad input.

Changelog:
29/10/2026 20:45 GMT+10 | Created (P7S2T8, red phase)
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { ActionDeps } from "@/lib/action-runner"
import { signedOutDeps, testDeps } from "@/test/action-deps"
import { createTestUser, deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import * as handlers from "./handlers"

const UNAUTHORIZED = { success: false, error: "Unauthorized. Please sign in." }
const TOO_MANY = { success: false, error: "Too many requests. Please slow down." }
const INVALID_INPUT = { success: false, error: "Invalid input data" }
const INVALID_NAME = { success: false, error: "Invalid display name" }

/** The stored display name of a profile, or undefined when the profile does not exist. */
async function storedName(db: PrismaClient, userId: string): Promise<string | null | undefined> {
  const profile = await db.profile.findUnique({ where: { id: userId } })
  return profile === null ? undefined : profile.display_name
}

describeDb("profile handlers", () => {
  const getDb = useTestDatabase()
  const users: string[] = []
  let owner = ""

  /** A user id with no profile row; afterAll deletes whatever a handler creates for it. */
  function userWithoutProfile(): string {
    const id = randomUUID()
    users.push(id)
    return id
  }

  beforeAll(async () => {
    owner = (await createTestUser(getDb())).id
    users.push(owner)
  })

  afterAll(async () => {
    for (const id of users) await deleteTestUser(getDb(), id)
  })

  it("getProfileDetails creates the profile of a user that has none and returns that user's details", async () => {
    const db = getDb()
    const id = userWithoutProfile()

    const result = await handlers.getProfileDetails(testDeps(db, id), undefined)

    const profile = await db.profile.findUniqueOrThrow({ where: { id } })
    expect(result).toEqual({
      success: true,
      data: { id, email: `${id}@example.test`, displayName: "", createdAt: profile.created_at },
    })
  })

  it("getProfileDetails returns the stored display name, and an empty email when Supabase has none", async () => {
    const deps: ActionDeps = { db: getDb(), getUser: async () => ({ id: owner, email: null }) }

    const result = await handlers.getProfileDetails(deps, undefined)

    if (!result.success) throw new Error(result.error)
    expect([result.data.id, result.data.email, result.data.displayName]).toEqual([owner, "", "test-user"])
  })

  it("updateDisplayName stores the trimmed name and returns it", async () => {
    const db = getDb()

    const result = await handlers.updateDisplayName(testDeps(db, owner), { displayName: "  Ada Lovelace  " })

    expect(result).toEqual({ success: true, data: { displayName: "Ada Lovelace" } })
    expect(await storedName(db, owner)).toBe("Ada Lovelace")
  })

  it("updateDisplayName stores a blank name as null and returns an empty name", async () => {
    const db = getDb()
    await handlers.updateDisplayName(testDeps(db, owner), { displayName: "Someone" })

    const result = await handlers.updateDisplayName(testDeps(db, owner), { displayName: "   " })

    expect(result).toEqual({ success: true, data: { displayName: "" } })
    expect(await storedName(db, owner)).toBeNull()
  })

  it("updateDisplayName accepts 100 characters after trimming and refuses 101, keeping the name", async () => {
    const db = getDb()
    const hundred = "n".repeat(100)

    expect(await handlers.updateDisplayName(testDeps(db, owner), { displayName: `  ${hundred}  ` })).toEqual({
      success: true,
      data: { displayName: hundred },
    })
    expect(await handlers.updateDisplayName(testDeps(db, owner), { displayName: "n".repeat(101) })).toEqual(
      INVALID_NAME,
    )
    expect(await storedName(db, owner)).toBe(hundred)
  })

  it("updateDisplayName creates the profile of a user that has none", async () => {
    const db = getDb()
    const id = userWithoutProfile()

    const result = await handlers.updateDisplayName(testDeps(db, id), { displayName: "New user" })

    expect(result).toEqual({ success: true, data: { displayName: "New user" } })
    expect(await storedName(db, id)).toBe("New user")
  })

  it("updateDisplayName refuses the 31st change in a minute", async () => {
    const db = getDb()
    const id = (await createTestUser(db)).id
    users.push(id)

    for (let i = 0; i < 30; i += 1) {
      expect((await handlers.updateDisplayName(testDeps(db, id), { displayName: `name ${i}` })).success).toBe(true)
    }

    expect(await handlers.updateDisplayName(testDeps(db, id), { displayName: "too many" })).toEqual(TOO_MANY)
    expect(await storedName(db, id)).toBe("name 29")
  })

  it.each([
    ["a bare string", "Ada"],
    ["a missing name", {}],
    ["a number", { displayName: 7 }],
    ["no input", undefined],
  ])("updateDisplayName returns the invalid-name text for %s", async (_label, data) => {
    expect(await handlers.updateDisplayName(testDeps(getDb(), owner), data)).toEqual(INVALID_NAME)
  })

  it.each([
    ["an object", {}],
    ["a string", "someone"],
  ])("getProfileDetails returns the invalid-input text for %s", async (_label, data) => {
    expect(await handlers.getProfileDetails(testDeps(getDb(), owner), data)).toEqual(INVALID_INPUT)
  })

  it("both handlers are unauthorised without a session", async () => {
    const db = getDb()

    expect(await handlers.getProfileDetails(signedOutDeps(db), undefined)).toEqual(UNAUTHORIZED)
    expect(await handlers.updateDisplayName(signedOutDeps(db), { displayName: "signed out" })).toEqual(UNAUTHORIZED)
    expect(await storedName(db, owner)).not.toBe("signed out")
  })
})
