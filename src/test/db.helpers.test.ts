/*
Project: PromptHub
Author: Allan James
Source: src/test/db.helpers.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:30 GMT+10
Last modified: 29/10/2026 20:32 GMT+10
---------------
Tests for the factories, the connection cap and the injection seams that the action suites build on: createTestFolder,
createTestTag, deleteTestUser, the folderId field of createTestPrompt, withConnectionLimit and its use in
useTestDatabase, testDeps and signedOutDeps, and withRowDeletedBeforeUpdate. withConnectionLimit is pure and always
runs; the rest run against a real Postgres only when TEST_DATABASE_URL is set.

Changelog:
29/10/2026 20:30 GMT+10 | Created (P7S2T3)
*/
import { afterAll, describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import type { PrismaClient, Profile } from "@prisma/client"
import {
  createTestFolder,
  createTestPrompt,
  createTestTag,
  createTestUser,
  deleteTestUser,
  describeDb,
  useTestDatabase,
  withConnectionLimit,
} from "./db"
import { signedOutDeps, testDeps } from "./action-deps"
import { withRowDeletedBeforeUpdate } from "./racing-db"

const BASE = "postgresql://user:pass@localhost:5432/prompthub_test"

describe("withConnectionLimit", () => {
  const ENCODED = "postgresql://us%40er:p%3Ass@127.0.0.1:5433/prompthub_test"

  it.each([
    ["has no query string", BASE, "", "?connection_limit=5"],
    ["has other parameters, which stay", BASE, "?schema=public&sslmode=disable", "&connection_limit=5"],
    ["has an encoded password, which stays", ENCODED, "", "?connection_limit=5"],
    ["has a parameter that only contains the name", BASE, "?x_connection_limit=9", "&connection_limit=5"],
  ])("appends connection_limit=5 to a URL that %s", (_name, base, query, appended) => {
    expect(withConnectionLimit(`${base}${query}`)).toBe(`${base}${query}${appended}`)
  })

  it("leaves a URL that already has a connection_limit exactly as it is", () => {
    const url = `${BASE}?connection_limit=1&schema=public`
    expect(withConnectionLimit(url)).toBe(url)
  })
})

/** Register an afterAll that deletes every user the returned factory made; call it after useTestDatabase. */
function useTrackedUsers(getDb: () => PrismaClient): () => Promise<Profile> {
  const created: string[] = []
  // Reason: registered after useTestDatabase, so the stack order of afterAll hooks runs it before the disconnect.
  afterAll(async () => {
    for (const id of created) await deleteTestUser(getDb(), id)
  })
  return async () => {
    const user = await createTestUser(getDb())
    created.push(user.id)
    return user
  }
}

describeDb("test factories", () => {
  const getDb = useTestDatabase()
  const newUser = useTrackedUsers(getDb)

  it("createTestFolder makes a root folder owned by the user, with no parent", async () => {
    const user = await newUser()
    const folder = await createTestFolder(getDb(), user.id, { name: "Root" })
    expect(folder.name).toBe("Root")
    expect(folder.user_id).toBe(user.id)
    expect(folder.parent_id).toBeNull()
  })

  it("createTestFolder makes a child linked to its parent by parent_id", async () => {
    const user = await newUser()
    const root = await createTestFolder(getDb(), user.id)
    const child = await createTestFolder(getDb(), user.id, { name: "Child", parentId: root.id })
    expect(child.parent_id).toBe(root.id)
    const reread = await getDb().folder.findUniqueOrThrow({ where: { id: child.id }, include: { parent: true } })
    expect(reread.parent?.id).toBe(root.id)
  })

  it("createTestTag makes a tag with the given name for the user, and a unique default name otherwise", async () => {
    const user = await newUser()
    const named = await createTestTag(getDb(), user.id, { name: "review" })
    const first = await createTestTag(getDb(), user.id)
    const second = await createTestTag(getDb(), user.id)
    expect([named.name, named.user_id]).toEqual(["review", user.id])
    expect(first.user_id).toBe(user.id)
    expect(first.name).not.toBe(second.name)
  })

  it("createTestPrompt with folderId files the prompt in that folder", async () => {
    const user = await newUser()
    const folder = await createTestFolder(getDb(), user.id)
    const filed = await createTestPrompt(getDb(), user.id, { folderId: folder.id })
    const loose = await createTestPrompt(getDb(), user.id)
    expect(filed.folder_id).toBe(folder.id)
    expect(loose.folder_id).toBeNull()
  })

  it("deleteTestUser removes one user's tags, prompts, versions, folders and profile and no other user's", async () => {
    const db = getDb()
    const gone = await newUser()
    const kept = await newUser()
    const seed = async (userId: string) => {
      const folder = await createTestFolder(db, userId)
      await createTestFolder(db, userId, { parentId: folder.id })
      const tag = await createTestTag(db, userId)
      const prompt = await createTestPrompt(db, userId, { folderId: folder.id })
      await db.prompt.update({ where: { id: prompt.id }, data: { tags: { connect: { id: tag.id } } } })
      await db.promptVersion.create({ data: { prompt_id: prompt.id, title_snapshot: null, content_snapshot: "" } })
      return prompt.id
    }
    const goneIdPrompt = await seed(gone.id)
    const keptPrompt = await seed(kept.id)

    await deleteTestUser(db, gone.id)

    expect(await db.profile.count({ where: { id: gone.id } })).toBe(0)
    expect(await db.folder.count({ where: { user_id: gone.id } })).toBe(0)
    expect(await db.tag.count({ where: { user_id: gone.id } })).toBe(0)
    expect(await db.prompt.count({ where: { user_id: gone.id } })).toBe(0)
    expect(await db.promptVersion.count({ where: { prompt_id: goneIdPrompt } })).toBe(0)
    expect(await db.profile.count({ where: { id: kept.id } })).toBe(1)
    expect(await db.folder.count({ where: { user_id: kept.id } })).toBe(2)
    expect(await db.tag.count({ where: { user_id: kept.id } })).toBe(1)
    expect(await db.prompt.count({ where: { user_id: kept.id } })).toBe(1)
    expect(await db.promptVersion.count({ where: { prompt_id: keptPrompt } })).toBe(1)
  })

  it("deleteTestUser does nothing for a user that no longer exists", async () => {
    const user = await createTestUser(getDb())
    await deleteTestUser(getDb(), user.id)
    await expect(deleteTestUser(getDb(), user.id)).resolves.toBeUndefined()
  })

  it("useTestDatabase caps its pool: twelve concurrent queries share at most five connections", async () => {
    // Reason: Prisma's default pool is physical CPUs x 2 + 1, above five on any machine with three or more cores. A
    // query that holds its connection for 300 ms forces the pool to open as many connections as it allows.
    const query = () => getDb().$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid()::int AS pid FROM pg_sleep(0.3)`
    const rows = await Promise.all(Array.from({ length: 12 }, query))
    const connections = new Set(rows.map((result) => result[0].pid))
    expect(connections.size).toBeLessThanOrEqual(5)
  })
})

describeDb("action deps", () => {
  const getDb = useTestDatabase()

  it("testDeps resolves the given user with an example.test email and carries the client", async () => {
    const deps = testDeps(getDb(), "user-1")
    await expect(deps.getUser()).resolves.toEqual({ id: "user-1", email: "user-1@example.test" })
    expect(deps.db).toBe(getDb())
  })

  it("signedOutDeps resolves no user and carries the client", async () => {
    const deps = signedOutDeps(getDb())
    await expect(deps.getUser()).resolves.toBeNull()
    expect(deps.db).toBe(getDb())
  })
})

describeDb("withRowDeletedBeforeUpdate", () => {
  const getDb = useTestDatabase()
  const newUser = useTrackedUsers(getDb)

  const isP2025 = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"

  it("raises P2025 from the database for a top-level folder.update of the named row and deletes only it", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const other = await createTestFolder(db, user.id)
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)

    const error = await racing.folder.update({ where: { id: target.id }, data: { name: "renamed" } }).catch((e) => e)

    expect(isP2025(error)).toBe(true)
    expect(await db.folder.count({ where: { id: target.id } })).toBe(0)
    expect(await db.folder.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({ name: other.name })
  })

  it("intercepts an update whose where carries the id beside other fields", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)

    const error = await racing.folder
      .update({ where: { id: target.id, user_id: user.id }, data: { name: "renamed" } })
      .catch((e) => e)

    expect(isP2025(error)).toBe(true)
  })

  it("raises P2025 for a tx.prompt.update in an interactive transaction that already read the row", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestPrompt(db, user.id, { title: "before" })
    const other = await createTestPrompt(db, user.id, { title: "other" })
    const racing = withRowDeletedBeforeUpdate(db, "prompt", target.id)

    const error = await racing
      .$transaction(async (tx) => {
        const read = await tx.prompt.findFirst({ where: { id: target.id, user_id: user.id } })
        expect(read?.title).toBe("before")
        return tx.prompt.update({ where: { id: target.id }, data: { title: "after" } })
      })
      .catch((e) => e)

    expect(isP2025(error)).toBe(true)
    expect(await db.prompt.count({ where: { id: target.id } })).toBe(0)
    expect(await db.prompt.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({ title: "other" })
  })

  it("intercepts only the first update: after the row is back, a second update of it succeeds", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)
    const first = await racing.folder.update({ where: { id: target.id }, data: { name: "x" } }).catch((e) => e)
    expect(isP2025(first)).toBe(true)

    // Reason: with the row deleted a second update would raise P2025 from the database anyway, so the row is re-created
    // under the same id to tell "not intercepted" from "row missing".
    await db.folder.create({ data: { id: target.id, name: "back", user_id: user.id } })
    const second = await racing.folder.update({ where: { id: target.id }, data: { name: "second" } })

    expect(second.name).toBe("second")
    expect(await db.folder.count({ where: { id: target.id } })).toBe(1)
  })

  it("does not intercept an update of another id, and still intercepts the named one afterwards", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const other = await createTestFolder(db, user.id)
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)

    const updated = await racing.folder.update({ where: { id: other.id }, data: { name: "other-renamed" } })

    expect(updated.name).toBe("other-renamed")
    expect(await db.folder.count({ where: { id: target.id } })).toBe(1)
    const error = await racing.folder.update({ where: { id: target.id }, data: { name: "x" } }).catch((e) => e)
    expect(isP2025(error)).toBe(true)
  })

  it("does not intercept an update of another model, even with the named id", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const prompt = await createTestPrompt(db, user.id, { title: "p" })
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)

    const updated = await racing.prompt.update({ where: { id: prompt.id }, data: { title: "p2" } })

    expect(updated.title).toBe("p2")
    expect(await db.folder.count({ where: { id: target.id } })).toBe(1)
  })

  it("passes the array form of $transaction and other client members through", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)

    const [folders, prompts] = await racing.$transaction([
      racing.folder.findMany({ where: { user_id: user.id } }),
      racing.prompt.findMany({ where: { user_id: user.id } }),
    ])
    const raw = await racing.$queryRaw<{ one: number }[]>`SELECT 1::int AS one`

    expect(folders.map((folder) => folder.id)).toEqual([target.id])
    expect(prompts).toEqual([])
    expect(raw[0].one).toBe(1)
    expect(await db.folder.count({ where: { id: target.id } })).toBe(1)
  })

  it("lets an interactive transaction that never updates the named row commit", async () => {
    const db = getDb()
    const user = await newUser()
    const target = await createTestFolder(db, user.id)
    const racing = withRowDeletedBeforeUpdate(db, "folder", target.id)

    const created = await racing.$transaction(async (tx) => tx.folder.create({ data: { name: "n", user_id: user.id } }))

    expect(await db.folder.count({ where: { id: created.id } })).toBe(1)
    expect(await db.folder.count({ where: { id: target.id } })).toBe(1)
  })
})
