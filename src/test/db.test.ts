/*
Project: PromptHub
Author: Allan James
Source: src/test/db.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 22/10/2026 08:15 GMT+10
Last modified: 22/10/2026 08:18 GMT+10
---------------
Tests for the test-database helpers: the URL guard and the environment lookup always run; the smoke test runs
against a real Postgres only when TEST_DATABASE_URL is set.

Changelog:
22/10/2026 08:18 GMT+10 | The describeDb check observes whether the smoke suite ran (describe.skip is not comparable
                         by identity)
22/10/2026 08:15 GMT+10 | Created
*/
import { describe, it, expect } from "vitest"
import {
  assertSafeTestDatabaseUrl,
  getTestDatabaseUrl,
  describeDb,
  useTestDatabase,
  createTestUser,
  createTestPrompt,
} from "./db"

const SAFE = "postgresql://user:pass@localhost:5432/prompthub_test"

describe("assertSafeTestDatabaseUrl", () => {
  it.each([
    ["localhost", SAFE],
    ["127.0.0.1", "postgresql://user:pass@127.0.0.1:5432/prompthub_test"],
    ["[::1]", "postgresql://user:pass@[::1]:5432/prompthub_test"],
    ["the postgres scheme", "postgres://user:pass@localhost:5432/prompthub_test"],
    ["a database named test", "postgresql://user:pass@localhost/test"],
    ["a non-host query parameter", `${SAFE}?schema=public&connection_limit=1`],
  ])("accepts %s and returns the URL unchanged", (_name, url) => {
    expect(assertSafeTestDatabaseUrl(url)).toBe(url)
  })

  it.each([
    ["mysql://user:pass@localhost:3306/prompthub_test"],
    ["http://localhost:5432/prompthub_test"],
  ])("rejects a scheme other than postgres or postgresql: %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/scheme/)
  })

  it.each([
    ["not a url"],
    [""],
    ["postgresql://user:pass@a:1,b:2/prompthub_test"],
  ])("rejects a URL that does not parse (a second host in the authority is one): %j", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/parse/)
  })

  it.each([
    ["a remote host", "postgresql://user:pass@db.example.com:5432/prompthub_test"],
    ["a Supabase host", "postgresql://user:pass@db.abcdefgh.supabase.co:5432/prompthub_test"],
    ["an upper-case loopback name", "postgresql://user:pass@LOCALHOST:5432/prompthub_test"],
    ["a loopback name followed by another host", "postgresql://user:pass@localhost,db.example.com/prompthub_test"],
    ["no host", "postgresql:///prompthub_test"],
    ["a non-loopback IPv4 address", "postgresql://user:pass@10.0.0.5:5432/prompthub_test"],
  ])("rejects %s", (_name, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/loopback/)
  })

  it.each([
    ["postgres", "postgresql://user:pass@localhost:5432/postgres"],
    ["prompthub", "postgresql://user:pass@localhost:5432/prompthub"],
    ["an upper-case Test", "postgresql://user:pass@localhost:5432/Test"],
    ["no database", "postgresql://user:pass@localhost:5432"],
    ["a nested path", "postgresql://user:pass@localhost:5432/a/test"],
  ])("rejects a database name without a lower-case test: %s", (_name, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/database name/)
  })

  it.each([
    ["host", `${SAFE}?host=db.example.com`],
    ["an encoded %68ost", `${SAFE}?%68ost=db.example.com`],
    ["hostaddr", `${SAFE}?hostaddr=203.0.113.9`],
    ["port", `${SAFE}?port=6543`],
    ["HOST", `${SAFE}?HOST=db.example.com`],
    ["Host", `${SAFE}?Host=db.example.com`],
    ["PORT", `${SAFE}?PORT=6543`],
    ["HostAddr", `${SAFE}?HostAddr=203.0.113.9`],
    ["a host after another parameter", `${SAFE}?schema=public&host=db.example.com`],
  ])("rejects the query parameter %s", (_name, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/query parameter/)
  })

  it("does not echo the URL, so a password never reaches a log", () => {
    const url = "postgresql://user:s3cret-value@db.example.com:5432/prompthub_test"
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/^(?!.*s3cret-value)/s)
  })
})

describe("getTestDatabaseUrl", () => {
  it("returns the URL when TEST_DATABASE_URL is set", () => {
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: SAFE })).toBe(SAFE)
  })

  it.each([[undefined], [""]])("returns null when TEST_DATABASE_URL is %j", (value) => {
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: value })).toBeNull()
  })

  it.each([[undefined], [""]])("throws in GitHub Actions when TEST_DATABASE_URL is %j", (value) => {
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: value, GITHUB_ACTIONS: "true" })).toThrow(/GITHUB_ACTIONS/)
  })

  it("returns the URL in GitHub Actions when it is set", () => {
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: SAFE, GITHUB_ACTIONS: "true" })).toBe(SAFE)
  })

  it("treats any GITHUB_ACTIONS value other than true as outside Actions", () => {
    expect(getTestDatabaseUrl({ GITHUB_ACTIONS: "false" })).toBeNull()
  })
})

// Reason: `describe.skip` is a new function on every access, so identity cannot be compared; observe whether the
// smoke suite below ran instead. Vitest runs the tests of one file in order, so the flag is set before the check.
let smokeSuiteRan = false

describeDb("test database smoke test", () => {
  const getDb = useTestDatabase()

  it("connects to a database whose name contains test", async () => {
    smokeSuiteRan = true
    const rows = await getDb().$queryRaw<{ name: string }[]>`SELECT current_database()::text AS name`
    expect(rows[0].name).toMatch(/test/)
  })

  it("creates a user and a default prompt, and deleting the user cascades to prompts and versions", async () => {
    const db = getDb()
    const user = await createTestUser(db)
    const prompt = await createTestPrompt(db, user.id)
    expect(prompt.user_id).toBe(user.id)
    expect(prompt.title).toBeNull()
    expect(prompt.content).toBe("")
    const version = await db.promptVersion.create({
      data: { prompt_id: prompt.id, title_snapshot: null, content_snapshot: "" },
    })
    expect(version.diff).toBe("")

    await db.profile.delete({ where: { id: user.id } })

    expect(await db.prompt.count({ where: { id: prompt.id } })).toBe(0)
    expect(await db.promptVersion.count({ where: { prompt_id: prompt.id } })).toBe(0)
  })

  it("stores the fields it is given and gives every user and prompt a unique id", async () => {
    const db = getDb()
    const first = await createTestUser(db)
    const second = await createTestUser(db)
    try {
      const a = await createTestPrompt(db, first.id, { title: "Title", content: "Body" })
      const b = await createTestPrompt(db, first.id, { title: "Title", content: "Body" })
      expect([a.title, a.content]).toEqual(["Title", "Body"])
      expect(first.id).not.toBe(second.id)
      expect(a.id).not.toBe(b.id)
    } finally {
      await db.profile.deleteMany({ where: { id: { in: [first.id, second.id] } } })
    }
  })
})

describe("describeDb", () => {
  it("runs its suite when a database URL exists and skips it otherwise", () => {
    expect(smokeSuiteRan).toBe(getTestDatabaseUrl() !== null)
  })
})
