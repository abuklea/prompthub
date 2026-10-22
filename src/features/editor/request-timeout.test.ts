/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/request-timeout.test.ts
MIME: text/typescript
Type: TypeScript test (Vitest, node)

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:16 GMT+10
---------------
Unit tests of withTimeout under fake timers: a value or a rejection passes through before the limit, the promise
rejects with REQUEST_TIMED_OUT at the limit, and no timer is left pending once it has settled either way.

Changelog:
22/10/2026 08:16 GMT+10 | Created from the withTimeout block of the P7S1 draft spike suite (P7S1T4)
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REQUEST_TIMED_OUT, REQUEST_TIMEOUT_MS, withTimeout } from "./request-timeout"

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves with the value and leaves no timer behind", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("resolves with a value that arrives just before the limit", async () => {
    let settle = (_value: string) => {}
    const slow = new Promise<string>((resolve) => {
      settle = resolve
    })
    const limited = withTimeout(slow, 1000)
    await vi.advanceTimersByTimeAsync(999)
    settle("in time")
    await expect(limited).resolves.toBe("in time")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("passes a rejection through and leaves no timer behind", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000)).rejects.toThrow("boom")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects when the promise has not settled within the limit, and ignores a late result", async () => {
    let settle = (_value: string) => {}
    const slow = new Promise<string>((resolve) => {
      settle = resolve
    })
    const limited = withTimeout(slow, 1000)
    const outcome = expect(limited).rejects.toThrow(REQUEST_TIMED_OUT)
    await vi.advanceTimersByTimeAsync(999)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await outcome
    expect(vi.getTimerCount()).toBe(0)
    settle("late")
    await expect(limited).rejects.toThrow(REQUEST_TIMED_OUT)
  })

  it("defaults to 30 seconds", async () => {
    const limited = withTimeout(new Promise<never>(() => {}))
    const outcome = expect(limited).rejects.toThrow(REQUEST_TIMED_OUT)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await outcome
    expect(vi.getTimerCount()).toBe(0)
    expect(REQUEST_TIMEOUT_MS).toBe(30_000)
  })
})
