/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/request-timeout.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:24 GMT+10
---------------
The limit on server actions and the document fetch, so the handler awaiting one can reset its busy flag.

Changelog:
22/10/2026 08:21 GMT+10 | Created from the request-timeout part of the P7S1 draft spike, with async and await (P7S1T4)
*/

/** How long a request may take, including its wait in Next's action queue, before it is abandoned. */
export const REQUEST_TIMEOUT_MS = 30_000
/** The message of the error a timed-out request rejects with. */
export const REQUEST_TIMED_OUT = "The request timed out"

/**
 * Limits how long a promise may take. Next 14 orphans a server action queued behind another when the router navigates,
 * so its promise never settles. The request itself is not cancelled: a late result is ignored.
 * @param promise - The request to wait for.
 * @param ms - The limit in milliseconds; defaults to `REQUEST_TIMEOUT_MS`.
 * @returns The value of `promise` when it resolves within the limit.
 * @throws The rejection of `promise` within the limit, else an `Error` with the message `REQUEST_TIMED_OUT`.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(REQUEST_TIMED_OUT)), ms)
  })
  try {
    return await Promise.race([promise, expired])
  } finally {
    clearTimeout(timer)
  }
}
