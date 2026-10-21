// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.completions.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:10 GMT+10
---------------
The loader's completion API: markSynced and applyServerState change React state only for the open document and report
whether it is open; for a document the editor has left, or after it unmounted, they change that document's cache entry
only. Each test first checks that the document is ready, so it starts from an open document.

Changelog:
22/10/2026 09:10 GMT+10 | Created from the P7S1 loader spike suite (P7S1T5 step 2)
*/

import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup } from "@testing-library/react"
import { clearDocumentCache, getCachedDocument, setDocumentCacheEntry } from "@/features/editor/document-cache"
import {
  A,
  B,
  NOW,
  USER_ID,
  cacheEntryFor,
  expectReady,
  makeDeferredIo,
  mountLoader as mount,
  serverRow,
} from "@/test/loader-world"

const makeIo = () => makeDeferredIo(act)

/** Mounts the loader on A and loads it from the server. */
async function openA(title: string, content: string, options: { wrapper?: typeof StrictMode } = {}) {
  const t = makeIo()
  const hook = mount(t.io, A, options)
  await t.resolveUser()
  await t.resolveFetch(A, serverRow(A, title, content))
  expect(hook.result.current.ready).toBe(true)
  return { t, ...hook }
}

/** Opens A, caches A and B, then switches to the cached B. */
async function openAThenB() {
  const opened = await openA("A title", "A content")
  setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "A title", "A content"))
  setDocumentCacheEntry(USER_ID, B, cacheEntryFor(B, "B title", "B content"))
  opened.rerender({ promptId: B, io: opened.t.io })
  expectReady(opened.result, B, "B title", "B content")
  return opened
}

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("useDocumentLoader markSynced", () => {
  it("is accepted for the current document and refused for another", async () => {
    const { result } = await openA("Server title", "Server content")
    let accepted = false
    act(() => {
      accepted = result.current.markSynced({ promptId: A, title: "Server title", content: "Autosaved" })
    })
    expect(accepted).toBe(true)
    expect(result.current.synced?.content).toBe("Autosaved")
    act(() => {
      accepted = result.current.markSynced({ promptId: B, title: "x", content: "y" })
    })
    expect(accepted).toBe(false)
    expect(result.current.synced?.content).toBe("Autosaved")
  })

  it("sets the baseline and lastSaved; a saved version also patches promptData", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const later = new Date("2026-10-20T03:00:00.000Z")
    vi.setSystemTime(later)
    const { result } = await openA("Server title", "Server content")

    act(() => {
      result.current.markSynced({ promptId: A, title: "Server title", content: "Autosaved" })
    })
    expect(result.current.synced?.content).toBe("Autosaved")
    expect(result.current.lastSaved).toEqual(later)
    expect(result.current.promptData?.content).toBe("Server content")

    act(() => {
      result.current.markSynced({ promptId: A, title: "New title", content: "Saved" }, { version: true })
    })
    expect(result.current.promptData).toMatchObject({ title: "New title", content: "Saved", updated_at: later })
    expect(result.current.content).toBe("Server content")
  })

  it("for a document the editor has left changes that cache entry only", async () => {
    const { result } = await openAThenB()
    let accepted = true
    act(() => {
      accepted = result.current.markSynced(
        { promptId: A, title: "A saved", content: "A saved content" },
        { version: true }
      )
    })
    expect(accepted).toBe(false)
    expectReady(result, B, "B title", "B content")
    expect(result.current.promptData?.title).toBe("B title")
    expect(result.current.lastSaved).toEqual(NOW)
    const entry = getCachedDocument(USER_ID, A)
    expect(entry?.synced).toEqual({ promptId: A, title: "A saved", content: "A saved content" })
    expect(entry?.promptData).toMatchObject({ title: "A saved", content: "A saved content" })
    expect(entry?.content).toBe("A content")
  })

  it("called after the editor unmounted reports the document as not open and patches its cache entry", async () => {
    const { result, unmount } = await openA("A title", "A content")
    setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "A title", "A content"))
    const { markSynced } = result.current
    unmount()

    expect(markSynced({ promptId: A, title: "A title", content: "Saved" }, { version: true })).toBe(false)
    expect(getCachedDocument(USER_ID, A)?.synced).toEqual({ promptId: A, title: "A title", content: "Saved" })
  })

  it("React Strict Mode: the open document is still recognised after the effects run twice", async () => {
    const { result } = await openA("A title", "A content", { wrapper: StrictMode })
    let accepted = false
    act(() => {
      accepted = result.current.markSynced({ promptId: A, title: "A title", content: "Saved" })
    })
    expect(accepted).toBe(true)
    expect(result.current.synced?.content).toBe("Saved")
  })
})

describe("useDocumentLoader applyServerState", () => {
  it("replaces title, content, promptData and the baseline of the open document", async () => {
    const { result } = await openA("Server title", "Server content")
    let applied = false
    act(() => {
      applied = result.current.applyServerState(A, { title: "Restored title", content: "Restored content" })
    })
    expect(applied).toBe(true)
    expect(result.current.title).toBe("Restored title")
    expect(result.current.content).toBe("Restored content")
    expect(result.current.promptData?.content).toBe("Restored content")
    expect(result.current.synced).toEqual({ promptId: A, title: "Restored title", content: "Restored content" })
  })

  it("for a document the editor has left changes that cache entry only", async () => {
    const { result } = await openAThenB()
    let applied = true
    act(() => {
      applied = result.current.applyServerState(A, { title: "Restored", content: "Restored content" })
    })
    expect(applied).toBe(false)
    expectReady(result, B, "B title", "B content")
    expect(result.current.lastSaved).toEqual(NOW)
    const entry = getCachedDocument(USER_ID, A)
    expect(entry?.content).toBe("Restored content")
    expect(entry?.synced).toEqual({ promptId: A, title: "Restored", content: "Restored content" })
    expect(entry?.promptData.content).toBe("Restored content")
  })

  it("called after the editor unmounted still replaces the cache entry", async () => {
    const { result, unmount } = await openA("A title", "A content")
    setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "A title", "A content"))
    const { applyServerState } = result.current
    unmount()

    expect(applyServerState(A, { title: "Restored", content: "Restored content" })).toBe(false)
    const entry = getCachedDocument(USER_ID, A)
    expect(entry?.content).toBe("Restored content")
    expect(entry?.synced).toEqual({ promptId: A, title: "Restored", content: "Restored content" })
  })
})
