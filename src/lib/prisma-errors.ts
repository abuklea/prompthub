/*
Project: PromptHub
Author: Allan James
Source: src/lib/prisma-errors.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:17 GMT+10
Last modified: 29/10/2026 20:19 GMT+10
---------------
Classifies Prisma errors for the action handlers. A plain module with no Next.js import.

Changelog:
29/10/2026 20:19 GMT+10 | isNotFoundError implemented (P7S2T2)
29/10/2026 20:17 GMT+10 | Created: a stub isNotFoundError (P7S2T2)
*/
import { Prisma } from "@prisma/client"

/**
 * Whether an error is Prisma's "record not found" (P2025), which a scoped `update({ where: { id, user_id } })` raises
 * when no row matches, whether the row is missing or owned by another user.
 *
 * @param error - Any thrown value.
 * @returns True for a Prisma known request error with code P2025, false otherwise.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
}
