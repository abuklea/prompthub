/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/handlers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:44 GMT+10
Last modified: 29/10/2026 20:44 GMT+10
---------------
Tests for the signIn and signUp handlers: only { email, password } reaches Supabase, invalid input never does, the
client sees fixed messages and never Supabase's or a thrown error's text, the per-IP limit refuses the sixth attempt,
and the profile is created after a success, whose result a profile failure does not change. A fake auth client records
its arguments and returns a configured reply (an injected seam, not a module mock); the profile cases run against the
test database (skipped without TEST_DATABASE_URL). Each test uses its own client IP, because the auth limiter keeps
module-level state.

Changelog:
29/10/2026 20:44 GMT+10 | Created (P7S2T4, issue #112)
*/
import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { AuthApiError } from "@supabase/supabase-js"
import type { AuthDeps } from "@/lib/action-runner"
import { deleteTestUser, describeDb, useTestDatabase } from "@/test/db"
import { signIn, signUp } from "./handlers"

const INVALID_INPUT = "Check your email and password and try again."
const TOO_MANY = "Too many attempts. Please try again later."
const SOMETHING_WRONG = "Something went wrong. Please try again."
const OK = { success: true, data: { redirectTo: "/dashboard" } }

const EMAIL = "ada@example.test"
const PASSWORD = "correct-horse-battery"

/** What the fake auth client answers: a Supabase reply, or an error it throws. */
type Reply = { user: { id: string } | null; error: AuthApiError | null } | { throws: Error }

/** One recorded call of the fake auth client. */
interface AuthCall {
  method: "signInWithPassword" | "signUp"
  credentials: unknown
}

/** A fake Supabase auth client and the calls it received. */
interface FakeAuth {
  calls: AuthCall[]
  auth: AuthDeps["auth"]
}

/**
 * Build a fake auth client that records every call and answers each with `reply`.
 *
 * @param reply - The `{ data, error }` to return, or an error to throw.
 * @returns The recorded calls and an `auth` dependency that returns the fake.
 */
function fakeAuth(reply: Reply): FakeAuth {
  const calls: AuthCall[] = []
  const respond = async (method: AuthCall["method"], credentials: unknown) => {
    calls.push({ method, credentials })
    if ("throws" in reply) throw reply.throws
    return { data: { user: reply.user, session: null }, error: reply.error }
  }
  // Reason: the handlers read only data.user.id and error.code, so the fake builds no full Supabase User or Session.
  const client = {
    signInWithPassword: (credentials: unknown) => respond("signInWithPassword", credentials),
    signUp: (credentials: unknown) => respond("signUp", credentials),
  } as unknown as ReturnType<AuthDeps["auth"]>
  return { calls, auth: () => client }
}

// Reason: the paths that never reach a user must not touch the database, so any property read on this client throws.
const NO_DB = new Proxy({} as PrismaClient, {
  get() {
    throw new Error("the database was touched")
  },
})

/** A client IP no other test uses, so the module-level auth limiter starts empty for it. */
const newIp = (): string => `test-ip-${randomUUID()}`

/**
 * Build the handler dependencies.
 *
 * @param fake - The fake auth client.
 * @param db - The database client; defaults to one that throws when touched.
 * @param ip - The client IP; defaults to a fresh one.
 */
function depsOf(fake: FakeAuth, db: PrismaClient = NO_DB, ip: string = newIp()): AuthDeps {
  return { db, clientIp: () => ip, auth: fake.auth }
}

/** A Supabase rejection carrying a message the client must never see. */
const rejection = (code: string | undefined) =>
  new AuthApiError(`raw supabase text for ${code ?? "no code"}`, 400, code)

/** A reply with no user and no error, so the handler succeeds without reaching the profile step. */
const NO_USER: Reply = { user: null, error: null }

describe("auth handlers", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("signIn: valid input reaches signInWithPassword as exactly { email, password }", async () => {
    const fake = fakeAuth(NO_USER)

    const result = await signIn(depsOf(fake), { email: EMAIL, password: PASSWORD })

    expect(result).toEqual(OK)
    expect(fake.calls).toEqual([{ method: "signInWithPassword", credentials: { email: EMAIL, password: PASSWORD } }])
  })

  it("signIn: confirmPassword and an options object never reach signInWithPassword", async () => {
    const fake = fakeAuth(NO_USER)
    const input = { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD, options: { captchaToken: "x" } }

    await signIn(depsOf(fake), input)

    expect(fake.calls).toEqual([{ method: "signInWithPassword", credentials: { email: EMAIL, password: PASSWORD } }])
  })

  it("signUp: valid input reaches signUp as exactly { email, password }, without confirmPassword", async () => {
    const fake = fakeAuth(NO_USER)

    const result = await signUp(depsOf(fake), { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD })

    expect(result).toEqual(OK)
    expect(fake.calls).toEqual([{ method: "signUp", credentials: { email: EMAIL, password: PASSWORD } }])
  })

  it("signUp: an options object added by a direct POST never reaches signUp", async () => {
    const fake = fakeAuth(NO_USER)
    const options = { data: { role: "admin" }, emailRedirectTo: "https://attacker.example.test" }

    await signUp(depsOf(fake), { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD, options })

    expect(fake.calls).toEqual([{ method: "signUp", credentials: { email: EMAIL, password: PASSWORD } }])
  })

  it.each([
    ["an invalid email", { email: "not-an-email", password: PASSWORD }],
    ["a short password", { email: EMAIL, password: "short" }],
    ["no object at all", null],
  ])("signIn: %s returns the fixed text and never calls auth", async (_case, input) => {
    const fake = fakeAuth(NO_USER)

    const result = await signIn(depsOf(fake), input)

    expect(result).toEqual({ success: false, error: INVALID_INPUT })
    expect(fake.calls).toEqual([])
  })

  it.each([
    ["an invalid email", { email: "not-an-email", password: PASSWORD, confirmPassword: PASSWORD }],
    ["a short password", { email: EMAIL, password: "short", confirmPassword: "short" }],
    ["a confirmPassword mismatch", { email: EMAIL, password: PASSWORD, confirmPassword: `${PASSWORD}-other` }],
    ["a missing confirmPassword", { email: EMAIL, password: PASSWORD }],
  ])("signUp: %s returns the fixed text and never calls auth", async (_case, input) => {
    const fake = fakeAuth(NO_USER)

    const result = await signUp(depsOf(fake), input)

    expect(result).toEqual({ success: false, error: INVALID_INPUT })
    expect(fake.calls).toEqual([])
  })

  it.each([
    ["email_not_confirmed", "Confirm your email address before signing in."],
    ["invalid_credentials", "Invalid email or password."],
    [undefined, "Invalid email or password."],
  ])("signIn: a rejection with code %s returns its fixed message", async (code, message) => {
    const fake = fakeAuth({ user: null, error: rejection(code) })

    const result = await signIn(depsOf(fake), { email: EMAIL, password: PASSWORD })

    expect(result).toEqual({ success: false, error: message })
  })

  it.each([
    ["weak_password", "Choose a stronger password."],
    ["user_already_exists", "Could not create the account."],
    ["email_not_confirmed", "Could not create the account."],
    [undefined, "Could not create the account."],
  ])("signUp: a rejection with code %s returns its fixed message", async (code, message) => {
    const fake = fakeAuth({ user: null, error: rejection(code) })

    const result = await signUp(depsOf(fake), { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD })

    expect(result).toEqual({ success: false, error: message })
  })

  it("signIn: a thrown error returns the generic text and no part of its message", async () => {
    const fake = fakeAuth({ throws: new Error("connect ECONNREFUSED 10.1.2.3:443 internal-detail") })

    const result = await signIn(depsOf(fake), { email: EMAIL, password: PASSWORD })

    expect(result).toEqual({ success: false, error: SOMETHING_WRONG })
  })

  it("signUp: a thrown error returns the generic text and no part of its message", async () => {
    const fake = fakeAuth({ throws: new Error("connect ECONNREFUSED 10.1.2.3:443 internal-detail") })

    const result = await signUp(depsOf(fake), { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD })

    expect(result).toEqual({ success: false, error: SOMETHING_WRONG })
  })

  it("signIn: the sixth attempt from one IP within a minute is refused and a different IP is not", async () => {
    const fake = fakeAuth({ user: null, error: rejection("invalid_credentials") })
    const ip = newIp()
    const input = { email: EMAIL, password: PASSWORD }
    const rejected = { success: false, error: "Invalid email or password." }

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(await signIn(depsOf(fake, NO_DB, ip), input)).toEqual(rejected)
    }
    expect(await signIn(depsOf(fake, NO_DB, ip), input)).toEqual({ success: false, error: TOO_MANY })
    expect(fake.calls).toHaveLength(5)

    expect(await signIn(depsOf(fake, NO_DB, newIp()), input)).toEqual(rejected)
    expect(fake.calls).toHaveLength(6)
  })

  it("signUp: the sixth attempt from one IP within a minute is refused and a different IP is not", async () => {
    const fake = fakeAuth({ user: null, error: rejection(undefined) })
    const ip = newIp()
    const input = { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }
    const rejected = { success: false, error: "Could not create the account." }

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(await signUp(depsOf(fake, NO_DB, ip), input)).toEqual(rejected)
    }
    expect(await signUp(depsOf(fake, NO_DB, ip), input)).toEqual({ success: false, error: TOO_MANY })
    expect(fake.calls).toHaveLength(5)

    expect(await signUp(depsOf(fake, NO_DB, newIp()), input)).toEqual(rejected)
    expect(fake.calls).toHaveLength(6)
  })
})

