// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useVersionSave.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:17 GMT+10
Last modified: 22/10/2026 10:17 GMT+10
---------------
The manual save, mostly through useDocumentPersistence composed with the real loader over the fake server (contract:
Async Completions and Failures): Ctrl+S, Cmd+S and the Save button save a version and record it; a blank or placeholder
title opens the set-title dialog, and one confirmation saves once with the confirmed title, which becomes the working
title (#36); a failed, rejected or timed-out save resets `saving` and reports it; a second Ctrl+S while one runs, a
save while blocked and a save for a document that is not ready send nothing. Assertions read the requests the server
received and what the hooks show.

Changelog:
22/10/2026 10:17 GMT+10 | Created (P7S1T7 step 2)
*/

import { act, cleanup, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { withActionTimeout, type DocumentActions } from "@/features/editor/document-actions"
import { REQUEST_TIMEOUT_MS } from "@/features/editor/request-timeout"
import { useUiStore } from "@/stores/use-ui-store"
import { draftOf, stored } from "@/test/draft-world"
import { makeEnv, type EditorEnv } from "@/test/editor-env"
import { open, pressCtrlS, resetEditorWorld, setTitle, settle, tabOf, tick, typeContent } from "@/test/editor-session"
import { A, B } from "@/test/loader-world"
import { AUTOSAVE_DELAY_MS } from "./useAutoSave"
import { useDocumentLoader, type DocumentLoader } from "./useDocumentLoader"
import { useVersionSave } from "./useVersionSave"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

let env: EditorEnv

beforeEach(() => {
  resetEditorWorld()
  env = makeEnv({
    [A]: { title: "Title", content: "server" },
    [B]: { title: "B title", content: "B server" },
    untitled: { title: null, content: "" },
  })
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())

describe("manual save", () => {
  it("Ctrl+S saves a version: request, baseline, promptData, draft, toast, tab flags and a list refetch", async () => {
    const hook = await open(env)
    typeContent(hook, "v2")
    pressCtrlS()
    await settle()

    expect(env.state.requests).toEqual([{ name: "save", input: { promptId: A, newTitle: "Title", newContent: "v2" } }])
    const { loader, persistence } = hook.result.current
    expect(loader.synced).toEqual({ promptId: A, title: "Title", content: "v2" })
    expect(loader.promptData).toMatchObject({ title: "Title", content: "v2" })
    expect(stored(env.storage)).toBeNull()
    expect(toast.success).toHaveBeenCalledWith("Version saved successfully")
    expect(tabOf("tab-A")).toMatchObject({ isDirty: false, isNewDocument: false })
    expect(useUiStore.getState().promptRefetchTrigger).toBe(1)
    expect(persistence.saving).toBe(false)
  })

  it("the Save button handler does the same as Ctrl+S", async () => {
    const hook = await open(env)
    typeContent(hook, "v2")
    act(() => {
      hook.result.current.persistence.handleSave()
    })
    await settle()
    expect(env.inputs("save")).toEqual([{ promptId: A, newTitle: "Title", newContent: "v2" }])
    expect(hook.result.current.loader.synced?.content).toBe("v2")
  })

  it("Cmd+S (the Meta key) saves too", async () => {
    const hook = await open(env)
    typeContent(hook, "v2")
    pressCtrlS({ metaKey: true })
    await settle()
    expect(env.names()).toEqual(["save"])
    expect(hook.result.current.persistence.saving).toBe(false)
  })

  it("#36: one title confirmation saves once with the confirmed title, which becomes the working title", async () => {
    const hook = await open(env, { promptId: "untitled", tabId: "tab-A" })
    typeContent(hook, "first text")
    pressCtrlS()
    await settle()
    expect(hook.result.current.persistence.showSetTitleDialog).toBe(true)
    expect(env.names()).toEqual([])

    act(() => {
      hook.result.current.persistence.handleSetTitle("My prompt")
    })
    await settle()
    expect(env.state.requests).toEqual([
      { name: "save", input: { promptId: "untitled", newTitle: "My prompt", newContent: "first text" } },
    ])
    expect(hook.result.current.persistence.showSetTitleDialog).toBe(false)
    expect(hook.result.current.loader.title).toBe("My prompt")
    expect(hook.result.current.loader.synced).toEqual({
      promptId: "untitled", title: "My prompt", content: "first text",
    })

    typeContent(hook, "first text, more")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["save", "autosave"])
    expect(env.inputs("autosave")).toEqual([{ promptId: "untitled", title: "My prompt", content: "first text, more" }])
  })

  it("a placeholder title opens the dialog and sends nothing", async () => {
    const hook = await open(env)
    setTitle(hook, "[Untitled Doc 2]")
    pressCtrlS()
    await settle()
    expect(hook.result.current.persistence.showSetTitleDialog).toBe(true)
    expect(env.inputs("save")).toEqual([])
  })

  it("the Ctrl+S handler uses the latest title", async () => {
    const hook = await open(env)
    setTitle(hook, "First")
    pressCtrlS()
    await settle()
    setTitle(hook, "Second")
    typeContent(hook, "again")
    pressCtrlS()
    await settle()
    expect(env.inputs("save").map((input) => input.newTitle)).toEqual(["First", "Second"])
  })

  it("a second Ctrl+S while a save is in flight is ignored", async () => {
    const hook = await open(env)
    typeContent(hook, "v2")
    const release = env.hold("save")
    pressCtrlS()
    await settle()
    expect(hook.result.current.persistence.saving).toBe(true)
    pressCtrlS()
    act(() => {
      hook.result.current.persistence.handleSave()
    })
    await settle()
    expect(env.names()).toEqual(["save"])
    release()
    await settle()
    expect(env.names()).toEqual(["save"])
    expect(hook.result.current.persistence.saving).toBe(false)
  })

  it("a failed save keeps the working copy and the draft and reports the error", async () => {
    env.failNext("save")
    const hook = await open(env)
    typeContent(hook, "v2")
    pressCtrlS()
    await settle()
    expect(toast.error).toHaveBeenCalledWith("save failed", { duration: 6000 })
    expect(hook.result.current.loader.synced?.content).toBe("server")
    expect(hook.result.current.loader.content).toBe("v2")
    expect(draftOf(env.storage)?.content).toBe("v2")
    expect(hook.result.current.persistence.saving).toBe(false)
  })

  it("a rejected save resets saving, reports it, and a later Ctrl+S works", async () => {
    env.failNext("save", "reject")
    const hook = await open(env)
    typeContent(hook, "v2")
    pressCtrlS()
    await settle()
    expect(toast.error).toHaveBeenCalledWith("The version could not be saved", { duration: 6000 })
    expect(hook.result.current.persistence.saving).toBe(false)
    expect(hook.result.current.loader.synced?.content).toBe("server")

    pressCtrlS()
    await settle()
    expect(env.inputs("save").map((input) => input.newContent)).toEqual(["v2", "v2"])
    expect(hook.result.current.loader.synced?.content).toBe("v2")
  })

  it("a save that never settles is abandoned at the timeout: an error, flag resets, Ctrl+S works again", async () => {
    const gate = env.hold("save")
    const hook = await open(env, { actions: withActionTimeout(env.actions) })
    typeContent(hook, "v2")
    pressCtrlS()
    await settle()
    expect(hook.result.current.persistence.saving).toBe(true)

    await tick(REQUEST_TIMEOUT_MS)
    await settle()
    expect(hook.result.current.persistence.saving).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("The version could not be saved", { duration: 6000 })
    expect(hook.result.current.loader.synced?.content).toBe("server")

    gate()
    pressCtrlS()
    await settle()
    expect(env.names()).toEqual(["save", "save"])
    expect(hook.result.current.loader.synced?.content).toBe("v2")
  })

  it("nothing is sent and no dialog opens while the document is loading", async () => {
    env.hold("fetch")
    const hook = await open(env)
    expect(hook.result.current.loader.ready).toBe(false)
    pressCtrlS()
    act(() => {
      hook.result.current.persistence.handleSave()
    })
    await settle()
    expect(env.names()).toEqual([])
    expect(hook.result.current.persistence.showSetTitleDialog).toBe(false)
  })
})

describe("useVersionSave alone", () => {
  it("does nothing for a loader that is not ready, even when its fields look valid", async () => {
    const sent: unknown[] = []
    // Reason: a plain fake that is not ready; the hook must act on `ready`, not on fields that look valid.
    const notReady = {
      ready: false,
      title: "Title",
      content: "text",
      synced: { promptId: A, title: "Title", content: "server" },
      markSynced: () => true,
      setTitle: () => {},
    } as unknown as DocumentLoader
    const actions: DocumentActions = {
      ...makeEnv({}).actions,
      saveNewVersion: async (input) => (sent.push(input), { success: true, data: { versionId: 1 } }),
    }
    const args = { promptId: A, tabId: "tab-A", loader: notReady, actions, blocked: false }
    const hook = renderHook(() => useVersionSave(args))
    act(() => {
      hook.result.current.handleSave()
    })
    pressCtrlS()
    await settle()
    expect(sent).toEqual([])
    expect(hook.result.current.showSetTitleDialog).toBe(false)
  })

  it("a save while blocked (a restore runs) is ignored; once unblocked it is sent", async () => {
    const hook = renderHook(
      ({ blocked }: { blocked: boolean }) => {
        const loader = useDocumentLoader({ promptId: A, io: env.io })
        const args = { promptId: A, tabId: "tab-A", loader, actions: env.actions, blocked }
        return { loader, save: useVersionSave(args) }
      },
      { initialProps: { blocked: true } }
    )
    await settle()
    act(() => {
      hook.result.current.loader.setContent("v2")
    })
    pressCtrlS()
    act(() => {
      hook.result.current.save.handleSave()
    })
    await settle()
    expect(env.names()).toEqual([])

    hook.rerender({ blocked: false })
    pressCtrlS()
    await settle()
    expect(env.inputs("save")).toEqual([{ promptId: A, newTitle: "Title", newContent: "v2" }])
  })
})
