// @vitest-environment jsdom
// @ts-nocheck -- see wip/P7S1-loader-race-diagnostic.test.tsx; this file is type-clean once P7S1T1 installs the test packages.
/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-loader-spike.test.tsx
MIME: text/typescript
Type: TypeScript React test (research spike, not part of the suite)

Created: 20/10/2026 12:33 GMT+10
Last modified: 20/10/2026 15:45 GMT+10
---------------
Proves the loader protocol of wip/P7S1-loader-spike.ts: loading, ready and synced after every path, including the paths
the first PRP review found missing, plus an invariant over every render. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-loader-spike.test.tsx

Changelog:
20/10/2026 15:45 GMT+10 | markSynced and applyServerState after unmount, Strict Mode, and no cache for the anonymous identity
20/10/2026 14:09 GMT+10 | The fakes moved to wip/P7S1-test-fakes.ts and the file is typed: no type error with the test packages installed
20/10/2026 13:20 GMT+10 | Tests for a rejected fetch, applyServerState after unmount, the remembered identity and the cache user check
20/10/2026 13:03 GMT+10 | Tests for same-document gating, the identity fallback, the first-render loading state and an emptied promptId
20/10/2026 12:40 GMT+10 | Corrected the header timestamps to the filesystem record
20/10/2026 12:33 GMT+10 | Readiness assertions use `ready`; added the every-render invariant test
*/

import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, type RenderHookResult } from "@testing-library/react"
import {
  ANONYMOUS,
  clearDocumentCache,
  getCachedDocument,
  IDENTITY_TIMEOUT_MS,
  LOAD_FAILED,
  setDocumentCacheEntry,
  useDocumentLoader,
  type CacheEntry,
  type DocumentLoader,
  type DocumentLoaderIo,
} from "./P7S1-loader-spike"
import { A, B, C, NOW, makeDeferredIo, serverRow } from "./P7S1-test-fakes"

const makeIo = () => makeDeferredIo(act)

type Hook = RenderHookResult<DocumentLoader, LoaderProps>

interface LoaderProps {
  promptId: string
  io: DocumentLoaderIo
}

function expectReady(result: Hook["result"], id: string, title: string | null, content: string) {
  const s = result.current
  expect(s.loading).toBe(false)
  expect(s.ready).toBe(true)
  expect(s.monacoPromptIdRef.current).toBe(id)
  expect(s.title).toBe(title)
  expect(s.content).toBe(content)
  expect(s.synced).toEqual({ promptId: id, title, content })
}

function mount(io: DocumentLoaderIo, promptId = A, options: { wrapper?: typeof StrictMode } = {}): Hook {
  return renderHook((props: LoaderProps) => useDocumentLoader(props), { initialProps: { promptId, io }, ...options })
}

function cacheEntryFor(id: string, title: string | null, content: string): Omit<CacheEntry, "userId"> {
  return {
    promptData: serverRow(id, title, content).data,
    title,
    content,
    lastSaved: NOW,
    synced: { promptId: id, title, content },
  }
}

