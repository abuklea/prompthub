// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.draft-conflict.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:34 GMT+10
Last modified: 22/10/2026 09:34 GMT+10
---------------
The loader's draft decision for a draft that does not apply (contract: Draft Protocol), set up by writing the draft keys
into a fake storage and opening the document with the loader alone: a v1 draft written against other server content
loses to the server, its text is stashed under the conflict key and offered once by a warning toast whose action works
only while the same document is open and which is dismissed when the document is left (S-8 to S-8e, S-10b); a draft
equal to the server is removed silently (S-9); a value under the v1 key that is not a v1 envelope is left alone (S-14).

Changelog:
22/10/2026 09:34 GMT+10 | Created: the draft scenarios of the loader that keep the server's text (P7S1T6 step 1)
*/

import { act, cleanup } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { clearDocumentCache } from "@/features/editor/document-cache"
import { draftKey, hashContent, legacyDraftKey } from "@/features/editor/draft"
import { needsAutoSave } from "@/features/editor/sync"
import { A, B, makeWorld, type World } from "@/test/loader-world"
import { conflictToast, openLoader, settle, stored, storedConflict, storedLegacy, v1 } from "@/test/draft-world"

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(() => "conflict-toast"), dismiss: vi.fn() },
}))

const CONFLICT = "Local unsaved changes were not restored: they differ from the saved document"

let world: World

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
  vi.clearAllMocks()
  world = makeWorld({ [A]: { title: "Title", content: "server" } })
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

/** A world with two documents, where A holds a v1 draft written against older server content. */
function twoDocumentsWithConflictOnA(): World {
  const two = makeWorld({ [A]: { title: "A", content: "A server" }, [B]: { title: "B", content: "B server" } })
  two.storage.map.set(draftKey(A), v1(hashContent("older"), "stale local"))
  return two
}

describe("useDocumentLoader keeps the server's text when a draft does not apply", () => {
  it("S-8: a draft written against other server content loses: warning, text stashed, draft removed", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older server"), "stale local"))
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("server")
    expect(result.current.synced?.content).toBe("server")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toBe(CONFLICT)
    expect(toast.info).not.toHaveBeenCalled()
    expect(stored(world.storage)).toBeNull()
    expect(storedConflict(world.storage)).toBe("stale local")
  })

  it("S-8b: the toast offers 'Restore my text' for 20 s; using it puts the stashed text in the editor", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older server"), "stale local"))
    const { result } = await openLoader(world)
    expect(toast.warning).toHaveBeenCalledTimes(1)
    const options = conflictToast()
    expect(options.action.label).toBe("Restore my text")
    expect(options.duration).toBe(20_000)

    act(() => options.action.onClick())
    expect(result.current.content).toBe("stale local")
    expect(result.current.synced?.content).toBe("server")
    expect(needsAutoSave(A, result.current, result.current.synced)).toBe(true)
  })

  it("S-8c: the toast's action changes nothing once another document is open", async () => {
    world = twoDocumentsWithConflictOnA()
    const hook = await openLoader(world, A)
    expect(toast.warning).toHaveBeenCalledTimes(1)
    const options = conflictToast()

    hook.rerender({ promptId: B, io: world.io })
    await settle()
    act(() => options.action.onClick())
    expect(hook.result.current.content).toBe("B server")
    expect(hook.result.current.synced).toEqual({ promptId: B, title: "B", content: "B server" })
  })

  it("S-8d: the toast is dismissed when the document is left and when the editor unmounts", async () => {
    world = twoDocumentsWithConflictOnA()
    const hook = await openLoader(world, A)
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(toast.dismiss).not.toHaveBeenCalled()

    hook.rerender({ promptId: B, io: world.io })
    await settle()
    expect(toast.dismiss).toHaveBeenCalledWith("conflict-toast")

    vi.mocked(toast.dismiss).mockClear()
    world.storage.map.set(draftKey(B), v1(hashContent("older"), "stale B"))
    hook.unmount()
    const again = await openLoader(world, B)
    expect(toast.warning).toHaveBeenCalledTimes(2)
    expect(toast.dismiss).not.toHaveBeenCalled()
    again.unmount()
    expect(toast.dismiss).toHaveBeenCalledWith("conflict-toast")
  })

  it("S-8e: when the storage refuses the stash the draft stays where it is and the toast still offers it", async () => {
    const raw = v1(hashContent("older server"), "stale local")
    world.storage.map.set(draftKey(A), raw)
    world.storage.refuseWrites = true
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("server")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(storedConflict(world.storage)).toBeNull()
    expect(stored(world.storage)).toBe(raw)

    act(() => conflictToast().action.onClick())
    expect(result.current.content).toBe("stale local")
  })

  it("S-9: a draft equal to the server's content is removed without a toast, in v1 and in legacy form", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older"), "server"))
    const first = await openLoader(world)
    expect(first.result.current.content).toBe("server")
    expect(stored(world.storage)).toBeNull()
    first.unmount()

    world.storage.map.set(legacyDraftKey(A), "server")
    const second = await openLoader(world)
    expect(second.result.current.content).toBe("server")
    expect(storedLegacy(world.storage)).toBeNull()
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("S-10b: typing after a lost autosave response is a conflict on reload; the text is offered", async () => {
    world = makeWorld({ [A]: { title: "Title", content: "one" } })
    world.storage.map.set(draftKey(A), v1(hashContent("server"), "one two"))
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("one")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(storedConflict(world.storage)).toBe("one two")
    expect(stored(world.storage)).toBeNull()

    act(() => conflictToast().action.onClick())
    expect(result.current.content).toBe("one two")
  })

  it("S-14: a value under the v1 key that is not a v1 envelope is left in place and never applied", async () => {
    const future = JSON.stringify({ v: 2, base: "x", content: "from the future" })
    world.storage.map.set(draftKey(A), future)
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("server")
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    expect(stored(world.storage)).toBe(future)
  })
})
