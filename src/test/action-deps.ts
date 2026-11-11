/*
Project: PromptHub
Author: Allan James
Source: src/test/action-deps.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:29 GMT+10
Last modified: 29/10/2026 20:31 GMT+10
---------------
Fake ActionDeps for the action suites: the real test database plus a getUser that resolves a chosen user or null. The
suites pass these to a handler in place of the Supabase-backed dependencies built in src/lib/action-runtime.ts.

Changelog:
29/10/2026 20:31 GMT+10 | testDeps and signedOutDeps implemented (P7S2T3)
29/10/2026 20:29 GMT+10 | Stub created (P7S2T3, red phase)
*/
import type { PrismaClient } from "@prisma/client"
import type { ActionDeps } from "@/lib/action-runner"

/**
 * Dependencies for a signed-in user.
 *
 * @param db - The client from useTestDatabase.
 * @param userId - The id getUser resolves, normally from createTestUser.
 * @returns Deps whose getUser resolves `{ id: userId, email: "<userId>@example.test" }`.
 */
export function testDeps(db: PrismaClient, userId: string): ActionDeps {
  return { db, getUser: async () => ({ id: userId, email: `${userId}@example.test` }) }
}

/**
 * Dependencies for a request with no session.
 *
 * @param db - The client from useTestDatabase.
 * @returns Deps whose getUser resolves null.
 */
export function signedOutDeps(db: PrismaClient): ActionDeps {
  return { db, getUser: async () => null }
}
