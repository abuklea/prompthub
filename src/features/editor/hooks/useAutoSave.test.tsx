// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useAutoSave.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:36 GMT+10
Last modified: 22/10/2026 09:36 GMT+10
---------------
The debounced autosave with a baseline (decision D3, issue #35): a write is due only while the working copy of the
open document differs from what the server holds for it, under a non-blank title. Nothing is written on mount or for
an edit reverted to the baseline; a burst is one write; a baseline that catches up, or a promptId that becomes null,
cancels a pending write; a new onSave identity does not re-arm the timer. Driven by fake timers.

Changelog:
22/10/2026 09:36 GMT+10 | Created: the autosave baseline cases (P7S1T6 step 1)
*/

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SyncedState } from "@/features/editor/sync"
import { A, B } from "@/test/loader-world"
import { useAutoSave } from "./useAutoSave"

const DELAY = 500

/** The inputs a test varies; the delay and the callback are fixed by the harness. */
interface Props {
  promptId: string | null
  title: string | null
  content: string
  baseline: SyncedState | null
}

interface Write {
  id: string
  title: string | null
  content: string
}

const baseline: SyncedState = { promptId: A, title: "T", content: "c" }
const initial: Props = { promptId: A, title: "T", content: "c", baseline }

/** Advances the fake clock inside `act`, so the timers' callbacks and React's updates both run. */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Renders the hook with a callback that records every write. */
function mount(props: Props = initial) {
  const writes: Write[] = []
  const onSave = (id: string, title: string | null, content: string) => writes.push({ id, title, content })
  const hook = renderHook((p: Props) => useAutoSave({ ...p, delay: DELAY, onSave }), { initialProps: props })
  return { hook, writes }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

describe("useAutoSave with a baseline", () => {
  it("#35: writes nothing on mount, even long after the delay, while the working copy is the baseline", async () => {
    const { writes } = mount()
    await tick(5000)
    expect(writes).toEqual([])
  })

  it("writes once for a burst of edits, with the last text, after the delay", async () => {
    const { hook, writes } = mount()
    hook.rerender({ ...initial, content: "a" })
    await tick(200)
    hook.rerender({ ...initial, content: "ab" })
    await tick(200)
    hook.rerender({ ...initial, content: "abc" })
    await tick(DELAY - 1)
    expect(writes).toEqual([])
    await tick(1)
    expect(writes).toEqual([{ id: A, title: "T", content: "abc" }])
    await tick(5000)
    expect(writes).toHaveLength(1)
  })

  it("#35: writes nothing for an edit reverted to the baseline", async () => {
    const { hook, writes } = mount()
    hook.rerender({ ...initial, content: "x" })
    await tick(300)
    hook.rerender(initial)
    await tick(2000)
    expect(writes).toEqual([])
  })

  it.each<[string, Partial<Props>]>([
    ["a null title", { title: null }],
    ["a blank title", { title: "   " }],
    ["no baseline", { baseline: null }],
    ["#35: a baseline for another document", { baseline: { ...baseline, promptId: B } }],
  ])("writes nothing for a changed working copy with %s", async (_name, override) => {
    const { hook, writes } = mount({ ...initial, ...override })
    hook.rerender({ ...initial, content: "changed", ...override })
    await tick(2000)
    expect(writes).toEqual([])
  })

  it("a baseline that catches up with the working copy cancels the pending write", async () => {
    const { hook, writes } = mount()
    hook.rerender({ ...initial, content: "x" })
    await tick(300)
    hook.rerender({ ...initial, content: "x", baseline: { ...baseline, content: "x" } })
    await tick(2000)
    expect(writes).toEqual([])
  })

  it("a promptId that becomes null cancels the pending write", async () => {
    const { hook, writes } = mount()
    hook.rerender({ ...initial, content: "x" })
    await tick(300)
    hook.rerender({ ...initial, content: "x", promptId: null })
    await tick(2000)
    expect(writes).toEqual([])
  })

  it("a new onSave identity neither re-arms the timer nor loses the latest callback", async () => {
    const seen: Array<{ who: string; content: string }> = []
    const hook = renderHook(
      (p: Props & { who: string }) =>
        useAutoSave({ ...p, delay: DELAY, onSave: (_id, _title, content) => seen.push({ who: p.who, content }) }),
      { initialProps: { ...initial, who: "first" } }
    )
    hook.rerender({ ...initial, content: "x", who: "first" })
    await tick(300)
    hook.rerender({ ...initial, content: "x", who: "second" })
    await tick(200)
    expect(seen).toEqual([{ who: "second", content: "x" }])
  })
})
