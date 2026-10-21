// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.fresh-mount.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:10 GMT+10
---------------
The document loader on a fresh mount: the identity gate (loading and no fetch while the user lookup is pending, the
fallback to the anonymous identity on a timeout or a rejection), a fresh mount that ends with the server's document in
either settling order, React Strict Mode, a new io object during the fetch and the first render already loading.

Changelog:
22/10/2026 09:10 GMT+10 | Created from the P7S1 loader spike suite and the loader race probe (P7S1T5 step 2)
*/

import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"
import { clearDocumentCache } from "@/features/editor/document-cache"
import { IDENTITY_TIMEOUT_MS, useDocumentLoader } from "./useDocumentLoader"
import {
  A,
  NOW,
  expectReady,
  makeDeferredIo,
  makeWorld,
  mountLoader as mount,
  serverRow,
  type LoaderProps,
} from "@/test/loader-world"

const makeIo = () => makeDeferredIo(act)

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("useDocumentLoader on a fresh mount", () => {
  it("shows loading and starts no fetch while the identity is pending", () => {
    const t = makeIo()
    const { result } = mount(t.io)
    expect(result.current.loading).toBe(true)
    expect(result.current.content).toBe("")
    expect(t.calls).toHaveLength(0)
  })

  it("starts no fetch until the identity is known, however long the lookup takes", async () => {
    vi.useFakeTimers()
    const t = makeIo()
    const { result } = mount(t.io)
    expect(t.calls).toHaveLength(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDENTITY_TIMEOUT_MS - 1)
    })
    expect(t.calls).toHaveLength(0)
    expect(result.current.loading).toBe(true)

    await t.resolveUser()
    expect(t.calls.map((c) => c.promptId)).toEqual([A])
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expectReady(result, A, "Server title", "Server content")
  })

  it("the fetch starts after the identity and the document ends ready", async () => {
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    expect(t.calls).toHaveLength(1)
    expect(result.current.loading).toBe(true)
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expectReady(result, A, "Server title", "Server content")
    expect(result.current.lastSaved).toEqual(NOW)
  })

  it("a document loaded while the identity settles in the same tick is not wiped", async () => {
    const world = makeWorld({ [A]: { title: "Server title", content: "Server content" } }, null)
    const { result } = mount(world.io)
    await act(async () => {})
    await act(async () => {})
    expectReady(result, A, "Server title", "Server content")
  })

  it("React Strict Mode: one fetch, document ends ready", async () => {
    const t = makeIo()
    const { result } = mount(t.io, A, { wrapper: StrictMode })
    await t.resolveUser()
    await t.resolveFetch(A, serverRow(A, "Server title", "Server content"))
    expect(t.calls).toHaveLength(1)
    expectReady(result, A, "Server title", "Server content")
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
})

describe("useDocumentLoader identity fallback", () => {
  it("a lookup that never settles falls back to anonymous after the timeout; a late answer is ignored", async () => {
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

  it("a lookup that rejects falls back to anonymous", async () => {
    const t = makeIo()
    const io = { ...t.io, getUserId: () => Promise.reject(new Error("no session")) }
    const { result } = mount(io)
    await act(async () => {})
    expect(result.current.currentUserId).toBe("anonymous")
    expect(t.calls).toHaveLength(1)
  })
})
