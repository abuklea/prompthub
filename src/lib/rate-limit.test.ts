import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createRateLimiter } from "./rate-limit"

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows requests within the limit", () => {
    const limiter = createRateLimiter("test-allow", { maxRequests: 3, windowMs: 60_000 })

    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(true)
  })

  it("blocks requests exceeding the limit", () => {
    const limiter = createRateLimiter("test-block", { maxRequests: 2, windowMs: 60_000 })

    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(false)
  })

  it("resets after the window expires", () => {
    const limiter = createRateLimiter("test-reset", { maxRequests: 1, windowMs: 10_000 })

    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(false)

    vi.advanceTimersByTime(10_001)

    expect(limiter.check("user1").allowed).toBe(true)
  })

  it("tracks identifiers independently", () => {
    const limiter = createRateLimiter("test-ids", { maxRequests: 1, windowMs: 60_000 })

    expect(limiter.check("user1").allowed).toBe(true)
    expect(limiter.check("user2").allowed).toBe(true)
    expect(limiter.check("user1").allowed).toBe(false)
    expect(limiter.check("user2").allowed).toBe(false)
  })

  it("returns retryAfterMs when blocked", () => {
    const limiter = createRateLimiter("test-retry", { maxRequests: 1, windowMs: 30_000 })

    limiter.check("user1")
    vi.advanceTimersByTime(5_000)

    const result = limiter.check("user1")
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
    expect(result.retryAfterMs).toBeLessThanOrEqual(30_000)
  })
})
