/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/draft.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:24 GMT+10
---------------
The editor's browser draft store (P7S1 decision D2): a content-only v1 envelope, the legacy raw value read once, and
the conflict stash. The storage is a seam, and no function here throws.

Changelog:
22/10/2026 08:22 GMT+10 | Created from the draft part of the P7S1 draft spike (P7S1T4)
*/

import { z } from "zod"
import type { DocFields } from "./sync"

/** The part of the Web Storage API the draft store uses; `window.localStorage` in the browser. */
export interface DraftStorage {
  /** Returns the value stored under `key`, or null. May throw when the browser blocks storage. */
  getItem(key: string): string | null
  /** Stores `value` under `key`. May throw when the storage is full or blocked. */
  setItem(key: string, value: string): void
  /** Removes `key`. May throw when the browser blocks storage. */
  removeItem(key: string): void
}

/** A draft's text and the hash of the server content it began from. */
export interface StoredDraft {
  /** The draft text. */
  content: string
  /** `hashContent` of the server content the draft began from; null for a raw value of the removed hook. */
  base: string | null
}

/** A draft as read from the storage, with the raw value it came from so the reader removes exactly that value. */
export interface ReadDraft {
  /** The parsed draft. */
  draft: StoredDraft
  /** The stored value it was read from; only this value is ever removed. */
  raw: string
  /** True when it was read from the legacy key. */
  legacy: boolean
}

/** What the loader does with a stored draft. */
export type DraftDecision = { kind: "none" } | { kind: "apply"; content: string } | { kind: "conflict" }

/** The key of the v1 envelope. A new key, so a tab or a rollback running the old code never reads JSON as text. */
export const draftKey = (promptId: string): string => `prompt-v1-${promptId}`
/** The key of the raw text the removed hook stored. Read once to migrate, then removed. */
export const legacyDraftKey = (promptId: string): string => `prompt-${promptId}`
/** Where a draft that lost to the server is kept, one slot per document, for the "Restore my text" action. */
export const conflictKey = (promptId: string): string => `prompt-v1-${promptId}:conflict`

/** Runs a call that can throw (a blocked or full storage, malformed JSON) and yields `fallback` when it does. */
function attempt<T>(call: () => T, fallback: T): T {
  try {
    return call()
  } catch {
    return fallback
  }
}

/** cyrb53 by bryc (public domain): a fast 53-bit string hash. Not cryptographic; it only detects a changed text. */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * Hashes a document's content for a draft's `base`.
 * @param content - The text to hash.
 * @returns `<length>:<cyrb53 in base 36>`.
 */
export function hashContent(content: string): string {
  return `${content.length}:${cyrb53(content).toString(36)}`
}

/** @returns `window.localStorage`, or null on the server and when the browser blocks it (reading it can throw). */
export function getBrowserStorage(): DraftStorage | null {
  return attempt(() => (typeof window === "undefined" ? null : window.localStorage), null)
}

/**
 * Reads one stored value.
 * @param storage - The storage, or null when there is none.
 * @param key - The key to read.
 * @returns The value, or null when it is absent or the storage is null or throws.
 */
export function readRaw(storage: DraftStorage | null, key: string): string | null {
  return storage ? attempt(() => storage.getItem(key), null) : null
}

const draftV1Schema = z.object({ v: z.literal(1), base: z.string().min(1), content: z.string() })

/**
 * Parses a strict v1 envelope.
 * @param raw - A stored value, or null.
 * @returns The draft, or null for anything else (absent, malformed, another version, an empty base).
 */
export function parseDraft(raw: string | null): StoredDraft | null {
  if (raw === null) return null
  const parsed = attempt(() => draftV1Schema.safeParse(JSON.parse(raw)), null)
  return parsed?.success ? { content: parsed.data.content, base: parsed.data.base } : null
}

/**
 * Reads the draft of a document: the v1 envelope, else the legacy raw text, which is only text (empty is no draft).
 * @param storage - The storage, or null when there is none.
 * @param promptId - The document.
 * @returns The draft with the raw value it came from, or null when there is none or the storage cannot be read.
 */
