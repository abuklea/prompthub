// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useVersionSave.completions.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:17 GMT+10
Last modified: 22/10/2026 10:17 GMT+10
---------------
When a manual save completes (contract: Async Completions and Failures, Write Ordering and Pausing): autosave is
paused while the save runs, so edits typed meanwhile stay, keep their draft and are autosaved after it; a save that
completes after a switch or after the editor unmounted patches only its own cache entry and leaves the dirty flags
alone; and a handleSave left over from the previous document sends nothing. Composed with the real loader over the
fake server; assertions read the requests the server received and what the hooks and stores show.

Changelog:
22/10/2026 10:17 GMT+10 | Created (P7S1T7 step 2)
*/

import { act, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getCachedDocument } from "@/features/editor/document-cache"
import { hashContent } from "@/features/editor/draft"
import { draftOf } from "@/test/draft-world"
import { makeEnv, type EditorEnv } from "@/test/editor-env"
import { goTo, open, pressCtrlS, resetEditorWorld, settle, tabOf, tick, typeContent } from "@/test/editor-session"
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

describe("manual save completions", () => {
  it("edits typed during a save are not autosaved until it completes; they stay and keep their draft", async () => {
    const hook = await open(env)
    typeContent(hook, "one")
    const release = env.hold("save")
    pressCtrlS()
    await settle()
    typeContent(hook, "one two")
    await tick(AUTOSAVE_DELAY_MS * 4)
    expect(env.names()).toEqual(["save"])

    release()
    await settle()
    expect(hook.result.current.loader.content).toBe("one two")
    expect(hook.result.current.loader.synced).toEqual({ promptId: A, title: "Title", content: "one" })
    expect(draftOf(env.storage)).toEqual({ v: 1, base: hashContent("one"), content: "one two" })
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.state.requests).toEqual([
      { name: "save", input: { promptId: A, newTitle: "Title", newContent: "one" } },
      { name: "autosave", input: { promptId: A, title: "Title", content: "one two" } },
    ])
  })

  it("a save that completes after a switch leaves the open document alone and patches only its own entry", async () => {
    const hook = await open(env)
    typeContent(hook, "A saved")
    const release = env.hold("save")
    pressCtrlS()
    await settle()

    await goTo(hook, env, B, "tab-B")
    release()
    await settle()

    const { loader } = hook.result.current
    expect(loader.promptData).toMatchObject({ id: B, title: "B title", content: "B server" })
    expect(loader.synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(loader.lastSaved).toEqual(NOW)
    expect(tabOf("tab-B")).toMatchObject({ title: "B title", isDirty: false })
    const entry = getCachedDocument(USER_ID, A)
    expect(entry?.promptData).toMatchObject({ title: "Title", content: "A saved" })
    expect(entry?.synced).toEqual({ promptId: A, title: "Title", content: "A saved" })
    expect(getCachedDocument(USER_ID, B)?.synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(tabOf("tab-A")?.isNewDocument).toBe(false)
    // The dirty flag of a document that is not open is recomputed from its cache entry when it opens again.
    expect(tabOf("tab-A")?.isDirty).toBe(true)
    await goTo(hook, env, A, "tab-A")
    expect(tabOf("tab-A")?.isDirty).toBe(false)
  })

  it("a save that completes after an unmount leaves its tab's dirty flag alone and patches its entry", async () => {
    const first = await open(env)
    typeContent(first, "A saved")
    const release = env.hold("save")
    pressCtrlS()
    await settle()

    first.unmount()
    release()
    await settle()

    expect(tabOf("tab-A")?.isDirty).toBe(true)
    expect(tabOf("tab-A")?.isNewDocument).toBe(false)
    expect(getCachedDocument(USER_ID, A)?.synced).toEqual({ promptId: A, title: "Title", content: "A saved" })

    const second = await open(env)
    expect(second.result.current.loader.synced).toEqual({ promptId: A, title: "Title", content: "A saved" })
    expect(tabOf("tab-A")?.isDirty).toBe(false)
    expect(env.names()).toEqual(["save"])
  })

  it("a handleSave left over from the previous document sends nothing", async () => {
    const hook = await open(env)
    const stale = hook.result.current.persistence.handleSave
    await goTo(hook, env, B, "tab-B")
    typeContent(hook, "B text")

    act(() => {
      stale()
    })
    await settle()
    expect(env.names()).toEqual([])
    expect(hook.result.current.persistence.saving).toBe(false)
  })
})
