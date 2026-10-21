/*
Project: PromptHub
Author: Allan James
Source: src/test/storage-fake.ts
MIME: text/typescript
Type: TypeScript test fake

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:24 GMT+10
---------------
Storage fakes for the draft tests, injected through the DraftStorage seam of src/features/editor/draft.ts: an
in-memory storage that records its writes and can refuse them like a full quota, and a storage whose every call throws.

Changelog:
22/10/2026 08:16 GMT+10 | Created from the storage part of the P7S1 test fakes (P7S1T4)
*/

import type { DraftStorage } from "@/features/editor/draft"

/** An in-memory storage that records its writes and can be told to refuse them like a full quota. */
export interface FakeStorage extends DraftStorage {
  /** The stored values by key. */
  map: Map<string, string>
  /** Every write the storage accepted, in call order; a refused write is not recorded. */
  sets: Array<{ key: string; value: string }>
  /** While true, `setItem` throws as a full quota does and stores nothing. */
  refuseWrites: boolean
}

/**
 * Builds an in-memory storage.
 * @param initial - The values the storage starts with, by key.
 * @returns A storage that accepts writes until `refuseWrites` is set.
 */
export function makeStorage(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map(Object.entries(initial))
  const api: FakeStorage = {
    map,
    sets: [],
    refuseWrites: false,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (api.refuseWrites) throw new Error("QuotaExceededError")
      api.sets.push({ key, value })
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
  return api
}

/** @returns A storage every call of which throws "storage blocked", as a browser with storage blocked does. */
export function makeBrokenStorage(): DraftStorage {
  const fail = (): never => {
    throw new Error("storage blocked")
  }
  return { getItem: fail, setItem: fail, removeItem: fail }
}