export function readDraft(storage: DraftStorage | null, promptId: string): ReadDraft | null {
  const v1Raw = readRaw(storage, draftKey(promptId))
  const v1 = parseDraft(v1Raw)
  if (v1 && v1Raw !== null) return { draft: v1, raw: v1Raw, legacy: false }
  const legacyRaw = readRaw(storage, legacyDraftKey(promptId))
  if (legacyRaw) return { draft: { content: legacyRaw, base: null }, raw: legacyRaw, legacy: true }
  return null
}

/**
 * Writes a v1 envelope under the document's draft key.
 * @param storage - The storage, or null when there is none.
 * @param promptId - The document.
 * @param draft - The working content and the hash of the server content it differs from.
 * @returns The raw value written, or null when there is no storage or it refused the write.
 */
export function writeDraft(
  storage: DraftStorage | null,
  promptId: string,
  draft: { content: string; base: string }
): string | null {
  if (!storage) return null
  const raw = JSON.stringify({ v: 1, base: draft.base, content: draft.content })
  return attempt(() => {
    storage.setItem(draftKey(promptId), raw)
    return raw
  }, null)
}

/**
 * Compare-and-delete: removes `key` only while it still holds `raw`. Best effort; localStorage has no atomic form.
 * @param storage - The storage, or null when there is none.
 * @param key - The key to remove.
 * @param raw - The value the caller owns; another value is left alone.
 */
export function removeIfUnchanged(storage: DraftStorage | null, key: string, raw: string | null): void {
  if (!storage) return
  attempt(() => {
    if (storage.getItem(key) === raw) storage.removeItem(key)
  }, undefined)
}

/**
 * Removes the document's draft while it still holds the value the caller wrote.
 * @param storage - The storage, or null when there is none.
 * @param promptId - The document.
 * @param ownedRaw - The raw value the caller wrote; null owns nothing, so an existing draft stays.
 */
export function clearDraft(storage: DraftStorage | null, promptId: string, ownedRaw: string | null): void {
  removeIfUnchanged(storage, draftKey(promptId), ownedRaw)
}

/**
 * Keeps the text of a draft that lost to the server, one slot per document; a later conflict replaces it.
 * @param storage - The storage, or null when there is none.
 * @param promptId - The document.
 * @param content - The draft text to keep.
 * @returns False when there is no storage or it refused the write; the caller then leaves the draft where it is.
 */
export function stashConflict(storage: DraftStorage | null, promptId: string, content: string): boolean {
  if (!storage) return false
  // Reason: a full or blocked storage cannot keep the text; the toast action still holds it in memory.
  return attempt(() => {
    storage.setItem(conflictKey(promptId), content)
    return true
  }, false)
}

/**
 * Removes a draft the loader consumed, from the key it was read from, while that key still holds the value read.
 * @param storage - The storage, or null when there is none.
 * @param promptId - The document.
 * @param read - The draft as `readDraft` returned it.
 */
export function discardRead(storage: DraftStorage | null, promptId: string, read: ReadDraft): void {
  removeIfUnchanged(storage, read.legacy ? legacyDraftKey(promptId) : draftKey(promptId), read.raw)
}

/**
 * Decides what the loader does with a stored draft when the server's fields arrive.
 * @param server - The title and content the server returned.
 * @param draft - The stored draft, or null.
 * @returns `none` without a draft or when it equals the server content; `apply` for a v1 draft based on the server
 * content, or a legacy draft of a document with a blank title; `conflict` otherwise.
 */
export function resolveDraft(server: DocFields, draft: StoredDraft | null): DraftDecision {
  if (draft === null || draft.content === server.content) return { kind: "none" }
  if (draft.base === null) {
    // Reason: a raw value of the removed hook has no base and was never cleared. For a never-saved document (blank
    // title) it is the only copy of the text; for a saved one it is usually older, and the autosave would overwrite.
    return (server.title ?? "").trim() === "" ? { kind: "apply", content: draft.content } : { kind: "conflict" }
  }
  return draft.base === hashContent(server.content) ? { kind: "apply", content: draft.content } : { kind: "conflict" }
}
