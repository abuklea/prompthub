// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/VersionHistoryDialog.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:40 GMT+10
Last modified: 22/10/2026 10:40 GMT+10
---------------
The history dialog's list, with the real Radix dialog and Button (contract: Async Completions and Failures). The
control case shows why the list never loaded when the parent set `open`: a controlled Radix Dialog reports only the
changes it makes itself. The list is read when the dialog opens and whenever the document changes, a result for an
opening or a document that is gone is dropped, and a failed read says so. The restore and the question are in
VersionHistoryDialog.restore.test.tsx; the dialog beside the real hooks in VersionHistoryDialog.editor.test.tsx.

Changelog:
22/10/2026 10:40 GMT+10 | Created from the P7S1 dialog spike suite (P7S1T8 step 2)
*/

import { StrictMode } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  Harness, history, isOpen, makeHistory, makeRestorer, openHistory, pressEscape, restoreButtons, type HistoryFake,
} from "@/test/history-dialog"
import { A } from "@/test/loader-world"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

const HISTORY_FAILED = "The history could not be loaded"

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

describe("why the old dialog never loaded its list", () => {
  it("control: a controlled Radix Dialog reports only the changes it makes itself, never the parent's open", () => {
    const seen: boolean[] = []
    const Controlled = ({ open }: { open: boolean }) => (
      <Dialog open={open} onOpenChange={(next) => seen.push(next)}>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    const { rerender } = render(<Controlled open={false} />)
    rerender(<Controlled open />)
    expect(isOpen()).toBe(true)
    expect(seen).toEqual([])

    pressEscape()
    expect(seen).toEqual([false])
  })
})

describe("history list", () => {
  it("loads when the parent opens the dialog and lists the snapshots", async () => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    expect(h.calls).toHaveLength(0)

    openHistory()
    expect(h.calls.map((c) => c.promptId)).toEqual([A])
    expect(screen.queryByText("Loading history...")).not.toBeNull()

    await h.answer(0, history([2, "Newer", "newer text"], [1, null, "older text"]))
    expect(screen.queryByText("Loading history...")).toBeNull()
    expect(screen.getByText("Title: Newer")).toBeTruthy()
    expect(screen.getByText("Title: [Untitled Doc]")).toBeTruthy()
    expect(screen.getByText("older text")).toBeTruthy()
    expect(restoreButtons()).toHaveLength(2)
  })

  it("says so when the document has no snapshots", async () => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    await h.answer(0, history())
    expect(screen.getByText("No saved versions yet.")).toBeTruthy()
  })

  it("reads the history again on every opening, and shows nothing of the previous one while it loads", async () => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    await h.answer(0, history([1, "First list", "x"]))
    pressEscape()
    expect(isOpen()).toBe(false)

    openHistory()
    expect(h.calls).toHaveLength(2)
    expect(screen.queryByText("Title: First list")).toBeNull()
    expect(screen.queryByText("Loading history...")).not.toBeNull()
    await h.answer(1, history([2, "Second list", "y"]))
    expect(screen.getByText("Title: Second list")).toBeTruthy()
  })

  it("ignores a result that arrives after the dialog was closed and reopened", async () => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    pressEscape()
    openHistory()
    await h.answer(0, history([1, "Late", "from the first opening"]))
    expect(screen.queryByText("Title: Late")).toBeNull()
    expect(screen.queryByText("Loading history...")).not.toBeNull()
    await h.answer(1, history([2, "Current", "from the second opening"]))
    expect(screen.getByText("Title: Current")).toBeTruthy()
  })

  it("switches to the new document and ignores the old document's late result", async () => {
    const h = makeHistory()
    const r = makeRestorer()
    const view = render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={r.onRestore} />)
    openHistory()
    view.rerender(<Harness promptId="other" loadHistory={h.loadHistory} onRestore={r.onRestore} />)
    expect(h.calls.map((c) => c.promptId)).toEqual([A, "other"])

    await h.answer(0, history([1, "Of A", "a"]))
    expect(screen.queryByText("Title: Of A")).toBeNull()
    await h.answer(1, history([7, "Of other", "o"]))
    expect(screen.getByText("Title: Of other")).toBeTruthy()
  })

  it("a document that goes away while the dialog is open leaves no list behind", async () => {
    const h = makeHistory()
    const r = makeRestorer()
    const view = render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={r.onRestore} />)
    openHistory()
    await h.answer(0, history([1, "Of A", "a"]))
    expect(screen.getByText("Title: Of A")).toBeTruthy()

    view.rerender(<Harness promptId={null} loadHistory={h.loadHistory} onRestore={r.onRestore} />)
    expect(screen.queryByText("Title: Of A")).toBeNull()
    expect(restoreButtons()).toHaveLength(0)
  })

  it("a read that fails after the dialog was closed reports nothing", async () => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    pressEscape()
    await h.reject(0)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("does not read while closed, or without a document", async () => {
    const h = makeHistory()
    const view = render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    expect(h.calls).toHaveLength(0)
    view.rerender(<Harness promptId={null} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    expect(h.calls).toHaveLength(0)
    expect(screen.queryByText("Loading history...")).toBeNull()
  })

  it("a new loadHistory function on every render does not reload the list", async () => {
    const h = makeHistory()
    const r = makeRestorer()
    const view = render(<Harness promptId={A} loadHistory={(id) => h.loadHistory(id)} onRestore={r.onRestore} />)
    openHistory()
    await h.answer(0, history([1, "One", "x"]))
    view.rerender(<Harness promptId={A} loadHistory={(id) => h.loadHistory(id)} onRestore={r.onRestore} />)
    view.rerender(<Harness promptId={A} loadHistory={(id) => h.loadHistory(id)} onRestore={r.onRestore} />)
    expect(h.calls).toHaveLength(1)
    expect(screen.getByText("Title: One")).toBeTruthy()
  })

  it("React Strict Mode: the list that is shown is the last read's", async () => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />, {
      wrapper: StrictMode,
    })
    openHistory()
    expect(h.calls.length).toBeGreaterThan(0)
    for (let i = 0; i < h.calls.length; i++) await h.answer(i, history([i + 1, `Read ${i + 1}`, "x"]))
    expect(screen.getAllByText(/^Title: Read/)).toHaveLength(1)
    expect(screen.getByText(`Title: Read ${h.calls.length}`)).toBeTruthy()
  })

  it.each<[string, (h: HistoryFake) => Promise<unknown>, string]>([
    ["a failed result", (h) => h.answer(0, { success: false, error: "Unauthorized" }), "Unauthorized"],
    ["a rejected read", (h) => h.reject(0), HISTORY_FAILED],
  ])("%s: tells the user, stops loading and does not claim there are no versions", async (_name, fail, toastText) => {
    const h = makeHistory()
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    await fail(h)
    expect(toast.error).toHaveBeenCalledWith(toastText)
    expect(screen.queryByText("Loading history...")).toBeNull()
    expect(screen.queryByText("No saved versions yet.")).toBeNull()
    expect(screen.getByText(`${HISTORY_FAILED}.`)).toBeTruthy()
  })

  it("an empty document id reads nothing and shows no loading line", async () => {
    const h = makeHistory()
    render(<Harness promptId="" loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />)
    openHistory()
    await act(async () => {})
    expect(h.calls).toHaveLength(0)
    expect(screen.queryByText("Loading history...")).toBeNull()
  })
})
