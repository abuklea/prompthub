/*
Project: PromptHub
Author: Allan James
Source: src/lib/action-runtime.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:20 GMT+10
Last modified: 29/10/2026 20:20 GMT+10
---------------
The real dependencies of the action handlers: actionDeps (the Prisma client and the user from Supabase Auth) and
authDeps (the Prisma client, the client IP and the Supabase auth client). The "use server" wrappers pass these to the
handlers; the handlers never import this module, and no test imports it, because it needs a request's cookies and
headers and the developer's DATABASE_URL. Not covered by a unit test: the build and the browser checks cover it.

Changelog:
29/10/2026 20:20 GMT+10 | Created (P7S2T2, issue #110)
*/
import "server-only"
import { headers } from "next/headers"
import db from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import type { ActionDeps, AuthDeps } from "@/lib/action-runner"

// Reason: createClient() and headers() read the request scope and throw outside one, so both are called inside the
// functions on every call, never at module load.

/** The dependencies of every handler run through runAction. */
export const actionDeps: ActionDeps = {
  db,
  getUser: async () => {
    const {
      data: { user },
    } = await createClient().auth.getUser()
    return user ? { id: user.id, email: user.email ?? null } : null
  },
}

/** The dependencies of the sign-in and sign-up handlers, which run before any user exists. */
export const authDeps: AuthDeps = {
  db,
  clientIp: () => headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
  auth: () => createClient().auth,
}
