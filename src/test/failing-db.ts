/*
Project: PromptHub
Author: Allan James
Source: src/test/failing-db.ts
MIME: text/typescript
Type: TypeScript Module

Created: 22/10/2026 09:04 GMT+10
Last modified: 22/10/2026 09:04 GMT+10
---------------
Failure-injection seam for the Postgres-backed service suites: a database whose transactions throw on a chosen
promptVersion.create, so a test can prove that everything the transaction wrote is rolled back.

Changelog:
22/10/2026 09:04 GMT+10 | Created from the two copies in service.save.test.ts and service.restore.test.ts (P7S1T3)
*/
import type { Prisma, PrismaClient } from "@prisma/client"

/** The part of the Prisma client the editor service uses; the same shape as the service's EditorDb. */
export type FailingDb = Pick<PrismaClient, "prompt" | "promptVersion" | "$transaction">

/**
 * Wrap a real client so that each interactive transaction hands its callback the real transaction client, with a
 * Proxy over promptVersion.create that throws on its `failOn`-th call within that transaction. This is an injected seam
 * over the real client, not a module mock: every other call, and the creates before the failing one, reach the
 * database.
 *
 * @param db - The client from useTestDatabase.
 * @param failOn - Which promptVersion.create call within a transaction throws; 1 is the first.
 * @returns A database for the service functions whose transactions fail as described, so Prisma rolls them back.
 */
export function withFailingVersionCreate(db: PrismaClient, failOn = 1): FailingDb {
  const wrap = (tx: Prisma.TransactionClient): Prisma.TransactionClient => {
    let creates = 0
    return new Proxy(tx, {
      get(target, key) {
        const value = Reflect.get(target, key)
        if (key !== "promptVersion") return value
        return new Proxy(value, {
          get(delegate, name) {
            const member = Reflect.get(delegate, name)
            if (name !== "create") return member
            return async (args: Prisma.PromptVersionCreateArgs) => {
              creates += 1
              if (creates === failOn) throw new Error("injected failure")
              return delegate.create(args)
            }
          },
        })
      },
    })
  }
  const $transaction = ((fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    db.$transaction((tx) => fn(wrap(tx)))) as FailingDb["$transaction"]
  return { prompt: db.prompt, promptVersion: db.promptVersion, $transaction }
}
