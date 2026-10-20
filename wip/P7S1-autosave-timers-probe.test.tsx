// @vitest-environment jsdom
// @ts-nocheck -- research probe: see wip/P7S1-loader-race-diagnostic.test.tsx for why type-checking is off.
/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-autosave-timers-probe.test.tsx
MIME: text/typescript
Type: TypeScript React diagnostic test (throwaway, not part of the suite)

Created: 20/10/2026 12:00 GMT+10
Last modified: 20/10/2026 12:02 GMT+10
---------------
P7S1 research probe. Confirms that renderHook, act, fake timers and advanceTimersByTimeAsync work together against the
CURRENT useAutoSave in this repository, and records its current behaviour for issue #35 (a write on mount with no edit).
Run with: npx vitest run --config wip/P7S1-vitest.diag.config.ts

Changelog:
20/10/2026 12:02 GMT+10 | Added the ts-nocheck line
20/10/2026 12:00 GMT+10 | Created for P7S1 research
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useAutoSave } from "@/features/editor/hooks/useAutoSave"

const ID = "11111111-1111-4111-8111-111111111111"

describe("current useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("issue 35: schedules a write on mount even though nothing was edited", async () => {
    const onSave = vi.fn()
    renderHook(() => useAutoSave({ title: "Loaded title", content: "Loaded content", promptId: ID, delay: 500, onSave }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    console.log(`[diag] writes after mount with no edit: ${onSave.mock.calls.length}`)
    expect(onSave).toHaveBeenCalledTimes(0)
  })

  it("control: one write 500 ms after a burst of edits", async () => {
    const onSave = vi.fn()
    const { rerender } = renderHook(
      (props: { content: string }) =>
        useAutoSave({ title: "T", content: props.content, promptId: ID, delay: 500, onSave }),
      { initialProps: { content: "a" } }
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    rerender({ content: "ab" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    rerender({ content: "abc" })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    console.log(`[diag] writes after a burst: ${onSave.mock.calls.length}, last content: ${onSave.mock.calls.at(-1)?.[2]}`)
    // The mount-time write is already scheduled by the unfixed hook, so the burst yields one write for "abc".
    expect(onSave).toHaveBeenLastCalledWith(ID, "T", "abc")
  })
})
