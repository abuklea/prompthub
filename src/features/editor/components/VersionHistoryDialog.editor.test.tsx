// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/components/VersionHistoryDialog.editor.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:42 GMT+10
Last modified: 22/10/2026 10:42 GMT+10
---------------
The history dialog beside the real loader and persistence hooks, composed as EditorPane composes them over the fake
server: History loads the list, a confirmed Restore puts the snapshot in the editor and closes the dialog, unsaved
edits are saved before the restore, a blank title with unsaved edits is refused, Escape is ignored while the request
runs, and a failed restore or a failed read is reported. Assertions read the requests the server received and what
the editor and the dialog show.

Changelog:
22/10/2026 10:42 GMT+10 | Created from the P7S1 dialog spike suite (P7S1T8 step 2)
*/

import { useState } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDocumentLoader } from "@/features/editor/hooks/useDocumentLoader"
import { useDocumentPersistence } from "@/features/editor/hooks/useDocumentPersistence"
import { makeEnv, type EditorEnv } from "@/test/editor-env"
import { resetEditorWorld } from "@/test/editor-session"
import { isOpen, pressEscape, restoreButtons } from "@/test/history-dialog"
import { A } from "@/test/loader-world"
import { VersionHistoryDialog } from "./VersionHistoryDialog"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

const NEEDS_TITLE = "Give the document a title first, so your changes are saved before a version is restored"
const HISTORY_FAILED = "The history could not be loaded"

/** What EditorPane composes: the loader, the persistence hooks and the dialog, fed by the fake server. */
function EditorHarness({ env }: { env: EditorEnv }) {
  const loader = useDocumentLoader({ promptId: A, io: env.io })
  const persistence = useDocumentPersistence({
    promptId: A, tabId: "tab-A", loader, actions: env.actions, getStorage: env.io.getStorage,
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

let env: EditorEnv

const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }
}
/** Clicks the one reachable button of that name; asserts there is exactly one. */
const click = async (name: string) => {
  const buttons = screen.queryAllByRole("button", { name })
  expect(buttons, `one reachable "${name}" button`).toHaveLength(1)
  fireEvent.click(buttons[0])
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
  resetEditorWorld()
  env = makeEnv({ [A]: { title: "Title", content: "server" } })
  env.state.versions.push({ id: 1, promptId: A, title: "Old title", content: "old text" })
  env.state.nextVersionId = 2
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())

describe("the dialog beside the real hooks", () => {
  it("History loads the list; a confirmed Restore puts the snapshot in the editor and closes the dialog", async () => {
    await mount()
    await click("History")
    expect(env.names()).toEqual(["history"])
    expect(screen.queryByText("Title: Old title")).not.toBeNull()

    await restore()
    expect(content()).toBe("old text")
    expect(title()).toBe("Old title")
    expect(isOpen()).toBe(false)
    expect(env.names()).toEqual(["history", "restore"])
  })

  it("unsaved edits are saved first: the requests are the list, an autosave, then the restore", async () => {
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
    expect(toast.error).toHaveBeenCalledWith(NEEDS_TITLE)
    expect(env.names()).toEqual(["history"])
    expect(isOpen()).toBe(true)
    expect(content()).toBe("unsaved edit")
    expect(restoreButtons().map((b) => b.disabled)).toEqual([false])
  })

  it("Escape during the restore request is ignored; the dialog closes when the restore completes", async () => {
    await mount()
    await click("History")
    const release = env.hold("restore")
    await restore()
    expect(restoreButtons().map((b) => b.disabled)).toEqual([true])
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
    expect(screen.queryByRole("alertdialog")).not.toBeNull()
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
    expect(screen.queryByText(`${HISTORY_FAILED}.`)).not.toBeNull()
  })

  it("re-renders while the dialog is open do not read the history again; the next opening does", async () => {
    await mount()
    await click("History")
    expect(env.inputs("history")).toHaveLength(1)
    fireEvent.click(screen.getByText("Type"))
    await settle()
    expect(content()).toBe("unsaved edit")
    expect(env.inputs("history")).toHaveLength(1)

    pressEscape()
    await click("History")
    expect(env.inputs("history")).toHaveLength(2)
  })
})
