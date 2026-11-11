/*
Project: PromptHub
Author: Allan James
Source: src/lib/rate-limit.autosave.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:18 GMT+10
Last modified: 29/10/2026 20:18 GMT+10
---------------
Tests for the named limiters of rate-limit.ts: autosave allows 240 calls a minute per identifier, save and mutation 30,
auth 5, each window is 60 seconds, and the four stores count independently of one another.

Changelog:
29/10/2026 20:18 GMT+10 | Created (P7S2T2)
*/
import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { checkAuthRateLimit, checkAutosaveRateLimit, checkMutationRateLimit, checkSaveRateLimit } from "./rate-limit"

type Check = (identifier: string) => { allowed: boolean; retryAfterMs: number }

const LIMITERS: { name: string; check: Check; max: number }[] = [
  { name: "auth", check: checkAuthRateLimit, max: 5 },
  { name: "mutation", check: checkMutationRateLimit, max: 30 },
  { name: "save", check: checkSaveRateLimit, max: 30 },
  { name: "autosave", check: checkAutosaveRateLimit, max: 240 },
]

/** Call `check` `calls` times for one identifier and count the calls it allowed. */
function countAllowed(check: Check, identifier: string, calls: number): number {
  let allowed = 0
  for (let i = 0; i < calls; i += 1) {
    if (check(identifier).allowed) allowed += 1
  }
  return allowed
}

describe("named rate limiters", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows 240 autosave calls for one identifier and refuses the 241st", () => {
    const id = randomUUID()

    expect(countAllowed(checkAutosaveRateLimit, id, 240)).toBe(240)
    expect(checkAutosaveRateLimit(id).allowed).toBe(false)
  })

  it("allows 30 save calls for one identifier and refuses the 31st", () => {
    const id = randomUUID()

    expect(countAllowed(checkSaveRateLimit, id, 30)).toBe(30)
    expect(checkSaveRateLimit(id).allowed).toBe(false)
  })

  it.each([
    { name: "save", check: checkSaveRateLimit, max: 30 },
    { name: "autosave", check: checkAutosaveRateLimit, max: 240 },
  ])("refuses $name until the 60 second window has passed", ({ check, max }) => {
    const id = randomUUID()
    countAllowed(check, id, max)

    vi.advanceTimersByTime(59_999)
    expect(check(id).allowed).toBe(false)

    vi.advanceTimersByTime(2)
    expect(check(id).allowed).toBe(true)
  })

  it.each(LIMITERS)("exhausting $name for an identifier leaves the other stores open", ({ name, check, max }) => {
    const id = randomUUID()

    expect(countAllowed(check, id, max)).toBe(max)
    expect(check(id).allowed).toBe(false)

    const others = LIMITERS.filter((limiter) => limiter.name !== name)
    expect(others.map((limiter) => [limiter.name, limiter.check(id).allowed])).toEqual(
      others.map((limiter) => [limiter.name, true]),
    )
  })
})
