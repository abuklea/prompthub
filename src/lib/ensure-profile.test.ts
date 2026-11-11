/*
Project: PromptHub
Author: Allan James
Source: src/lib/ensure-profile.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:04 GMT+10
Last modified: 29/10/2026 20:04 GMT+10
---------------
Tests for ensureProfileExists against a real Postgres (skipped without TEST_DATABASE_URL): it creates a missing
profile, writes nothing to an existing one, and stays correct when 50 first calls for one user race.

Changelog:
29/10/2026 20:04 GMT+10 | Created (P7S2T1)
*/
import { randomUUID } from "node:crypto"
import { afterAll, expect, it } from "vitest"
import { describeDb, useTestDatabase } from "@/test/db"
import { ensureProfileExists } from "./ensure-profile"

/** The error code of a rejected call (a Prisma known request error carries one), or its text. */
function failureOf(reason: unknown): string {
  if (reason && typeof reason === "object" && "code" in reason) return String(reason.code)
  return String(reason)
}

describeDb("ensureProfileExists", () => {
  const getDb = useTestDatabase()
  const created: string[] = []

  /** A fresh user id, removed with its profile after the suite. */
  const newUserId = (): string => {
    const id = randomUUID()
    created.push(id)
    return id
  }

  afterAll(async () => {
    await getDb().profile.deleteMany({ where: { id: { in: created } } })
  })

  it("creates the profile when it is absent", async () => {
    const id = newUserId()
    expect(await getDb().profile.findUnique({ where: { id } })).toBeNull()

    await ensureProfileExists(getDb(), id)

    const profile = await getDb().profile.findUnique({ where: { id } })
    expect(profile).toMatchObject({ id, display_name: null })
  })

  it("changes nothing on a second call and leaves an existing display_name untouched", async () => {
    const id = newUserId()
    await ensureProfileExists(getDb(), id)
    await getDb().profile.update({ where: { id }, data: { display_name: "Kept Name" } })
    const before = await getDb().profile.findUniqueOrThrow({ where: { id } })

    await ensureProfileExists(getDb(), id)

    expect(await getDb().profile.findUniqueOrThrow({ where: { id } })).toEqual(before)
    expect(before.display_name).toBe("Kept Name")
  })

  it("resolves 50 concurrent first calls for one user and leaves one row", async () => {
    const id = newUserId()

    const results = await Promise.allSettled(Array.from({ length: 50 }, () => ensureProfileExists(getDb(), id)))

    const failures = results.flatMap((r) => (r.status === "rejected" ? [failureOf(r.reason)] : []))
    expect(failures).toEqual([])
    expect(await getDb().profile.count({ where: { id } })).toBe(1)
  })
})
