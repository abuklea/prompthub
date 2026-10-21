// @vitest-environment jsdom
// @ts-nocheck -- see wip/P7S1-loader-race-diagnostic.test.tsx; this file is type-clean once P7S1T1 installs the test packages.
/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-dialog-spike.test.tsx
MIME: text/typescript
Type: TypeScript React test (research spike, not part of the suite)

Created: 20/10/2026 14:14 GMT+10
Last modified: 22/10/2026 07:53 GMT+10
---------------
Proves the history dialog of wip/P7S1-dialog-spike.tsx with the real Radix dialogs and Button. The first group drives the
dialog with injected fakes: a list that loads when the parent opens the dialog (the defect of the current component), a
question before a restore (decision D4), a single-flight restore and a dialog that cannot be closed while one runs. The
second group mounts the dialog beside the real loader and persistence hooks, as EditorPane does, and restores through
them. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-dialog-spike.test.tsx

Changelog:
22/10/2026 07:53 GMT+10 | Decision D4: seven tests for the question; the eleven restore tests that clicked Restore once now go through it (restoreRow, restore); the question helper ignores aria-hidden (mutation H20)
20/10/2026 15:45 GMT+10 | A click on the overlay during a restore is ignored, and closes the dialog after a failed restore
20/10/2026 14:48 GMT+10 | The flush-before-restore test asserts the autosave request instead of the fake's version rows
20/10/2026 14:14 GMT+10 | Created
*/

import { StrictMode, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { PromptVersionHistoryItem } from "@/features/prompts/types"
import { useTabStore } from "@/stores/use-tab-store"
import type { ActionResult } from "@/types/actions"
import { HISTORY_FAILED, VersionHistoryDialog, type VersionHistoryDialogProps } from "./P7S1-dialog-spike"
import { clearDocumentCache, useDocumentLoader } from "./P7S1-loader-spike"
import { NEEDS_TITLE_TOAST, useDocumentPersistence } from "./P7S1-persistence-spike"
import { A, NOW, defer, makeEnv, type Deferred, type EditorEnv } from "./P7S1-test-fakes"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }))

type History = ActionResult<PromptVersionHistoryItem[]>

const history = (...rows: Array<[number, string | null, string]>): History => ({
  success: true,
  data: rows.map(([id, title, content]) => ({ id, created_at: NOW, title_snapshot: title, content_snapshot: content })),
})

/** A history read the test settles by hand. */
function makeHistory() {
  const calls: Array<{ promptId: string; d: Deferred<History> }> = []
  return {
    calls,
    loadHistory: (promptId: string) => {
      const d = defer<History>()
      calls.push({ promptId, d })
      return d.promise
    },
    answer: (index: number, value: History) =>
      act(async () => {
        calls[index].d.resolve(value)
      }),
    reject: (index: number) =>
      act(async () => {
        calls[index].d.reject(new Error("offline"))
      }),
  }
}

type HistoryFake = ReturnType<typeof makeHistory>

/** A restore the test settles by hand. */
function makeRestorer() {
  const calls: Array<{ versionId: number; d: Deferred<boolean> }> = []
  return {
    calls,
    onRestore: (versionId: number) => {
      const d = defer<boolean>()
      calls.push({ versionId, d })
      return d.promise
    },
    finish: (index: number, result: boolean) =>
      act(async () => {
        calls[index].d.resolve(result)
      }),
  }
}

interface HarnessProps {
  promptId: string | null
  loadHistory: VersionHistoryDialogProps["loadHistory"]
  onRestore: VersionHistoryDialogProps["onRestore"]
  changes?: boolean[]
}

/** The parent of the dialog: a button sets `open`, as EditorPane's History button does. */
function Harness({ promptId, loadHistory, onRestore, changes }: HarnessProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open history</button>
      <button onClick={() => setOpen(false)}>Close from the parent</button>
      <VersionHistoryDialog
        promptId={promptId}
        open={open}
        onOpenChange={(next) => {
          changes?.push(next)
          setOpen(next)
        }}
        loadHistory={loadHistory}
        onRestore={onRestore}
      />
    </>
  )
}

const openHistory = () => fireEvent.click(screen.getByRole("button", { name: "Open history" }))
const pressEscape = () => fireEvent.keyDown(document.body, { key: "Escape" })
const restoreButtons = () => screen.queryAllByRole("button", { name: /^Restor/ })
const isOpen = () => screen.queryByRole("dialog") !== null
const overlay = () => document.querySelector(".fixed.inset-0") as HTMLElement
/**
 * The "Restore this version?" question. Radix hides the history behind it while it is open, and hides it behind the history
 * when both open together, so the query ignores aria-hidden: a question that is in the DOM counts even if no user could reach it.
 */
