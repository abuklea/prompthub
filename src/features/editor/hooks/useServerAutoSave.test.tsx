// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useServerAutoSave.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:17 GMT+10
Last modified: 22/10/2026 10:17 GMT+10
---------------
The server autosave through useDocumentPersistence, composed with the real loader over the fake server (contract:
Async Completions and Failures, decision D3): nothing is written on open (#35), an edit is written once after the
debounce and clears its draft (S-1), a failed or rejected write resets `autoSaving` and is not retried, a request that
never settles is abandoned at the request timeout, overlapping requests keep `autoSaving` true until the last one ends,
a completion after a switch touches only its own document, and Strict Mode sends one request. Assertions read the
requests the server received and what the hooks show.

Changelog:
22/10/2026 10:17 GMT+10 | Created (P7S1T7 step 2)
*/

import { StrictMode } from "react"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getCachedDocument } from "@/features/editor/document-cache"
import { withActionTimeout } from "@/features/editor/document-actions"
import { hashContent } from "@/features/editor/draft"
import { REQUEST_TIMEOUT_MS } from "@/features/editor/request-timeout"
import { saveStatus } from "@/features/editor/sync"
import { useUiStore } from "@/stores/use-ui-store"
import { draftOf, stored } from "@/test/draft-world"
import { listItem, makeEnv, type EditorEnv } from "@/test/editor-env"
import { goTo, open, resetEditorWorld, setTitle, settle, tick, typeContent } from "@/test/editor-session"
import { A, B, NOW, USER_ID } from "@/test/loader-world"
import { AUTOSAVE_DELAY_MS } from "./useAutoSave"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

let env: EditorEnv

