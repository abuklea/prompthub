/*
Project: PromptHub
Author: Allan James
Source: src/lib/ensure-profile.ts
MIME: text/typescript
Type: TypeScript Module

Created: 24/02/2026 08:15 GMT+10
Last modified: 29/10/2026 20:04 GMT+10
---------------
Creates a user's Profile row when it is missing. Profiles are created in application code because Supabase Cloud does
not permit triggers on auth.users.

No "use server" directive: every export of such a file is a public endpoint, and this function trusts the userId it is
given. Only server code calls it, with an id from Supabase Auth; `server-only` makes a Client Component import of it a
build error.

Changelog:
29/10/2026 20:04 GMT+10 | Takes the database client; writes with createMany and skipDuplicates so concurrent first calls
                         cannot raise P2002; "use server" replaced by server-only; header added (P7S2T1, issue #40)
24/02/2026 08:15 GMT+10 | Created (commit 5e711c6)
*/
import "server-only"
import type { PrismaClient } from "@prisma/client"

/** The part of the Prisma client ensureProfileExists uses. */
export type ProfileDb = Pick<PrismaClient, "profile">

/**
 * Create the user's Profile row if it does not exist, before writing anything that references it. An existing profile
 * is left untouched, and concurrent first calls for one user all succeed and leave one row.
 *
 * @param db - The database client.
 * @param userId - The user's id from Supabase Auth; the caller has authenticated it.
 * @returns Nothing, once the row exists.
 * @throws Any database error other than the duplicate key, which is skipped.
 */
export async function ensureProfileExists(db: ProfileDb, userId: string): Promise<void> {
  // Reason: createMany with skipDuplicates sends INSERT ... ON CONFLICT DO NOTHING: it cannot raise P2002 and writes
  // nothing for an existing profile. upsert({ update: {} }) fell back to SELECT then INSERT and raced in 205 to 210 of
  // 240 concurrent first calls (observed 26/10/2026, not in the Prisma documentation); createMany passed all 240.
  await db.profile.createMany({ data: [{ id: userId }], skipDuplicates: true })
}