const question = () => screen.queryByRole("alertdialog", { hidden: true })
const answer = (name: "Restore" | "Cancel") =>
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name }))
/** What a user does to restore: Restore on a row, then Restore on the question. */
const restoreRow = (index: number) => {
  fireEvent.click(restoreButtons()[index])
  answer("Restore")
}

beforeEach(() => {
  vi.clearAllMocks()
  clearDocumentCache()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("why the old dialog never loaded its list", () => {
  it("control: a controlled Radix Dialog reports only the changes it makes itself, never the parent's `open`", () => {
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
    expect(screen.getByText("Loading history...")).toBeTruthy()
    expect(h.calls.map((c) => c.promptId)).toEqual([A])

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
    expect(screen.getByText("Loading history...")).toBeTruthy()
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
    expect(screen.getByText("Loading history...")).toBeTruthy()
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
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={makeRestorer().onRestore} />, { wrapper: StrictMode })
    openHistory()
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
})

describe("restore from the dialog", () => {
  async function openWithTwoVersions() {
    const h = makeHistory()
    const r = makeRestorer()
    const changes: boolean[] = []
    render(<Harness promptId={A} loadHistory={h.loadHistory} onRestore={r.onRestore} changes={changes} />)
    openHistory()
    await h.answer(0, history([2, "Two", "two"], [1, "One", "one"]))
    return { r, changes }
  }

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
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    fireEvent.click(buttons[1])
    expect(r.calls).toHaveLength(1)
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
    expect(restoreButtons().every((b) => !(b as HTMLButtonElement).disabled)).toBe(true)

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

  describe("the question before a restore", () => {
    it("a click on Restore asks 'Restore this version?' and sends nothing", async () => {
      const { r, changes } = await openWithTwoVersions()
      fireEvent.click(restoreButtons()[1])
      expect(screen.getByRole("alertdialog")).toBeTruthy()
      expect(screen.getByText("Restore this version?")).toBeTruthy()
      expect(r.calls).toHaveLength(0)
      expect(changes).toEqual([])
    })

    it("Cancel drops the question, restores nothing and leaves the history open", async () => {
      const { r, changes } = await openWithTwoVersions()
      fireEvent.click(restoreButtons()[0])
      answer("Cancel")
      expect(question()).toBeNull()
      expect(r.calls).toHaveLength(0)
      expect(changes).toEqual([])
      expect(isOpen()).toBe(true)
      expect(restoreButtons().map((b) => b.textContent)).toEqual(["Restore", "Restore"])
    })

    it("Escape closes the question only, not the history behind it", async () => {
      const { r, changes } = await openWithTwoVersions()
      fireEvent.click(restoreButtons()[0])
      pressEscape()
      expect(question()).toBeNull()
      expect(isOpen()).toBe(true)
      expect(changes).toEqual([])
      expect(r.calls).toHaveLength(0)
    })

    it("confirming closes the question and restores the version that was asked about, once", async () => {
      const { r, changes } = await openWithTwoVersions()
      fireEvent.click(restoreButtons()[1])
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
      fireEvent.click(restoreButtons()[0])
      expect(question()).not.toBeNull()

      view.rerender(<Harness promptId="other" loadHistory={h.loadHistory} onRestore={r.onRestore} />)
      expect(question()).toBeNull()
      await h.answer(1, history([7, "Of other", "o"]))
      expect(question()).toBeNull()
      expect(r.calls).toHaveLength(0)
    })

    it("a history that its parent closes leaves no question behind, and none returns when it reopens", async () => {
      const { r } = await openWithTwoVersions()
      fireEvent.click(restoreButtons()[0])
      expect(question()).not.toBeNull()

      fireEvent.click(screen.getByText("Close from the parent"))
      expect(question()).toBeNull()
      expect(isOpen()).toBe(false)

      openHistory()
      expect(question()).toBeNull()
      expect(r.calls).toHaveLength(0)
    })
  })
})

interface EditorHarnessProps {
  env: EditorEnv
}

/** What EditorPane composes: the loader, the persistence hooks and the dialog, fed by the fake server. */
function EditorHarness({ env }: EditorHarnessProps) {
  const loader = useDocumentLoader({ promptId: A, io: env.io })
  const persistence = useDocumentPersistence({
    promptId: A,
    tabId: "tab-A",
    loader,
    actions: env.actions,
    getStorage: env.io.getStorage,
  })
  const [open, setOpen] = useState(false)
  return (
    <>
      <output data-testid="title">{loader.title}</output>
      <output data-testid="content">{loader.content}</output>
      <button onClick={() => loader.setContent("unsaved edit")}>Type</button>
      <button onClick={() => loader.setTitle("")}>Blank the title</button>
      <button onClick={() => setOpen(true)} disabled={!loader.ready}>
        History
      </button>
      <VersionHistoryDialog
        promptId={A}
        open={open}
        onOpenChange={setOpen}
        loadHistory={(id) => env.actions.getPromptVersionHistory({ promptId: id })}
        onRestore={persistence.handleRestore}
      />
    </>
  )
}

describe("the dialog beside the real hooks", () => {
  let env: EditorEnv

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
    }
  }
  const click = async (name: string) => {
    fireEvent.click(screen.getByRole("button", { name }))
    await settle()
  }
  /** Restore asks first: the first click asks, and the second, on the question, confirms. */
  const restore = async () => {
    await click("Restore")
    await click("Restore")
  }
  const content = () => screen.getByTestId("content").textContent
  const title = () => screen.getByTestId("title").textContent

  async function mount() {
    render(<EditorHarness env={env} />)
    await settle()
  }

  beforeEach(() => {
    vi.useFakeTimers()
    env = makeEnv({ [A]: { title: "Title", content: "server" } })
    env.state.versions.push({ id: 1, promptId: A, title: "Old title", content: "old text" })
    env.state.nextVersionId = 2
    useTabStore.setState({ tabs: [{ id: "tab-A", type: "document", title: "A", promptId: A }], activeTabId: "tab-A" })
  })

  it("History loads the list when the button is pressed; Restore puts the snapshot in the editor and closes the dialog", async () => {
    await mount()
    await click("History")
    expect(env.names()).toEqual(["history"])
    expect(screen.getByText("Title: Old title")).toBeTruthy()

    await restore()
    expect(content()).toBe("old text")
    expect(title()).toBe("Old title")
    expect(isOpen()).toBe(false)
    expect(env.names()).toEqual(["history", "restore"])
    expect(env.rows.get(A)).toEqual({ title: "Old title", content: "old text" })
  })

  it("unsaved edits are saved before the restore: the requests are the list, an autosave, then the restore", async () => {
    await mount()
    await click("Type")
    await click("History")
    await restore()
    expect(env.names()).toEqual(["history", "autosave", "restore"])
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Title", content: "unsaved edit" }])
    expect(content()).toBe("old text")
  })

  it("a blank title with unsaved edits refuses the restore: nothing is sent and the dialog stays open", async () => {
    await mount()
    await click("Blank the title")
    await click("Type")
    await click("History")
    await restore()
    expect(toast.error).toHaveBeenCalledWith(NEEDS_TITLE_TOAST)
    expect(env.names()).toEqual(["history"])
    expect(isOpen()).toBe(true)
    expect(content()).toBe("unsaved edit")
    expect(restoreButtons().every((b) => !(b as HTMLButtonElement).disabled)).toBe(true)
  })

  it("Escape during the restore request is ignored; the dialog closes when the restore completes", async () => {
    await mount()
    await click("History")
    const release = env.hold("restore")
    await restore()
    expect(restoreButtons().every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    pressEscape()
    await settle()
    expect(isOpen()).toBe(true)

    release()
    await settle()
    expect(isOpen()).toBe(false)
    expect(content()).toBe("old text")
  })

  it("a failed restore reports it, keeps the dialog open and allows another try", async () => {
    await mount()
    await click("History")
    env.failNext("restore")
    await restore()
    expect(toast.error).toHaveBeenCalledWith("restore failed")
    expect(isOpen()).toBe(true)
    expect(content()).toBe("server")

    await restore()
    expect(content()).toBe("old text")
    expect(isOpen()).toBe(false)
  })

  it("Cancel on the question sends nothing and leaves the editor as it was", async () => {
    await mount()
    await click("History")
    await click("Restore")
    expect(screen.getByRole("alertdialog")).toBeTruthy()
    await click("Cancel")
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(env.names()).toEqual(["history"])
    expect(content()).toBe("server")
    expect(isOpen()).toBe(true)
  })

  it("a failed history read is reported and the list says so", async () => {
    await mount()
    env.failNext("history")
    await click("History")
    expect(toast.error).toHaveBeenCalledWith("history failed")
    expect(screen.getByText(`${HISTORY_FAILED}.`)).toBeTruthy()
  })

  it("re-renders of the editor while the dialog is open do not read the history again, and the next opening does", async () => {
    await mount()
    await click("History")
    fireEvent.click(screen.getByText("Type"))
    await settle()
    expect(content()).toBe("unsaved edit")
    expect(env.inputs("history")).toHaveLength(1)

    pressEscape()
    await click("History")
    expect(env.inputs("history")).toHaveLength(2)
  })
})
