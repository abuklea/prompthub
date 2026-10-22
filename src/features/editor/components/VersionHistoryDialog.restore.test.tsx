// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/VersionHistoryDialog.restore.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:41 GMT+10
Last modified: 22/10/2026 10:41 GMT+10
---------------
Restoring from the history dialog, with the real Radix dialog, AlertDialog and Button (contract: Async Completions and
Failures, decision D4). Restore on a row only asks "Restore this version?"; Cancel and Escape close the question alone
and restore nothing; confirming restores the version asked about, once; a question does not outlive its opening or its
document. While a restore runs every Restore button is disabled and every request to close is ignored; the dialog
closes itself only when the restore succeeded.

Changelog:
22/10/2026 10:41 GMT+10 | Created from the P7S1 dialog spike suite (P7S1T8 step 2)
*/

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  Harness, answer, askRestore, history, isOpen, makeHistory, makeRestorer, openHistory, overlay, pressEscape,
  question, restoreButtons, restoreRow,
} from "@/test/history-dialog"
import { A } from "@/test/loader-world"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

/** Opens the history of `A` from the parent and answers its read with two versions, newest first. */
async function openWithTwoVersions() {
  const h = makeHistory()
  const r = makeRestorer()
  const changes: boolean[] = []
  render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={r.onRestore} changes={changes} />)
  openHistory()
  await h.answer(0, history([2, "Two", "two"], [1, "One", "one"]))
  return { r, changes }
}

describe("restore from the dialog", () => {
  it("restores the version of the clicked row, once, and closes the dialog when it succeeded", async () => {
    const { r, changes } = await openWithTwoVersions()
    restoreRow(1)
    expect(r.calls.map((c) => c.versionId)).toEqual([1])

    await r.finish(0, true)
    expect(isOpen()).toBe(false)
    expect(changes).toEqual([false])
  })

  it("while a restore runs, the clicked row reads Restoring and every Restore button is disabled", async () => {
    const { r } = await openWithTwoVersions()
    restoreRow(0)

    const buttons = restoreButtons()
    expect(buttons.map((b) => b.textContent)).toEqual(["Restoring...", "Restore"])
    expect(buttons.map((b) => b.disabled)).toEqual([true, true])
    fireEvent.click(buttons[1])
    expect(r.calls).toHaveLength(1)
    expect(question()).toBeNull()
  })

  it("cannot be closed meanwhile: Escape and the Close button are ignored", async () => {
    const { r, changes } = await openWithTwoVersions()
    restoreRow(0)
    pressEscape()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(isOpen()).toBe(true)
    expect(changes).toEqual([])

    await r.finish(0, true)
    expect(isOpen()).toBe(false)
  })

  it("a click on the overlay is ignored meanwhile and closes the dialog once a restore did not succeed", async () => {
    const { r, changes } = await openWithTwoVersions()
    // Reason: Radix registers its outside-click listener on the next timer tick after the dialog opens.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    restoreRow(0)
    fireEvent.pointerDown(overlay())
    expect(isOpen()).toBe(true)
    expect(changes).toEqual([])

    await r.finish(0, false)
    fireEvent.pointerDown(overlay())
    expect(isOpen()).toBe(false)
    expect(changes).toEqual([false])
  })

  it("a restore that did not succeed leaves the dialog open and the buttons usable again", async () => {
    const { r, changes } = await openWithTwoVersions()
    restoreRow(0)
    await r.finish(0, false)
    expect(isOpen()).toBe(true)
    expect(changes).toEqual([])
    expect(restoreButtons().map((b) => b.textContent)).toEqual(["Restore", "Restore"])
    expect(restoreButtons().map((b) => b.disabled)).toEqual([false, false])

    restoreRow(0)
    expect(r.calls.map((c) => c.versionId)).toEqual([2, 2])
    pressEscape()
    expect(isOpen()).toBe(true)
    await r.finish(1, true)
    expect(isOpen()).toBe(false)
  })

  it("can be closed again after a restore did not succeed", async () => {
    const { r, changes } = await openWithTwoVersions()
    restoreRow(0)
    await r.finish(0, false)
    pressEscape()
    expect(isOpen()).toBe(false)
    expect(changes).toEqual([false])
  })
})

describe("the question before a restore", () => {
  it("a click on Restore asks 'Restore this version?' and sends nothing", async () => {
    const { r, changes } = await openWithTwoVersions()
    askRestore(1)
    expect(r.calls).toHaveLength(0)
    expect(screen.queryByRole("alertdialog")).not.toBeNull()
    expect(screen.getByText("Restore this version?")).toBeTruthy()
    expect(screen.getByText("Your current text stays in the version history, so you can come back to it.")).toBeTruthy()
    expect(changes).toEqual([])
  })

  it("Cancel drops the question, restores nothing and leaves the history open", async () => {
    const { r, changes } = await openWithTwoVersions()
    askRestore(0)
    answer("Cancel")
    expect(question()).toBeNull()
    expect(r.calls).toHaveLength(0)
    expect(changes).toEqual([])
    expect(isOpen()).toBe(true)
    expect(restoreButtons().map((b) => b.textContent)).toEqual(["Restore", "Restore"])
  })

  it("Escape closes the question only, not the history behind it", async () => {
    const { r, changes } = await openWithTwoVersions()
    askRestore(0)
    expect(question()).not.toBeNull()
    pressEscape()
    expect(question()).toBeNull()
    expect(isOpen()).toBe(true)
    expect(changes).toEqual([])
    expect(r.calls).toHaveLength(0)
  })

  it("confirming closes the question and restores the version that was asked about, once", async () => {
    const { r, changes } = await openWithTwoVersions()
    askRestore(1)
    expect(r.calls).toHaveLength(0)
    answer("Restore")
    expect(question()).toBeNull()
    expect(r.calls.map((c) => c.versionId)).toEqual([1])

    await r.finish(0, true)
    expect(isOpen()).toBe(false)
    expect(changes).toEqual([false])
  })

  it("a question about one document is gone when the document changes", async () => {
    const h = makeHistory()
    const r = makeRestorer()
    const view = render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={r.onRestore} />)
    openHistory()
    await h.answer(0, history([1, "Of A", "a"]))
    askRestore(0)
    expect(question()).not.toBeNull()

    view.rerender(<Harness promptId="other" loadHistory={h.loadHistory} onRestore={r.onRestore} />)
    expect(question()).toBeNull()
    await h.answer(1, history([7, "Of other", "o"]))
    expect(question()).toBeNull()
    expect(r.calls).toHaveLength(0)
  })

  it("a history that its parent closes leaves no question behind, and none returns when it reopens", async () => {
    const { r } = await openWithTwoVersions()
    askRestore(0)
    expect(question()).not.toBeNull()

    fireEvent.click(screen.getByText("Close from the parent"))
    expect(question()).toBeNull()
    expect(isOpen()).toBe(false)

    openHistory()
    expect(question()).toBeNull()
    expect(r.calls).toHaveLength(0)
  })
})
