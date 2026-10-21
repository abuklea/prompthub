/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/document-cache.test.ts
MIME: text/typescript
Type: TypeScript test (Vitest, node)

Created: 22/10/2026 08:16 GMT+10
Last modified: 22/10/2026 08:26 GMT+10
---------------
Unit tests of the document cache: entries are served only to the user they were written for, the anonymous identity
gets none, an update merges into an existing entry (with an object or a function patch) and never creates one, and
clearDocumentCache empties the cache.

Changelog:
22/10/2026 08:26 GMT+10 | The cross-user update test reads the owner's key first, so a patched entry would fail it
22/10/2026 08:16 GMT+10 | Created from the document-cache block of the P7S1 loader spike suite (P7S1T4)
*/

import { beforeEach, describe, expect, it } from "vitest"
import {
  ANONYMOUS,
  clearDocumentCache,
  getCachedDocument,
  setDocumentCacheEntry,
  updateDocumentCacheEntry,
  type CacheEntry,
  type PromptWithFolder,
} from "./document-cache"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const USER = "user-1"
const OTHER_USER = "user-2"
const NOW = new Date("2026-10-20T01:00:00.000Z")
const LATER = new Date("2026-10-20T02:00:00.000Z")

function promptData(id: string, title: string | null, content: string): PromptWithFolder {
  return {
    id,
    title,
    content,
    created_at: NOW,
    updated_at: NOW,
    user_id: USER,
    folder_id: "f1",
    folder: { id: "f1", name: "Folder" },
  }
}

function entryFor(id: string, title: string | null, content: string): Omit<CacheEntry, "userId"> {
  return {
    promptData: promptData(id, title, content),
    title,
    content,
    lastSaved: NOW,
    synced: { promptId: id, title, content },
  }
}

beforeEach(() => {
  clearDocumentCache()
})

describe("document cache", () => {
  it("serves an entry to the user it was written for, per document", () => {
    setDocumentCacheEntry(USER, A, entryFor(A, "T", "text"))
    expect(getCachedDocument(USER, A)).toEqual({ userId: USER, ...entryFor(A, "T", "text") })
    expect(getCachedDocument(USER, B)).toBeNull()
    expect(getCachedDocument(OTHER_USER, A)).toBeNull()
  })

  it("clearDocumentCache empties the cache", () => {
    setDocumentCacheEntry(USER, A, entryFor(A, "T", "text"))
    setDocumentCacheEntry(OTHER_USER, B, entryFor(B, "U", "other"))
    clearDocumentCache()
    expect(getCachedDocument(USER, A)).toBeNull()
    expect(getCachedDocument(OTHER_USER, B)).toBeNull()
  })

  it("getCachedDocument drops and never returns an entry written for another user", () => {
    // Reason: `a-b` and `c` build the same key as `a` and `b-c`, so only the stored user id tells them apart.
    setDocumentCacheEntry("a-b", "c", entryFor("c", "T", "text"))
    expect(getCachedDocument("a", "b-c")).toBeNull()
    expect(getCachedDocument("a-b", "c")).toBeNull()
  })

  it("updateDocumentCacheEntry never patches an entry written for another user: it drops it, as a read does", () => {
    setDocumentCacheEntry("a-b", "c", entryFor("c", "T", "text"))
    updateDocumentCacheEntry("a", "b-c", { content: "theirs" })
    // Reason: read the owner's key first; a patched entry would still carry the owner's id and be served to it.
    expect(getCachedDocument("a-b", "c")).toBeNull()
    expect(getCachedDocument("a", "b-c")).toBeNull()
  })

  it("the anonymous identity has no cache: nothing is written for it, so nothing is served to it", () => {
    // Reason: a lookup that failed or timed out settles as anonymous, and every such lookup would share these entries.
    setDocumentCacheEntry(ANONYMOUS, A, entryFor(A, "T", "text"))
    expect(getCachedDocument(ANONYMOUS, A)).toBeNull()
    updateDocumentCacheEntry(ANONYMOUS, A, { content: "edited" })
    expect(getCachedDocument(ANONYMOUS, A)).toBeNull()
  })

  it("updateDocumentCacheEntry merges an object patch into the existing entry", () => {
    setDocumentCacheEntry(USER, A, entryFor(A, "T", "text"))
    updateDocumentCacheEntry(USER, A, { content: "edited", lastSaved: LATER })
    expect(getCachedDocument(USER, A)).toEqual({
      ...entryFor(A, "T", "text"),
      userId: USER,
      content: "edited",
      lastSaved: LATER,
    })
  })

  it("updateDocumentCacheEntry applies a function patch to the entry as it stands", () => {
    setDocumentCacheEntry(USER, A, entryFor(A, "T", "text"))
    updateDocumentCacheEntry(USER, A, (entry) => ({ content: `${entry.content} more` }))
    updateDocumentCacheEntry(USER, A, (entry) => ({ synced: { ...entry.synced, content: entry.content } }))
    const entry = getCachedDocument(USER, A)
    expect(entry?.content).toBe("text more")
    expect(entry?.synced).toEqual({ promptId: A, title: "T", content: "text more" })
    expect(entry?.userId).toBe(USER)
  })

  it("updateDocumentCacheEntry does nothing when there is no entry", () => {
    let called = false
    updateDocumentCacheEntry(USER, A, (entry) => {
      called = true
      return { content: `${entry.content} more` }
    })
    updateDocumentCacheEntry(USER, A, { content: "edited" })
    expect(called).toBe(false)
    expect(getCachedDocument(USER, A)).toBeNull()
  })

  it("a later write replaces the whole entry", () => {
    setDocumentCacheEntry(USER, A, entryFor(A, "T", "text"))
    setDocumentCacheEntry(USER, A, entryFor(A, "U", "new"))
    expect(getCachedDocument(USER, A)).toEqual({ userId: USER, ...entryFor(A, "U", "new") })
  })
})
