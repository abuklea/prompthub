// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.switching.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:50 GMT+10
---------------
The document loader across document switches and the cache: a switch wipes the old document and loads the new one, a
cache hit is ready at once, late responses of a document already left are ignored, readiness holds on every render, the
Monaco guard names only the applied document, and an emptied promptId wipes.

Changelog:
22/10/2026 09:50 GMT+10 | A promptId that goes empty while its fetch is pending ends loading (T5 review follow-up)
22/10/2026 09:36 GMT+10 | Removed the raw-draft cases, superseded by decision D2 and the S-7 cases of
                         useDocumentLoader.draft.test.tsx (P7S1T6 step 1)
22/10/2026 09:10 GMT+10 | Created from the P7S1 loader spike suite, with the raw-draft cases (P7S1T5 step 2)
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { clearDocumentCache, setDocumentCacheEntry } from "@/features/editor/document-cache"
import { useDocumentLoader } from "./useDocumentLoader"
import {
  A,
  B,
  C,
  USER_ID,
  cacheEntryFor,
  expectReady,
  makeDeferredIo,
  mountLoader as mount,
  serverRow,
  type LoaderProps,
} from "@/test/loader-world"

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}))

const makeIo = () => makeDeferredIo(act)

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("useDocumentLoader switching documents", () => {
  it("switching documents on a mounted instance loads the new one and wipes the old", async () => {
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
    setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "Cached title", "Cached content"))
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
    setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "A title", "A content"))
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
    setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "A title", "A content"))
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

  it("a promptId that goes empty while its fetch is pending ends loading, and the late result is dropped", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io, A)
    await t.resolveUser()
    expect(result.current.loading).toBe(true)

    rerender({ promptId: "", io: t.io })
    expect(result.current.loading).toBe(false)

    await t.resolveFetch(A, serverRow(A, "Late title", "Late content"))
    expect(result.current.loading).toBe(false)
    expect(result.current.content).toBe("")
    expect(result.current.synced).toBeNull()
  })
})