/**
 * Wrap a real client so that profile.createMany rejects; every other call reaches the database.
 *
 * @param db - The client from useTestDatabase.
 * @returns A client whose profile creation fails.
 */
function withFailingProfileCreate(db: PrismaClient): PrismaClient {
  return new Proxy(db, {
    get(target, key) {
      const value = Reflect.get(target, key)
      if (key !== "profile") return value
      return new Proxy(value, {
        get(delegate, name) {
          if (name === "createMany") return async () => Promise.reject(new Error("injected profile failure"))
          return Reflect.get(delegate, name)
        },
      })
    },
  })
}

describeDb("auth handlers and the profile row", () => {
  const getDb = useTestDatabase()
  const created: string[] = []

  /** A fresh Supabase user id, whose profile is removed after the suite. */
  const newUserId = (): string => {
    const id = randomUUID()
    created.push(id)
    return id
  }

  afterAll(async () => {
    for (const id of created) await deleteTestUser(getDb(), id)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("signIn: a successful sign-in creates the missing profile and returns the dashboard", async () => {
    const id = newUserId()
    const fake = fakeAuth({ user: { id }, error: null })

    const result = await signIn(depsOf(fake, getDb()), { email: EMAIL, password: PASSWORD })

    expect(result).toEqual(OK)
    expect(await getDb().profile.findUnique({ where: { id } })).toMatchObject({ id })
  })

  it("signUp: a successful sign-up creates the profile and returns the dashboard", async () => {
    const id = newUserId()
    const fake = fakeAuth({ user: { id }, error: null })

    const result = await signUp(depsOf(fake, getDb()), { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD })

    expect(result).toEqual(OK)
    expect(await getDb().profile.findUnique({ where: { id } })).toMatchObject({ id })
  })

  it("signIn: a profile failure after a successful sign-in is logged and the sign-in still succeeds", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const id = newUserId()
    const fake = fakeAuth({ user: { id }, error: null })

    const result = await signIn(depsOf(fake, withFailingProfileCreate(getDb())), { email: EMAIL, password: PASSWORD })

    expect(result).toEqual(OK)
    expect(await getDb().profile.findUnique({ where: { id } })).toBeNull()
    expect(logged.mock.calls.map((args) => args[0])).toEqual(["Profile sync failed during auth"])
  })

  it("signUp: a profile failure after a successful sign-up is logged and the sign-up still succeeds", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})
    const id = newUserId()
    const fake = fakeAuth({ user: { id }, error: null })
    const input = { email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }

    const result = await signUp(depsOf(fake, withFailingProfileCreate(getDb())), input)

    expect(result).toEqual(OK)
    expect(await getDb().profile.findUnique({ where: { id } })).toBeNull()
    expect(logged.mock.calls.map((args) => args[0])).toEqual(["Profile sync failed during auth"])
  })
})
