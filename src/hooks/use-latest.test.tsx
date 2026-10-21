// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/hooks/use-latest.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:10 GMT+10
---------------
Unit tests of useLatest: the ref holds the first value at once and the newest one after a commit, keeps one identity,
and, because it is written in a passive effect, still holds the previous value during the render that changes it.

Changelog:
22/10/2026 09:10 GMT+10 | Created (P7S1T5 step 2)
*/

import type { MutableRefObject } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, renderHook } from "@testing-library/react"
import { useLatest } from "./use-latest"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("useLatest", () => {
  it("holds the first value on the first render", () => {
    const seen: string[] = []
    const { result } = renderHook(({ value }: { value: string }) => {
      const ref = useLatest(value)
      seen.push(ref.current)
      return ref
    }, { initialProps: { value: "first" } })
    expect(seen[0]).toBe("first")
    expect(result.current.current).toBe("first")
  })

  it("holds the new value once a re-render has committed and its effects ran", () => {
    const { result, rerender } = renderHook(({ value }: { value: number }) => useLatest(value), {
      initialProps: { value: 1 },
    })
    rerender({ value: 2 })
    expect(result.current.current).toBe(2)
    rerender({ value: 3 })
    expect(result.current.current).toBe(3)
  })

  it("keeps one ref identity across renders", () => {
    const refs: Array<MutableRefObject<string>> = []
    const { rerender } = renderHook(({ value }: { value: string }) => {
      const ref = useLatest(value)
      refs.push(ref)
      return ref
    }, { initialProps: { value: "a" } })
    rerender({ value: "b" })
    rerender({ value: "c" })
    expect(refs.length).toBeGreaterThanOrEqual(3)
    for (const ref of refs) expect(ref).toBe(refs[0])
  })

  it("still holds the previous value during the render in which the value changed", () => {
    const seen: Array<{ value: string; inRender: string }> = []
    const { rerender } = renderHook(({ value }: { value: string }) => {
      const ref = useLatest(value)
      seen.push({ value, inRender: ref.current })
      return ref
    }, { initialProps: { value: "old" } })
    rerender({ value: "new" })
    expect(seen.at(-1)).toEqual({ value: "new", inRender: "old" })
  })
})
