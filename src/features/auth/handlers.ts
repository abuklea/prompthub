/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/handlers.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:44 GMT+10
Last modified: 29/10/2026 20:45 GMT+10
---------------
The bodies of the signUp and signIn server actions, taking their dependencies (the database client, the client IP and
the Supabase auth client) so a test can drive them with a fake auth client and the test database. Each parses its
input, limits attempts per client IP, sends Supabase exactly { email, password }, creates the user's profile when it is
missing, and answers with fixed messages only: Supabase's error text and any thrown message never reach the client.

A plain module: no "use server" (every export of such a file is a public endpoint) and no Next.js import. The
"use server" wrappers in ./actions pass the real dependencies from src/lib/action-runtime.ts.

Changelog:
29/10/2026 20:45 GMT+10 | Implemented: schema parse, per-IP limit, { email, password } only, fixed messages, profile
                         failure logged and ignored (P7S2T4, issue #112)
29/10/2026 20:44 GMT+10 | Stub created (P7S2T4, red phase)
*/
import "server-only"
import type { PrismaClient } from "@prisma/client"
import type { z } from "zod"
import type { AuthDeps } from "@/lib/action-runner"
import { ensureProfileExists } from "@/lib/ensure-profile"
import { checkAuthRateLimit } from "@/lib/rate-limit"
import type { ActionResult } from "@/types/actions"
import { SignInSchema, SignUpSchema } from "./schemas"

/** The result of a successful sign-in or sign-up: where the client goes next. */
type AuthResult = ActionResult<{ redirectTo: string }>

/** The only fields Supabase receives. */
interface Credentials {
  email: string
  password: string
}

/** A Supabase auth reply, reduced to the parts the handlers read. */
interface AuthReply {
  data: { user: { id: string } | null }
  error: { code?: string } | null
}

/** What differs between sign-in and sign-up. */
interface AuthFlow {
  /** Logged with an unexpected error: `${name} error:`. */
  name: "signIn" | "signUp"
  /** Parses the untrusted input; its output carries at least the credentials. */
  schema: z.ZodType<Credentials, z.ZodTypeDef, unknown>
  /** The Supabase call. */
  call: (auth: ReturnType<AuthDeps["auth"]>, credentials: Credentials) => Promise<AuthReply>
  /** The fixed message for a rejection, chosen by Supabase's error code. */
  rejected: (code: string | undefined) => string
}

const INVALID_INPUT = "Check your email and password and try again."
const TOO_MANY_ATTEMPTS = "Too many attempts. Please try again later."
const SOMETHING_WENT_WRONG = "Something went wrong. Please try again."

const SIGN_IN: AuthFlow = {
  name: "signIn",
  schema: SignInSchema,
  call: (auth, credentials) => auth.signInWithPassword(credentials),
  rejected: (code) =>
    code === "email_not_confirmed" ? "Confirm your email address before signing in." : "Invalid email or password.",
}

const SIGN_UP: AuthFlow = {
  name: "signUp",
  schema: SignUpSchema,
  call: (auth, credentials) => auth.signUp(credentials),
  rejected: (code) => (code === "weak_password" ? "Choose a stronger password." : "Could not create the account."),
}

/**
 * Create the user's profile, logging and ignoring a failure.
 *
 * @param db - The database client.
 * @param userId - The id Supabase returned for the user.
 */
async function ensureProfileLogged(db: PrismaClient, userId: string): Promise<void> {
  try {
    await ensureProfileExists(db, userId)
  } catch (error) {
    // Reason: a profile failure must not block authentication, so a user can still sign in while the database is
    // briefly unavailable.
    console.error("Profile sync failed during auth", error)
  }
}

/**
 * Run one authentication flow: parse, limit by client IP, call Supabase with the credentials only, then ensure the
 * profile of the returned user.
 *
 * @param deps - The database client, the client IP and the Supabase auth client.
 * @param flow - Sign-in or sign-up.
 * @param data - The untrusted input from the client.
 * @returns The dashboard redirect on success; otherwise one of the fixed messages.
 */
async function authenticate(deps: AuthDeps, flow: AuthFlow, data: unknown): Promise<AuthResult> {
  try {
    const parsed = flow.schema.safeParse(data)
    if (!parsed.success) return { success: false, error: INVALID_INPUT }

    if (!checkAuthRateLimit(deps.clientIp()).allowed) return { success: false, error: TOO_MANY_ATTEMPTS }

    // Reason: built field by field, so confirmPassword and any options object a direct POST adds never reach Supabase.
    const credentials: Credentials = { email: parsed.data.email, password: parsed.data.password }
    const { data: reply, error } = await flow.call(deps.auth(), credentials)
    if (error) return { success: false, error: flow.rejected(error.code) }

    if (reply.user) await ensureProfileLogged(deps.db, reply.user.id)
    return { success: true, data: { redirectTo: "/dashboard" } }
  } catch (error) {
    console.error(`${flow.name} error:`, error)
    return { success: false, error: SOMETHING_WENT_WRONG }
  }
}

/**
 * Create an account with an email and password.
 *
 * @param deps - The database client, the client IP and the Supabase auth client.
 * @param data - The untrusted input; it must parse with SignUpSchema.
 * @returns `{ redirectTo: "/dashboard" }` on success; otherwise a fixed message: invalid input, too many attempts from
 *   this IP, "Choose a stronger password.", "Could not create the account." or the generic failure.
 */
export async function signUp(deps: AuthDeps, data: unknown): Promise<AuthResult> {
  return authenticate(deps, SIGN_UP, data)
}

/**
 * Sign in with an email and password.
 *
 * @param deps - The database client, the client IP and the Supabase auth client.
 * @param data - The untrusted input; it must parse with SignInSchema.
 * @returns `{ redirectTo: "/dashboard" }` on success; otherwise a fixed message: invalid input, too many attempts from
 *   this IP, "Confirm your email address before signing in.", "Invalid email or password." or the generic failure.
 */
export async function signIn(deps: AuthDeps, data: unknown): Promise<AuthResult> {
  return authenticate(deps, SIGN_IN, data)
}
