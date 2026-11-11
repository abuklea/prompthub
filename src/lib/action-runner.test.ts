/*
Project: PromptHub
Author: Allan James
Source: src/lib/action-runner.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:18 GMT+10
Last modified: 29/10/2026 20:18 GMT+10
---------------
Tests for runAction: the fixed order of parse, authenticate, rate-limit and run; the limiter each limit class selects;
the fixed messages; the rethrow of Next control-flow errors (a string digest) and the logged failure for every other
error. The DB-free cases pass a database that throws when touched, which proves the runner never uses it; the
ensureProfile case runs against a real Postgres (skipped without TEST_DATABASE_URL).

Changelog:
29/10/2026 20:18 GMT+10 | Created (P7S2T2)
*/
import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { describeDb, useTestDatabase } from "@/test/db"
import type { ActionResult } from "@/types/actions"
import { runAction } from "./action-runner"
import type { ActionDeps, ActionSpec, ActionUser } from "./action-runner"

const UNAUTHORIZED = { success: false, error: "Unauthorized. Please sign in." }
const TOO_MANY = { success: false, error: "Too many requests. Please slow down." }
const INVALID = { success: false, error: "Invalid test input" }
const FAILURE = { success: false, error: "Failed to run the test action" }

const schema = z.object({ name: z.string().trim().min(1) })
type Input = z.infer<typeof schema>

/** A database that throws when any member is read: a DB-free case passes it to prove the runner never touches it. */
const untouchableDb = new Proxy(
  {},
  {
    get(_target, key) {
      throw new Error(`the runner touched db.${String(key)}`)
    },
  },
) as PrismaClient

/** A fresh user, so that no two tests share a limiter bucket. */
function newUser(): ActionUser {
  return { id: randomUUID(), email: "runner@example.test" }
}

/** Deps whose getUser records "getUser" in `calls` and resolves `user`. */
function fakeDeps(user: ActionUser | null, calls: string[] = [], db: PrismaClient = untouchableDb): ActionDeps {
  return {
    db,
    getUser: async () => {
      calls.push("getUser")
      return user
    },
  }
}

/** A spec with no limit whose run records "run" in `calls` and returns the parsed name; `overrides` replace fields. */
function testSpec(overrides: Partial<ActionSpec<Input, string>> = {}, calls: string[] = []): ActionSpec<Input, string> {
  return {
    name: "testAction",
    schema,
    invalid: INVALID.error,
    failure: FAILURE.error,
    limit: "none",
    run: async ({ input }) => {
      calls.push("run")
      return { success: true, data: input.name }
    },
    ...overrides,
  }
}

/** A spec whose run throws `error`. */
function throwingSpec(error: unknown): ActionSpec<Input, string> {
  return testSpec({
    run: async () => {
      throw error
    },
  })
}

const clientVersion = Prisma.prismaVersion.client

/** An Error carrying a Next.js digest, as redirect() and notFound() build it. */
function withDigest(digest: string): Error {
  return Object.assign(new Error(digest.split(";")[0]), { digest })
}

/** Run the same action `times` times in sequence and return every result. */
async function runTimes(
  times: number,
  deps: ActionDeps,
  spec: ActionSpec<Input, string>,
): Promise<ActionResult<string>[]> {
  const results: ActionResult<string>[] = []
  for (let i = 0; i < times; i += 1) results.push(await runAction(deps, spec, { name: "item" }))
  return results
}

