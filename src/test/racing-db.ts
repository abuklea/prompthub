/*
Project: PromptHub
Author: Allan James
Source: src/test/racing-db.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:29 GMT+10
Last modified: 29/10/2026 20:32 GMT+10
---------------
Race-injection seam for the Postgres-backed action suites: a client that deletes a row just before the first update of
it, so the real database raises the real P2025. It stands in for another request deleting the row between a handler's
read and its write.

Changelog:
29/10/2026 20:31 GMT+10 | withRowDeletedBeforeUpdate implemented (P7S2T3)
29/10/2026 20:29 GMT+10 | Stub created (P7S2T3, red phase)
*/
import type { Prisma, PrismaClient } from "@prisma/client"

type Interactive = (tx: Prisma.TransactionClient) => Promise<unknown>

/**
 * A client whose first `update` on `model` with `where.id === id` is preceded by deleting that row, so the real
 * database raises the real P2025. Later calls, other models and other ids pass through.
 *
 * The delete is sent through the outer, unwrapped `db`, so it commits on its own connection before the intercepted
 * `update` runs. Both the top-level `update` and the `update` on the `tx` that `$transaction(async (tx) => ...)` hands
 * its callback are intercepted, and one flag covers both, so the row is deleted once. The array form of `$transaction`
 * passes through, and an `update` call placed inside an array would not be intercepted: it needs the callback form.
 * This is an injected seam over the real client, not a module mock.
 *
 * @param db - The client from useTestDatabase.
 * @param model - The model whose update is intercepted.
 * @param id - The row whose first update is preceded by its deletion.
 * @returns A client for the handler under test.
 */
export function withRowDeletedBeforeUpdate(db: PrismaClient, model: "folder" | "prompt", id: string): PrismaClient {
  let fired = false

  const deleteRow = async (): Promise<void> => {
    if (model === "folder") await db.folder.deleteMany({ where: { id } })
    else await db.prompt.deleteMany({ where: { id } })
  }

  const wrapDelegate = <D extends object>(delegate: D): D =>
    new Proxy(delegate, {
      get(target, name) {
        const member = Reflect.get(target, name)
        if (typeof member !== "function") return member
        if (name !== "update") return member.bind(target)
        return async (args: { where?: { id?: string } }) => {
          if (!fired && args.where?.id === id) {
            // Reason: set before the delete is awaited, so a concurrent update cannot delete the row a second time.
            fired = true
            await deleteRow()
          }
          return member.call(target, args)
        }
      },
    })

  const wrapClient = <C extends object>(client: C, topLevel: boolean): C =>
    new Proxy(client, {
      get(target, key) {
        const value = Reflect.get(target, key)
        if (key === model) return wrapDelegate(value as object)
        if (typeof value !== "function") return value
        if (topLevel && key === "$transaction") {
          return (arg: unknown, ...rest: unknown[]) => {
            if (typeof arg !== "function") return value.call(target, arg, ...rest)
            const callback = arg as Interactive
            return value.call(target, (tx: Prisma.TransactionClient) => callback(wrapClient(tx, false)), ...rest)
          }
        }
        return value.bind(target)
      },
    })

  return wrapClient(db, true)
}
