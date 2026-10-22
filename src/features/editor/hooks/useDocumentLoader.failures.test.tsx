// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.failures.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:10 GMT+10
---------------
The loader's failure paths: a failed, a rejected and a timed-out fetch each end with an error, a toast, no loading and
no baseline; a failure of a document the editor has already left is ignored.

Changelog:
22/10/2026 09:10 GMT+10 | Created from the P7S1 loader spike suite (P7S1T5 step 2)
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup } from "@testing-library/react"
import { toast } from "sonner"
import { clearDocumentCache } from "@/features/editor/document-cache"
import { LOAD_FAILED } from "@/features/editor/loader-protocol"
import { REQUEST_TIMEOUT_MS, withTimeout } from "@/features/editor/request-timeout"
import { A, B, expectReady, makeDeferredIo, mountLoader as mount, serverRow } from "@/test/loader-world"
import type { ActionResult } from "@/types/actions"

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

describe("useDocumentLoader failures", () => {
  it("a failed fetch sets the error and a toast, ends loading and leaves no baseline", async () => {
    const t = makeIo()
    const { result } = mount(t.io)
    await t.resolveUser()
    await t.resolveFetch(A, { success: false, error: "Prompt not found" })
    expect(result.current.error).toBe("Prompt not found")
    expect(result.current.loading).toBe(false)
    expect(result.current.synced).toBeNull()
    expect(toast.error).toHaveBeenCalledWith("Prompt not found", { duration: 6000 })
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

  it("a fetch abandoned by withTimeout takes the same path as a rejected one", async () => {
    vi.useFakeTimers()
    const t = makeIo()
    const io = { ...t.io, fetchPrompt: () => withTimeout(new Promise<ActionResult>(() => {})) }
    const { result } = mount(io)
    await t.resolveUser()
    expect(result.current.loading).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    })
    expect(result.current.error).toBe(LOAD_FAILED)
    expect(result.current.loading).toBe(false)
    expect(result.current.synced).toBeNull()
  })

  it("a failure for a document the editor has already left sets no error and shows no toast", async () => {
    const t = makeIo()
    const { result, rerender } = mount(t.io)
    await t.resolveUser()
    rerender({ promptId: B, io: t.io })
    await t.resolveFetch(A, { success: false, error: "Prompt not found" })
    expect(result.current.error).toBe("")
    expect(result.current.loading).toBe(true)
    expect(toast.error).not.toHaveBeenCalled()
    await t.resolveFetch(B, serverRow(B, "B title", "B content"))
    expectReady(result, B, "B title", "B content")
  })
})
