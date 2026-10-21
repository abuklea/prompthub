/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/document-cache.ts
MIME: text/typescript
Type: TypeScript

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:23 GMT+10
---------------
The editor's module-level document cache: the working copy and baseline of each document a user opened, served only to
the user it was written for. The anonymous identity gets none, sign-out empties it, and it remembers no user id.

Changelog:
22/10/2026 08:23 GMT+10 | Created from the document-cache part of the P7S1 loader spike; updates check the user (P7S1T4)
*/

import type { Prompt } from "@prisma/client"
import type { SyncedState } from "./sync"

/** The identity of a session whose user lookup failed or timed out. It never gets a cache entry. */
export const ANONYMOUS = "anonymous"

/** A prompt row with its folder, as the document fetch returns it. */
export type PromptWithFolder = Prompt & { folder: { id: string; name: string } }

/** What the cache holds for one document of one user. */
export interface CacheEntry {
  /** The user the entry was written for; it is served to no one else. */
  userId: string
  /** The prompt row as last loaded or saved. */
  promptData: PromptWithFolder
  /** The working title. */
  title: string | null
  /** The working content. */
  content: string
  /** When the document was last saved, or null when unknown. */
  lastSaved: Date | null
  /** The baseline the server is known to hold for the document. */
  synced: SyncedState
}

type CachePatch = Partial<Omit<CacheEntry, "userId">>

const documentCache = new Map<string, CacheEntry>()
const cacheKey = (userId: string, promptId: string) => `${userId}-${promptId}`

/**
 * Reads a cached document. Reason: the key joins the ids with a hyphen, so two pairs can build the same key; only the
 * stored user id tells them apart, and an entry written for another user is dropped, never returned (P5S4T2).
 * @param userId - The signed-in user.
 * @param promptId - The document.
 * @returns The entry written for this user, or null.
 */
export function getCachedDocument(userId: string, promptId: string): CacheEntry | null {
  const entry = documentCache.get(cacheKey(userId, promptId))
  if (!entry) return null
  if (entry.userId !== userId) {
    documentCache.delete(cacheKey(userId, promptId))
    return null
  }
  return entry
}

/**
 * Writes the entry of a document for this user, replacing any earlier one. The anonymous identity gets none: every
 * unresolved lookup would share it, so nothing is ever cached for it, served to it or updated for it.
 * @param userId - The signed-in user.
 * @param promptId - The document.
 * @param entry - Everything but the user id.
 */
export function setDocumentCacheEntry(userId: string, promptId: string, entry: Omit<CacheEntry, "userId">): void {
  if (userId === ANONYMOUS) return
  documentCache.set(cacheKey(userId, promptId), { userId, ...entry })
}

/**
 * Merges a patch into this user's existing entry; a no-op when there is none or it belongs to another user. Works
 * after the component that wrote the entry unmounted, so a late completion reaches the cache.
 * @param userId - The signed-in user.
 * @param promptId - The document.
 * @param patch - The fields to replace, or a function of the current entry that returns them.
 */
export function updateDocumentCacheEntry(
  userId: string,
  promptId: string,
  patch: CachePatch | ((entry: CacheEntry) => CachePatch)
): void {
  const existing = getCachedDocument(userId, promptId)
  if (!existing) return
  const fields = typeof patch === "function" ? patch(existing) : patch
  documentCache.set(cacheKey(userId, promptId), { ...existing, ...fields, userId })
}

/** Empties the cache; sign-out calls it. */
export function clearDocumentCache(): void {
  documentCache.clear()
}
