/*
Project: PromptHub
Author: Allan James
Source: src/lib/action-runner.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:17 GMT+10
Last modified: 29/10/2026 20:19 GMT+10
---------------
The action seam: runAction runs the body of one server action in a fixed order (parse, authenticate, rate-limit,
optionally ensure the profile, run) against dependencies it is given, so a test drives it with a real test database and
a fake getUser. A plain module: no "use server" and no Next.js import; the real dependencies are built in
src/lib/action-runtime.ts.

Changelog:
29/10/2026 20:19 GMT+10 | runAction implemented: the fixed order, the limiter per limit class, the digest rethrow
                         (P7S2T2, issue #110)
29/10/2026 20:17 GMT+10 | Created: types and a stub runAction (P7S2T2)
*/
import "server-only"
import type { PrismaClient } from "@prisma/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { z } from "zod"
import type { ActionResult } from "@/types/actions"
import { ensureProfileExists } from "@/lib/ensure-profile"
import { checkAutosaveRateLimit, checkMutationRateLimit, checkSaveRateLimit } from "@/lib/rate-limit"

/** The signed-in user as a handler needs it: id and email from supabase.auth.getUser(). */
export interface ActionUser {
  /** The Supabase Auth user id, which is also the Profile id. */
  id: string
  /** The user's email, or null when Supabase has none. */
  email: string | null
}

/** What a handler is given. The real values are built in src/lib/action-runtime.ts; a test passes its own. */
export interface ActionDeps {
  /** Resolves the authenticated user, or null. Real: supabase.auth.getUser() on the request's cookies. */
  getUser: () => Promise<ActionUser | null>
  /** The Prisma client. Real: @/lib/db. A test passes the useTestDatabase client. */
  db: PrismaClient
}

/** What the sign-in and sign-up handlers are given: they run before any user exists, so they cannot use runAction. */
export interface AuthDeps {
  /** The Prisma client. Real: @/lib/db. */
  db: PrismaClient
  /** The first x-forwarded-for value or "unknown". Real: headers().get(...) in action-runtime.ts. */
  clientIp: () => string
  /** Built per call, because createClient() reads the request's cookies. */
  auth: () => Pick<SupabaseClient["auth"], "signInWithPassword" | "signUp">
}

/** Which limiter applies: shared mutation (30/min), save (30/min), autosave (240/min), or none (a read). */
export type LimitClass = "mutation" | "save" | "autosave" | "none"

/** One action's body and its fixed messages, run by runAction. */
export interface ActionSpec<I, O> {
  /** Logged with an unexpected error: `${name} error:`. */
  name: string
  /** Parses `data`; a schema with defaults has a wider input than output, hence the third type argument. */
  schema: z.ZodType<I, z.ZodTypeDef, unknown>
  /** The message for a failed parse, e.g. "Invalid prompt ID". Never a Zod message: it can echo the input. */
  invalid: string
  /** The message for an unexpected error, e.g. "Failed to rename prompt". */
  failure: string
  /** The limiter applied to the user's id after authentication. */
  limit: LimitClass
  /** Call ensureProfileExists(db, user.id) after the limit and before `run` (createPrompt, createFolder, profile). */
  ensureProfile?: boolean
  /** The action's work, given the authenticated user and the parsed input; it scopes every query by user.id. */
  run: (ctx: { db: PrismaClient; user: ActionUser; input: I }) => Promise<ActionResult<O>>
}

type RateLimitCheck = (identifier: string) => { allowed: boolean }

const LIMITERS: Record<Exclude<LimitClass, "none">, RateLimitCheck> = {
  mutation: checkMutationRateLimit,
  save: checkSaveRateLimit,
  autosave: checkAutosaveRateLimit,
}

/**
 * Whether a thrown value is a Next.js control-flow error (redirect, notFound, dynamic usage), which must propagate.
 *
 * @param error - Any thrown value.
 * @returns True for an object with a string `digest` property.
 */
function isNextControlFlowError(error: unknown): boolean {
  // Reason: Next 14.2 marks these errors with a string digest (NEXT_REDIRECT;..., NEXT_NOT_FOUND, DYNAMIC_SERVER_USAGE)
  // and its redirect and dynamic-usage helpers test for them the same way; this is the one place the actions check it.
  return typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
}

/**
 * Run one action body in the fixed order: parse the input, authenticate, rate-limit by the user's id, optionally
 * ensure the user's profile, then run. The user comes only from `deps.getUser` and the input carries no user id, so
 * `spec.run` cannot scope a query by a value the client chose.
 *
 * @param deps - The database client and the user resolver.
 * @param spec - The action's schema, messages, limit class and body.
 * @param data - The untrusted input from the client.
 * @returns `spec.run`'s result; `spec.invalid` for input that does not parse; the fixed unauthorized or rate-limit
 *   message; `spec.failure` for any other error, which is logged.
 * @throws A Next.js control-flow error (an object with a string `digest`), rethrown unchanged.
 */
export async function runAction<I, O>(
  deps: ActionDeps,
  spec: ActionSpec<I, O>,
  data: unknown,
): Promise<ActionResult<O>> {
  try {
    const parsed = spec.schema.safeParse(data)
    if (!parsed.success) return { success: false, error: spec.invalid }

    const user = await deps.getUser()
    if (!user) return { success: false, error: "Unauthorized. Please sign in." }

    if (spec.limit !== "none" && !LIMITERS[spec.limit](user.id).allowed) {
      return { success: false, error: "Too many requests. Please slow down." }
    }

    if (spec.ensureProfile) await ensureProfileExists(deps.db, user.id)

    return await spec.run({ db: deps.db, user, input: parsed.data })
  } catch (error) {
    if (isNextControlFlowError(error)) throw error
    console.error(`${spec.name} error:`, error)
    return { success: false, error: spec.failure }
  }
}
