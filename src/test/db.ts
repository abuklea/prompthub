/*
Project: PromptHub
Author: Allan James
Source: src/test/db.ts
MIME: text/typescript
Type: TypeScript Module

Created: 22/10/2026 08:15 GMT+10
Last modified: 29/10/2026 20:32 GMT+10
---------------
Test-database helpers for suites that run against a real Postgres.

TEST_DATABASE_URL names a disposable database. assertSafeTestDatabaseUrl refuses anything that could reach another
database, and useTestDatabase builds its own PrismaClient from the URL (tests never import @/lib/db, which reads the
developer's DATABASE_URL). describeDb skips a suite when no URL exists, except in GitHub Actions, where a missing URL
throws so a misconfigured workflow cannot skip the suites silently.

Changelog:
29/10/2026 20:32 GMT+10 | Added createTestFolder, createTestTag, deleteTestUser, the folderId field of
                         createTestPrompt and withConnectionLimit, which useTestDatabase applies (P7S2T3)
22/10/2026 08:18 GMT+10 | getTestDatabaseUrl takes a plain record (ProcessEnv requires NODE_ENV); no for...of over
                         an iterator
22/10/2026 08:16 GMT+10 | Implemented the URL guard, the environment lookup, describeDb, useTestDatabase and the
                         factories
22/10/2026 08:15 GMT+10 | Stub created so db.test.ts fails on assertions
*/
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe } from "vitest"
import { PrismaClient } from "@prisma/client"
import type { Folder, Profile, Prompt, Tag } from "@prisma/client"

// Reason: the URL parser does not lower-case the host of a non-special scheme, so these are compared case-sensitively
// and an upper-case "LOCALHOST" is rejected. The hostname of a parsed IPv6 URL keeps its brackets.
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

// Reason: Prisma 6.19.0 connects to the host in `?host=` (and in `?%68ost=`) instead of the authority's. Newer versions
// may read the others too, so all three are rejected by key, never by a pattern on the raw string.
const FORBIDDEN_PARAMETERS = ["host", "hostaddr", "port"]

/**
 * Refuse a database URL that is not safe to run destructive tests against.
 *
 * The URL must parse, use the postgres or postgresql scheme, name a loopback host, end in a single database name that
 * contains a lower-case "test", and carry no `host`, `hostaddr` or `port` query parameter. Messages never include the
 * URL, so a password cannot reach a log.
 *
 * @param url The candidate TEST_DATABASE_URL.
 * @returns The same URL, when every rule holds.
 * @throws Error naming the first rule that fails: scheme, parse, loopback, database name or query parameter.
 */
export function assertSafeTestDatabaseUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("TEST_DATABASE_URL rejected: the value does not parse as a URL")
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("TEST_DATABASE_URL rejected: the scheme must be postgres or postgresql")
  }
  if (!LOOPBACK_HOSTS.includes(parsed.hostname)) {
    throw new Error("TEST_DATABASE_URL rejected: the host must be loopback (localhost, 127.0.0.1 or [::1])")
  }
  const database = parsed.pathname.slice(1)
  if (!database.includes("test") || database.includes("/")) {
    throw new Error('TEST_DATABASE_URL rejected: the database name must be one segment containing a lower-case "test"')
  }
  // Reason: the tsconfig target has no iterator support for `for...of` over searchParams.keys().
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (FORBIDDEN_PARAMETERS.includes(key.toLowerCase())) {
      throw new Error("TEST_DATABASE_URL rejected: the query parameters host, hostaddr and port are not allowed")
    }
  }
  return url
}

/**
 * Read TEST_DATABASE_URL.
 *
 * @param env The environment to read; defaults to process.env.
 * @returns The URL, or null when it is unset or empty (an empty value is unset).
 * @throws Error when it is unset or empty and GITHUB_ACTIONS is "true".
 */
export function getTestDatabaseUrl(env: Record<string, string | undefined> = process.env): string | null {
  const url = env.TEST_DATABASE_URL
  if (url) return url
  if (env.GITHUB_ACTIONS === "true") {
    throw new Error("TEST_DATABASE_URL is not set but GITHUB_ACTIONS is true: the workflow must supply it")
  }
  return null
}

/**
 * `describe` when a test database URL exists, `describe.skip` otherwise. Throws at import time in GitHub Actions when
 * the URL is missing.
 */
export const describeDb = getTestDatabaseUrl() ? describe : describe.skip

/**
 * Register the hooks that connect a suite to the test database. Call it in a describe body and read the client through
 * the returned accessor inside tests.
 *
 * The client is built in beforeAll, never in the describe body: Vitest runs the factory of a `describe.skip` at
 * collection, and a client built there would exist without a guard. beforeAll applies the guard and checks that the
 * Prompt and PromptVersion tables exist; afterAll disconnects. The client's pool is capped by withConnectionLimit.
 *
 * @returns An accessor for the PrismaClient, valid inside tests and hooks that run after beforeAll.
 */
