/*
Project: PromptHub
Author: Allan James
Source: src/features/dashboard/actions.ts
MIME: text/typescript
Type: TypeScript

Created: 23/02/2026 13:51 GMT+10
Last modified: 29/10/2026 20:50 GMT+10
---------------
Server action that loads the signed-in user's dashboard metrics. A one-line wrapper over its handler in ./handlers; the
wrapper passes the real dependencies from @/lib/action-runtime.

Changelog:
29/10/2026 20:50 GMT+10 | P7S2T8: a wrapper over ./handlers that returns ActionResult<DashboardMetrics>; a signed-out
                         caller gets a failure instead of zeros; DashboardMetrics moved to ./handlers; header added
23/02/2026 13:51 GMT+10 | Created (commit 2048247)
*/

"use server"

import { actionDeps } from "@/lib/action-runtime"
import * as handlers from "./handlers"

/**
 * Read the signed-in user's dashboard metrics. See `getDashboardMetrics` in ./handlers.
 *
 * @returns ActionResult with the DashboardMetrics on success; a fixed error message on any failure
 */
export async function getDashboardMetrics() {
  return handlers.getDashboardMetrics(actionDeps, undefined)
}