beforeEach(() => {
  resetEditorWorld()
  env = makeEnv({ [A]: { title: "Title", content: "server" }, [B]: { title: "B title", content: "B server" } })
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())

describe("autosave through the persistence hook", () => {
  it("#35: opening a titled document writes nothing, even long after the delay", async () => {
    await open(env)
    await tick(5000)
    expect(env.names()).toEqual([])
  })

  it("S-1: an edit is autosaved once after the delay; baseline advances, draft goes, footer reads saved", async () => {
    const hook = await open(env)
    typeContent(hook, "typed")
    expect(draftOf(env.storage)).toEqual({ v: 1, base: hashContent("server"), content: "typed" })
    const { loader } = hook.result.current
    expect(saveStatus({ autoSaving: false, working: loader, synced: loader.synced })).toBe("unsaved")

    await tick(AUTOSAVE_DELAY_MS - 1)
    expect(env.names()).toEqual([])
    await tick(1)
    await settle()
    expect(env.state.requests).toEqual([{ name: "autosave", input: { promptId: A, title: "Title", content: "typed" } }])
    const after = hook.result.current
    expect(after.loader.synced).toEqual({ promptId: A, title: "Title", content: "typed" })
    expect(stored(env.storage)).toBeNull()
    expect(after.persistence.autoSaving).toBe(false)
    expect(saveStatus({ autoSaving: false, working: after.loader, synced: after.loader.synced })).toBe("saved")
  })

  it("a burst of edits is one request, with the last text", async () => {
    const hook = await open(env)
    typeContent(hook, "a")
    await tick(100)
    typeContent(hook, "ab")
    await tick(100)
    typeContent(hook, "abc")
    await tick(2000)
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Title", content: "abc" }])
  })

  it("a failed autosave keeps the draft, sets no baseline, resets the flag and is not retried", async () => {
    env.failNext("autosave")
    const hook = await open(env)
    typeContent(hook, "typed")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    await tick(20000)
    expect(env.names()).toEqual(["autosave"])
    expect(hook.result.current.loader.synced?.content).toBe("server")
    expect(draftOf(env.storage)?.content).toBe("typed")
    expect(hook.result.current.persistence.autoSaving).toBe(false)
  })

  it("a rejected autosave resets autoSaving, and the next edit is saved", async () => {
    env.failNext("autosave", "reject")
    const hook = await open(env)
    typeContent(hook, "a")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(hook.result.current.persistence.autoSaving).toBe(false)
    expect(hook.result.current.loader.synced?.content).toBe("server")

    typeContent(hook, "ab")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.inputs("autosave").map((input) => input.content)).toEqual(["a", "ab"])
    expect(hook.result.current.loader.synced?.content).toBe("ab")
    expect(hook.result.current.persistence.autoSaving).toBe(false)
  })

  it("a request that never settles is abandoned at the timeout: flag resets, the next edit is saved", async () => {
    const gate = env.hold("autosave")
    const hook = await open(env, { actions: withActionTimeout(env.actions) })
    typeContent(hook, "stuck")
    await tick(AUTOSAVE_DELAY_MS)
    expect(hook.result.current.persistence.autoSaving).toBe(true)

    await tick(REQUEST_TIMEOUT_MS)
    await settle()
    expect(hook.result.current.persistence.autoSaving).toBe(false)
    expect(hook.result.current.loader.synced?.content).toBe("server")

    gate()
    typeContent(hook, "stuck, then saved")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.inputs("autosave").map((input) => input.content)).toEqual(["stuck", "stuck, then saved"])
    expect(hook.result.current.loader.synced?.content).toBe("stuck, then saved")
    expect(hook.result.current.persistence.autoSaving).toBe(false)
  })

  it("autoSaving stays true until every overlapping request has finished", async () => {
    const hook = await open(env)
    const gate = env.hold("autosave")
    typeContent(hook, "one")
    await tick(AUTOSAVE_DELAY_MS)
    typeContent(hook, "one two")
    await tick(AUTOSAVE_DELAY_MS)
    expect(env.names()).toEqual(["autosave", "autosave"])
    expect(hook.result.current.persistence.autoSaving).toBe(true)

    gate.releaseOne()
    await settle()
    expect(hook.result.current.persistence.autoSaving).toBe(true)
    gate.releaseOne()
    await settle()
    expect(hook.result.current.persistence.autoSaving).toBe(false)
  })

  it("an autosave that completes after a switch leaves the open document alone and updates its own", async () => {
    useUiStore.setState({ prompts: [listItem(A, "Old A"), listItem(B, "B title")] })
    const hook = await open(env)
    typeContent(hook, "A typed")
    const release = env.hold("autosave")
    await tick(AUTOSAVE_DELAY_MS)
    expect(env.names()).toEqual(["autosave"])

    await goTo(hook, env, B, "tab-B")
    expect(hook.result.current.loader.lastSaved).toEqual(NOW)
    release()
    await settle()

    expect(hook.result.current.loader.synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(hook.result.current.loader.content).toBe("B server")
    expect(hook.result.current.loader.lastSaved).toEqual(NOW)
    expect(getCachedDocument(USER_ID, A)?.synced).toEqual({ promptId: A, title: "Title", content: "A typed" })
    expect(useUiStore.getState().prompts.map((p) => p.title)).toEqual(["Title", "B title"])
  })

  it("a title typed before the document is ready is neither written nor kept", async () => {
    const release = env.hold("fetch")
    const hook = await open(env)
    expect(hook.result.current.loader.ready).toBe(false)
    setTitle(hook, "early")
    await tick(5000)
    expect(env.names()).toEqual([])

    release()
    await settle()
    expect(hook.result.current.loader.title).toBe("Title")
    await tick(5000)
    expect(env.names()).toEqual([])
  })

  it("a successful autosave updates the title in the document list", async () => {
    useUiStore.setState({ prompts: [listItem(A, "Old list title")] })
    const hook = await open(env)
    setTitle(hook, "Renamed")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Renamed", content: "server" }])
    expect(useUiStore.getState().prompts.find((p) => p.id === A)?.title).toBe("Renamed")
  })

  it("works under React Strict Mode: one request, draft cleared", async () => {
    const hook = await open(env, { wrapper: StrictMode })
    typeContent(hook, "typed")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Title", content: "typed" }])
    expect(stored(env.storage)).toBeNull()
    expect(hook.result.current.loader.synced?.content).toBe("typed")
  })
})
