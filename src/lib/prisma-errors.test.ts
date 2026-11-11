/*
Project: PromptHub
Author: Allan James
Source: src/lib/prisma-errors.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:18 GMT+10
Last modified: 29/10/2026 20:18 GMT+10
---------------
Tests for isNotFoundError: true for the P2025 Postgres raises through Prisma when an update finds no row (against a
real database, skipped without TEST_DATABASE_URL) and for a constructed P2025, false for every other error or value.

Changelog:
29/10/2026 20:18 GMT+10 | Created (P7S2T2)
*/
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { describeDb, useTestDatabase } from "@/test/db"
import { isNotFoundError } from "./prisma-errors"

/** A Prisma known request error with the given code, as the client builds it. */
function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`error ${code}`, { code, clientVersion: Prisma.prismaVersion.client })
}

describeDb("isNotFoundError against Postgres", () => {
  const getDb = useTestDatabase()

  it("is true for the P2025 that db.folder.update raises for a missing row", async () => {
    const error = await getDb()
      .folder.update({ where: { id: randomUUID() }, data: { name: "renamed" } })
      .then(
        () => null,
        (reason: unknown) => reason,
      )

    expect(error).toMatchObject({ code: "P2025" })
    expect(isNotFoundError(error)).toBe(true)
  })
})

describe("isNotFoundError", () => {
  it("is true for a Prisma known request error with code P2025", () => {
    expect(isNotFoundError(knownError("P2025"))).toBe(true)
  })

  it.each([
    ["a Prisma known request error with another code (P2002)", knownError("P2002")],
    ["a plain Error", new Error("Record to update not found.")],
    ["a plain object carrying code P2025", { code: "P2025" }],
    ["the string P2025", "P2025"],
    ["null", null],
    ["undefined", undefined],
  ])("is false for %s", (_label, error) => {
    expect(isNotFoundError(error)).toBe(false)
  })
})