export function useTestDatabase(): () => PrismaClient {
  let client: PrismaClient | undefined

  beforeAll(async () => {
    const url = getTestDatabaseUrl()
    if (!url) throw new Error("useTestDatabase needs TEST_DATABASE_URL: use describeDb so the suite skips without it")
    const created = new PrismaClient({ datasourceUrl: withConnectionLimit(assertSafeTestDatabaseUrl(url)) })
    client = created
    for (const table of ["Prompt", "PromptVersion"]) {
      // Reason: the ::text cast is required, Prisma cannot deserialize the regclass type.
      const quoted = `"${table}"`
      const rows = await created.$queryRaw<{ name: string | null }[]>`SELECT to_regclass(${quoted})::text AS name`
      if (rows[0].name === null) {
        throw new Error(`The test database has no "${table}" table: run npx prisma migrate deploy against it`)
      }
    }
  })

  afterAll(async () => {
    await client?.$disconnect()
  })

  return () => {
    if (!client) throw new Error("The test database client exists only inside tests, after beforeAll")
    return client
  }
}

/**
 * Create a profile with a unique id. Remove it with `db.profile.delete`, which cascades to its prompts and versions.
 *
 * @param db The client from useTestDatabase.
 * @returns The created profile.
 */
export async function createTestUser(db: PrismaClient): Promise<Profile> {
  return db.profile.create({ data: { id: randomUUID(), display_name: "test-user" } })
}

/**
 * Create a prompt owned by a user. A new document is title null and content "", as createPrompt stores it.
 *
 * @param db The client from useTestDatabase.
 * @param userId The owner, from createTestUser.
 * @param fields Optional title, content and folderId (default null: the prompt is not filed in a folder).
 * @returns The created prompt.
 */
export async function createTestPrompt(
  db: PrismaClient,
  userId: string,
  fields: { title?: string | null; content?: string; folderId?: string | null } = {},
): Promise<Prompt> {
  return db.prompt.create({
    data: {
      user_id: userId,
      title: fields.title ?? null,
      content: fields.content ?? "",
      folder_id: fields.folderId ?? null,
    },
  })
}

/**
 * Create a folder owned by a user.
 *
 * @param db The client from useTestDatabase.
 * @param userId The owner, from createTestUser.
 * @param fields Optional name (default "test-folder") and parentId (default null: a root folder).
 * @returns The created folder.
 */
export async function createTestFolder(
  db: PrismaClient,
  userId: string,
  fields: { name?: string; parentId?: string | null } = {},
): Promise<Folder> {
  return db.folder.create({
    data: { user_id: userId, name: fields.name ?? "test-folder", parent_id: fields.parentId ?? null },
  })
}

/**
 * Create a tag owned by a user. Tag names are unique per user, so the default name carries a random suffix.
 *
 * @param db The client from useTestDatabase.
 * @param userId The owner, from createTestUser.
 * @param fields Optional name (default "tag-<uuid>").
 * @returns The created tag.
 */
export async function createTestTag(db: PrismaClient, userId: string, fields: { name?: string } = {}): Promise<Tag> {
  return db.tag.create({ data: { user_id: userId, name: fields.name ?? `tag-${randomUUID()}` } })
}

/**
 * Delete a user and everything the user owns. Tag has no relation to Profile in the schema, so deleting the profile
 * would leave its tags: they go first (their links to prompts cascade), then the profile, which cascades to the
 * folders, prompts and versions. A user that does not exist is not an error.
 *
 * @param db The client from useTestDatabase.
 * @param userId The profile id, from createTestUser.
 */
export async function deleteTestUser(db: PrismaClient, userId: string): Promise<void> {
  await db.tag.deleteMany({ where: { user_id: userId } })
  await db.profile.deleteMany({ where: { id: userId } })
}

/** The pool size useTestDatabase gives a client whose URL names none. */
const CONNECTION_LIMIT = 5

/**
 * Cap the connection pool of a test database URL.
 *
 * Prisma's default pool is 2 x physical CPUs + 1 connections per client, and each Vitest worker builds its own, so
 * parallel suites can exhaust the server's max_connections. The URL is edited as a string, so an encoded password and
 * every other parameter stay byte for byte as they were.
 *
 * @param url A TEST_DATABASE_URL that parses as a URL.
 * @returns The URL with `connection_limit=5` appended, or the URL itself when it already has a `connection_limit`.
 * @throws TypeError when the URL does not parse.
 */
export function withConnectionLimit(url: string): string {
  const parsed = new URL(url)
  if (parsed.searchParams.has("connection_limit")) return url
  return `${url}${parsed.search === "" ? "?" : "&"}connection_limit=${CONNECTION_LIMIT}`
}