beforeEach(() => {
  clearDocumentCache()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("loader protocol spike", () => {
  it("shows loading and starts no fetch while the identity is pending", () => {
    const t = makeIo()
    const { result } = mount(t.io)
    expect(result.current.loading).toBe(true)
    expect(result.current.content).toBe("")
    expect(t.calls).toHaveLength(0)
  })

  it("fresh mount: the fetch starts after the identity and the document ends ready", async () => {
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    expect(t.calls).toHaveLength(1)
    expect(result.current.loading).toBe(true)
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expectReady(result, A, "Server title", "Server content")
    expect(result.current.lastSaved).toEqual(NOW)
  })

  it("React Strict Mode: one fetch, document ends ready", async () => {
    const t = makeIo()
    const { result } = mount(t.io, A, { wrapper: StrictMode })
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expect(t.calls).toHaveLength(1)
    expectReady(result, A, "Server title", "Server content")
  })

  it("control: switching documents on a mounted instance loads the new one and wipes the old", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    rerender({ promptId: B, io: t.io })
    expect(result.current.loading).toBe(true)
    expect(result.current.content).toBe("")
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))
    expectReady(result, B, "B title", "B content")
  })

  it("fresh mount with a cached entry: no fetch and the document ends ready", async () => {
    const t = makeIo()
    const row = serverRow(A, "Cached title", "Cached content").data
    setDocumentCacheEntry("user-1", A, {
      promptData: row,
      title: "Cached title",
      content: "Cached content",
      lastSaved: NOW,
      synced: { promptId: A, title: "Cached title", content: "Cached content" },
    })
    const { result } = mount(t.io)
    await t.resolveUser()
    expect(t.calls).toHaveLength(0)
    expectReady(result, A, "Cached title", "Cached content")
  })

  it("A, then uncached B pending, then cached A: A is ready at once and B's late response is ignored", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", A, {
      promptData: serverRow(A, "A title", "A content").data,
      title: "A title",
      content: "A content",
      lastSaved: NOW,
      synced: { promptId: A, title: "A title", content: "A content" },
    })
    rerender({ promptId: B, io: t.io })
    expect(result.current.loading).toBe(true)
    rerender({ promptId: A, io: t.io })
    expectReady(result, A, "A title", "A content")
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))
    expectReady(result, A, "A title", "A content")
  })

  it("rapid switch A, B, C: only C's response is applied", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    rerender({ promptId: B, io: t.io })
    rerender({ promptId: C, io: t.io })
    await t.resolveFetch(C, serverRow(C, "C title", "C content"))
    expectReady(result, C, "C title", "C content")
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))
    expectReady(result, C, "C title", "C content")
  })

  it("atomic readiness: in every render where ready is true, title and content belong to that document", async () => {
    const t = makeIo()
    const renders: Array<{ promptId: string; ready: boolean; title: string | null; content: string }> = []
    const { rerender } = renderHook(
      (props: LoaderProps) => {
        const s = useDocumentLoader(props)
        renders.push({ promptId: props.promptId, ready: s.ready, title: s.title, content: s.content })
        return s
      },
      { initialProps: { promptId: A, io: t.io } }
    )
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", A, {
      promptData: serverRow(A, "A title", "A content").data,
      title: "A title",
      content: "A content",
      lastSaved: NOW,
      synced: { promptId: A, title: "A title", content: "A content" },
    })
    rerender({ promptId: B, io: t.io })
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))
    rerender({ promptId: A, io: t.io })
    rerender({ promptId: C, io: t.io })
    rerender({ promptId: B, io: t.io })
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))

    const own: Record<string, string[]> = {
      [A]: ["A title", "A content"],
      [B]: ["B title", "B content"],
      [C]: ["C title", "C content"],
    }
    const readyRenders = renders.filter((r) => r.ready)
    expect(readyRenders.length).toBeGreaterThan(3)
    for (const r of readyRenders) expect([r.title, r.content]).toEqual(own[r.promptId])
    // The stale window exists (promptId already changed, state still the old document) and is never ready.
    expect(renders.some((r) => !r.ready && r.promptId !== A && r.content === "A content")).toBe(true)
  })

  it("fetch failure: error set, not loading, no baseline", async () => {
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, { success: false, error: "Prompt not found" })
    expect(result.current.error).toBe("Prompt not found")
    expect(result.current.loading).toBe(false)
    expect(result.current.synced).toBeNull()
  })

  it("a new io object during the fetch neither restarts nor loses the load", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    rerender({ promptId: A, io: { ...t.io } })
    expect(t.calls).toHaveLength(1)
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expectReady(result, A, "Server title", "Server content")
  })

  it("markSynced: accepted for the current document, refused for another", async () => {
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    let accepted
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

  it("applyServerState replaces title, content, promptData and the baseline of the open document", async () => {
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    let applied
    act(() => {
      applied = result.current.applyServerState(A, { title: "Restored title", content: "Restored content" })
    })
    expect(applied).toBe(true)
    expect(result.current.title).toBe("Restored title")
    expect(result.current.content).toBe("Restored content")
    expect(result.current.promptData?.content).toBe("Restored content")
    expect(result.current.synced).toEqual({ promptId: A, title: "Restored title", content: "Restored content" })
  })

  it("applyServerState for a document the editor has left changes that cache entry only", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", A, cacheEntryFor(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", B, cacheEntryFor(B, "B title", "B content"))
    rerender({ promptId: B, io: t.io })
    expectReady(result, B, "B title", "B content")

    let applied
    act(() => {
      applied = result.current.applyServerState(A, { title: "Restored", content: "Restored content" })
    })
    expect(applied).toBe(false)
    expectReady(result, B, "B title", "B content")
    expect(result.current.lastSaved).toEqual(NOW)
    const entry = getCachedDocument("user-1", A)
    expect(entry?.content).toBe("Restored content")
    expect(entry?.synced).toEqual({ promptId: A, title: "Restored", content: "Restored content" })
    expect(entry?.promptData.content).toBe("Restored content")
  })

  it("markSynced sets the baseline and lastSaved; a saved version also patches promptData", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const later = new Date("2026-10-20T03:00:00.000Z")
    vi.setSystemTime(later)
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))

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

  it("markSynced for a document the editor has left changes that cache entry only", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", A, cacheEntryFor(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", B, cacheEntryFor(B, "B title", "B content"))
    rerender({ promptId: B, io: t.io })

    let accepted
    act(() => {
      accepted = result.current.markSynced({ promptId: A, title: "A saved", content: "A saved content" }, { version: true })
    })
    expect(accepted).toBe(false)
    expectReady(result, B, "B title", "B content")
    expect(result.current.promptData?.title).toBe("B title")
    expect(result.current.lastSaved).toEqual(NOW)
    const entry = getCachedDocument("user-1", A)
    expect(entry?.synced).toEqual({ promptId: A, title: "A saved", content: "A saved content" })
    expect(entry?.promptData).toMatchObject({ title: "A saved", content: "A saved content" })
    expect(entry?.content).toBe("A content")
  })

  it("monacoPromptIdRef names the document only while it is applied: null while another one loads", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    expect(result.current.monacoPromptIdRef.current).toBeNull()
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    expect(result.current.monacoPromptIdRef.current).toBe(A)

    rerender({ promptId: B, io: t.io })
    expect(result.current.monacoPromptIdRef.current).toBeNull()
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))
    expect(result.current.monacoPromptIdRef.current).toBe(B)
  })

  it("the first render with a promptId is already loading", () => {
    const t = makeIo()
    const states: Array<{ loading: boolean; ready: boolean }> = []
    renderHook(
      (props: LoaderProps) => {
        const s = useDocumentLoader(props)
        states.push({ loading: s.loading, ready: s.ready })
        return s
      },
      { initialProps: { promptId: A, io: t.io } }
    )
    expect(states[0]).toEqual({ loading: true, ready: false })
  })

  it("a render without a promptId is not loading and a promptId that goes empty wipes the document", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io, "")
    expect(result.current.loading).toBe(false)
    expect(t.calls).toHaveLength(0)

    rerender({ promptId: A, io: t.io })
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expectReady(result, A, "Server title", "Server content")

    rerender({ promptId: "", io: t.io })
    expect(result.current.loading).toBe(false)
    expect(result.current.content).toBe("")
    expect(result.current.synced).toBeNull()
    expect(result.current.monacoPromptIdRef.current).toBeNull()
  })

  it("an identity lookup that never settles falls back to anonymous after the timeout, and a late answer is ignored", async () => {
    vi.useFakeTimers()
    const t = makeIo()
    const { result } = mount(t.io)
    expect(t.calls).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDENTITY_TIMEOUT_MS)
    })
    expect(result.current.currentUserId).toBe("anonymous")
    expect(t.calls).toHaveLength(1)

    await t.resolveUser("user-1")
    expect(result.current.currentUserId).toBe("anonymous")
    expect(t.calls).toHaveLength(1)
  })

  it("an identity lookup that rejects falls back to anonymous", async () => {
    const t = makeIo()
    const io = { ...t.io, getUserId: () => Promise.reject(new Error("no session")) }
    const { result } = mount(io)
    await act(async () => {})
    expect(result.current.currentUserId).toBe("anonymous")
    expect(t.calls).toHaveLength(1)
  })

  it("a fetch that rejects ends like a failed one: an error, no loading, no baseline", async () => {
    const t = makeIo()
    const io = { ...t.io, fetchPrompt: () => Promise.reject(new Error("Failed to fetch")) }
    const { result } = mount(io)
    await t.resolveUser()
    await act(async () => {})
    expect(result.current.error).toBe(LOAD_FAILED)
    expect(result.current.loading).toBe(false)
    expect(result.current.synced).toBeNull()
    expect(result.current.ready).toBe(false)
  })

  it("applyServerState called after the editor unmounted still replaces the cache entry", async () => {
    const t = makeIo()
    const { result, unmount } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", A, cacheEntryFor(A, "A title", "A content"))
    const { applyServerState } = result.current
    unmount()

    expect(applyServerState(A, { title: "Restored", content: "Restored content" })).toBe(false)
    const entry = getCachedDocument("user-1", A)
    expect(entry?.content).toBe("Restored content")
    expect(entry?.synced).toEqual({ promptId: A, title: "Restored", content: "Restored content" })
  })

  it("markSynced called after the editor unmounted reports that the document is not open and patches its cache entry", async () => {
    const t = makeIo()
    const { result, unmount } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))
    setDocumentCacheEntry("user-1", A, cacheEntryFor(A, "A title", "A content"))
    const { markSynced } = result.current
    unmount()

    expect(markSynced({ promptId: A, title: "A title", content: "Saved" }, { version: true })).toBe(false)
    expect(getCachedDocument("user-1", A)?.synced).toEqual({ promptId: A, title: "A title", content: "Saved" })
  })

  it("React Strict Mode: the open document is still recognised after the effects run twice", async () => {
    const t = makeIo()
    const { result } = mount(t.io, A, { wrapper: StrictMode })
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "A title", "A content"))

    let accepted
    act(() => {
      accepted = result.current.markSynced({ promptId: A, title: "A title", content: "Saved" })
    })
    expect(accepted).toBe(true)
    expect(result.current.synced?.content).toBe("Saved")
  })
})

describe("document cache", () => {
  it("clearDocumentCache drops every entry", () => {
    setDocumentCacheEntry("user-1", A, cacheEntryFor(A, "T", "text"))
    clearDocumentCache()
    expect(getCachedDocument("user-1", A)).toBeNull()
  })

  it("getCachedDocument drops and never returns an entry written for another user", () => {
    // Reason: the key is `${userId}-${promptId}`; these two pairs build the same key, so only the stored userId tells them apart.
    setDocumentCacheEntry("a-b", "c", cacheEntryFor("c", "T", "text"))
    expect(getCachedDocument("a", "b-c")).toBeNull()
    expect(getCachedDocument("a-b", "c")).toBeNull()
  })

  it("the anonymous identity has no cache: nothing is written for it, so nothing is served to it", () => {
    // Reason: a lookup that failed or timed out settles as anonymous, and every such lookup would share these entries.
    setDocumentCacheEntry(ANONYMOUS, A, cacheEntryFor(A, "T", "text"))
    expect(getCachedDocument(ANONYMOUS, A)).toBeNull()
  })
})