describe("runAction", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const unparsable = [{ name: "   " }, {}, null, "a string"]

  it.each(unparsable)("returns spec.invalid for %j and calls neither getUser nor run", async (data) => {
    const calls: string[] = []

    const result = await runAction(fakeDeps(newUser(), calls), testSpec({}, calls), data)

    expect(result).toEqual(INVALID)
    expect(calls).toEqual([])
  })

  it("returns the unauthorized message when getUser resolves null, without running", async () => {
    const calls: string[] = []

    const result = await runAction(fakeDeps(null, calls), testSpec({}, calls), { name: "item" })

    expect(result).toEqual(UNAUTHORIZED)
    expect(calls).toEqual(["getUser"])
  })

  it("refuses the 31st mutation of a user while save and autosave still run, then refuses the 31st save", async () => {
    const deps = fakeDeps(newUser())

    const mutations = await runTimes(30, deps, testSpec({ limit: "mutation" }))
    expect(mutations.filter((r) => r.success)).toHaveLength(30)
    expect(await runAction(deps, testSpec({ limit: "mutation" }), { name: "item" })).toEqual(TOO_MANY)

    const allowed = { success: true, data: "item" }
    expect(await runAction(deps, testSpec({ limit: "save" }), { name: "item" })).toEqual(allowed)
    expect(await runAction(deps, testSpec({ limit: "autosave" }), { name: "item" })).toEqual(allowed)

    const saves = await runTimes(29, deps, testSpec({ limit: "save" }))
    expect(saves.filter((r) => r.success)).toHaveLength(29)
    expect(await runAction(deps, testSpec({ limit: "save" }), { name: "item" })).toEqual(TOO_MANY)
  })

  it("never limits a none spec, even past the autosave limit", async () => {
    const results = await runTimes(300, fakeDeps(newUser()), testSpec({ limit: "none" }))

    expect(results.filter((r) => r.success)).toHaveLength(300)
  })

  it("gives run the user from getUser and the parsed input, which drops keys the schema does not name", async () => {
    const user = newUser()
    const deps = fakeDeps(user)
    let seen: { user: ActionUser; input: Input; sameDb: boolean } | null = null
    const spec = testSpec({
      run: async (ctx) => {
        seen = { user: ctx.user, input: ctx.input, sameDb: ctx.db === deps.db }
        return { success: true, data: ctx.input.name }
      },
    })

    const result = await runAction(deps, spec, { name: "  padded  ", user_id: "someone-else" })

    expect(result).toEqual({ success: true, data: "padded" })
    expect(seen).toEqual({ user, input: { name: "padded" }, sameDb: true })
  })

  it("logs an error thrown by run under the spec name and returns spec.failure", async () => {
    const error = new Error("database unavailable")

    const result = await runAction(fakeDeps(newUser()), throwingSpec(error), { name: "item" })

    expect(result).toEqual(FAILURE)
    expect(console.error).toHaveBeenCalledWith("testAction error:", error)
  })

  it.each([
    ["an Error with a redirect digest", withDigest("NEXT_REDIRECT;replace;/x;307;")],
    ["an Error with the not-found digest", withDigest("NEXT_NOT_FOUND")],
    ["a plain object with the dynamic-usage digest", { digest: "DYNAMIC_SERVER_USAGE" }],
  ])("rethrows %s", async (_label, error) => {
    await expect(runAction(fakeDeps(newUser()), throwingSpec(error), { name: "item" })).rejects.toBe(error)
  })

  it.each([
    ["a plain Error", new Error("NEXT_REDIRECT")],
    ["a Prisma error", new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025", clientVersion })],
    ["an object whose digest is not a string", { digest: 307 }],
    ["a thrown string", "NEXT_REDIRECT"],
    ["null", null],
  ])("returns spec.failure, not a rethrow, for %s", async (_label, error) => {
    expect(await runAction(fakeDeps(newUser()), throwingSpec(error), { name: "item" })).toEqual(FAILURE)
  })

  it("returns spec.failure when getUser rejects, without running", async () => {
    const calls: string[] = []
    const deps: ActionDeps = {
      db: untouchableDb,
      getUser: async () => {
        throw new Error("cookies unavailable")
      },
    }

    expect(await runAction(deps, testSpec({}, calls), { name: "item" })).toEqual(FAILURE)
    expect(calls).toEqual([])
  })
})

describeDb("runAction with ensureProfile against Postgres", () => {
  const getDb = useTestDatabase()
  const created: string[] = []

  afterAll(async () => {
    await getDb().profile.deleteMany({ where: { id: { in: created } } })
  })

  it("creates the user's profile before run when ensureProfile is set", async () => {
    const user = newUser()
    created.push(user.id)
    const spec = testSpec({
      ensureProfile: true,
      limit: "mutation",
      run: async ({ db, user: owner }) => {
        const profile = await db.profile.findUnique({ where: { id: owner.id } })
        return { success: true, data: profile ? "profile present" : "profile missing" }
      },
    })

    const result = await runAction(fakeDeps(user, [], getDb()), spec, { name: "item" })

    expect(result).toEqual({ success: true, data: "profile present" })
    expect(await getDb().profile.count({ where: { id: user.id } })).toBe(1)
  })
})
