/*
Project: PromptHub
Author: Allan James
Source: src/lib/rate-limit.ts
MIME: text/typescript
Type: TypeScript Module

Created: 17/07/2026 10:00 GMT+10
Last modified: 17/07/2026 10:00 GMT+10
---------------
In-memory sliding-window rate limiter for server actions.
Limits requests per identifier (typically user IP or user ID) within a
configurable time window. Suitable for single-instance deployments; for
multi-instance, replace with a shared store (e.g. Upstash Redis).

Changelog:
17/07/2026 10:00 GMT+10 | Initial creation (F6 remediation)
*/

interface RateLimitEntry {
  timestamps: number[]
}

interface RateLimiterOptions {
  maxRequests: number
  windowMs: number
}

const stores = new Map<string, Map<string, RateLimitEntry>>()

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name)
  if (!store) {
    store = new Map()
    stores.set(name, store)
  }
  return store
}

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const { maxRequests, windowMs } = options
  const store = getStore(name)

  return {
    check(identifier: string): { allowed: boolean; retryAfterMs: number } {
      const now = Date.now()
      const entry = store.get(identifier)

      if (!entry) {
        store.set(identifier, { timestamps: [now] })
        return { allowed: true, retryAfterMs: 0 }
      }

      entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs)

      if (entry.timestamps.length >= maxRequests) {
        const oldest = entry.timestamps[0]
        const retryAfterMs = oldest + windowMs - now
        return { allowed: false, retryAfterMs }
      }

      entry.timestamps.push(now)
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}

const authLimiter = createRateLimiter("auth", {
  maxRequests: 5,
  windowMs: 60_000,
})

const mutationLimiter = createRateLimiter("mutation", {
  maxRequests: 30,
  windowMs: 60_000,
})

export function checkAuthRateLimit(identifier: string) {
  return authLimiter.check(identifier)
}

export function checkMutationRateLimit(identifier: string) {
  return mutationLimiter.check(identifier)
}
