// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentCacheSync.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:17 GMT+10
Last modified: 22/10/2026 10:17 GMT+10
---------------
The cache entry and tab metadata through useDocumentPersistence, composed with the real loader over the fake server
and the real tab store: the tab follows the open document (title, folder, dirty flag, promotion of a preview tab), the
cache holds the working copy so a remount resumes the autosave, and nothing is cached for a document that is not
ready, so one document's text is never cached under another's id.

Changelog:
22/10/2026 10:17 GMT+10 | Created (P7S1T7 step 2)
*/

import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getCachedDocument } from "@/features/editor/document-cache"
import { makeEnv, type EditorEnv } from "@/test/editor-env"
import { goTo, open, resetEditorWorld, settle, tabOf, tick, typeContent } from "@/test/editor-session"
import { A, B, USER_ID } from "@/test/loader-world"
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

describe("cache and tab metadata", () => {
  it("the tab follows the document: title, folder, dirty flag, and the first edit promotes a preview tab", async () => {
    const hook = await open(env)
    expect(tabOf("tab-A")).toMatchObject({ title: "Title", folderId: "f1", isDirty: false, isPreview: true })

    typeContent(hook, "typed")
    expect(tabOf("tab-A")).toMatchObject({ isDirty: true, isPreview: false })
    expect(tabOf("tab-B")).toMatchObject({ title: "B" })
    expect(tabOf("tab-B")?.isDirty).toBeUndefined()
  })

  it("the working copy is cached, so a remount shows it and the autosave resumes", async () => {
    const first = await open(env)
    typeContent(first, "typed")
    first.unmount()
    expect(env.names()).toEqual([])

    const second = await open(env)
    expect(second.result.current.loader.content).toBe("typed")
    expect(second.result.current.loader.synced?.content).toBe("server")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Title", content: "typed" }])
  })

  it("a document that is not ready is not cached; a switch never caches one text under another id", async () => {
    const hook = await open(env)
    typeContent(hook, "A typed")
    const release = env.hold("fetch")
    await goTo(hook, env, B, "tab-B")
    expect(hook.result.current.loader.ready).toBe(false)
    expect(getCachedDocument(USER_ID, B)).toBeNull()
    expect(getCachedDocument(USER_ID, A)?.content).toBe("A typed")
    release()
    await settle()
    expect(getCachedDocument(USER_ID, B)?.content).toBe("B server")
    expect(getCachedDocument(USER_ID, A)?.content).toBe("A typed")
    expect(tabOf("tab-B")).toMatchObject({ title: "B title", isDirty: false })
  })
})
