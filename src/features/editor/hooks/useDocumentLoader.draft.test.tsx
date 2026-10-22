// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentLoader.draft.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:34 GMT+10
Last modified: 22/10/2026 09:34 GMT+10
---------------
The loader's draft decision when a document is opened (contract: Draft Protocol), set up by writing the draft keys into
a fake storage and opening the document with the loader alone: a v1 draft written against the server's content is
applied with a toast and the baseline stays the server's (S-2, S-4, S-5, S-6); the raw value of the removed hook under
the legacy key is applied and migrated only for a document that was never saved, and otherwise stashed as a conflict
(S-7a to S-7e, S-14b). Assertions read the storage itself, not the draft store's reader.

Changelog:
22/10/2026 09:34 GMT+10 | Created: the draft scenarios of the loader that apply or migrate a draft (P7S1T6 step 1)
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import { toast } from "sonner"
import { clearDocumentCache } from "@/features/editor/document-cache"
import { draftKey, hashContent, legacyDraftKey } from "@/features/editor/draft"
import { needsAutoSave } from "@/features/editor/sync"
import { A, makeWorld, type World } from "@/test/loader-world"
import { draftOf, openLoader, stored, storedConflict, storedLegacy, v1 } from "@/test/draft-world"

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(() => "conflict-toast"), dismiss: vi.fn() },
}))

const RESTORED = "Restored unsaved changes from browser storage"

let world: World

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
  vi.clearAllMocks()
  world = makeWorld({ [A]: { title: "Title", content: "server" } })
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

describe("useDocumentLoader applies a v1 draft written against the server's content", () => {
  it("S-2: a draft left by a failed autosave is applied with a toast; the baseline stays the server's", async () => {
    const raw = v1(hashContent("server"), "typed")
    world.storage.map.set(draftKey(A), raw)
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("typed")
    expect(result.current.title).toBe("Title")
    expect(result.current.synced).toEqual({ promptId: A, title: "Title", content: "server" })
    expect(toast.info).toHaveBeenCalledWith(RESTORED)
    expect(toast.warning).not.toHaveBeenCalled()
    expect(needsAutoSave(A, result.current, result.current.synced)).toBe(true)
    expect(stored(world.storage)).toBe(raw)
  })

  it("S-4: an empty draft is a valid draft: the cleared document is applied on reload", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("server"), ""))
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("")
    expect(result.current.synced?.content).toBe("server")
    expect(toast.info).toHaveBeenCalledWith(RESTORED)
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent("server"), content: "" })
  })

  it("S-5: an untitled document's typed text is restored, and the autosave still has nothing to write", async () => {
    world = makeWorld({ [A]: { title: null, content: "server" } })
    world.storage.map.set(draftKey(A), v1(hashContent("server"), "typed"))
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("typed")
    expect(result.current.title).toBeNull()
    expect(needsAutoSave(A, result.current, result.current.synced)).toBe(false)
    expect(draftOf(world.storage)?.content).toBe("typed")
  })

  it("S-6: a rename from the list does not invalidate the draft: content restored, title from the server", async () => {
    world = makeWorld({ [A]: { title: "Renamed", content: "server" } })
    world.storage.map.set(draftKey(A), v1(hashContent("server"), "typed"))
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("typed")
    expect(result.current.title).toBe("Renamed")
    expect(toast.warning).not.toHaveBeenCalled()
  })
})

describe("useDocumentLoader reads the legacy raw draft once", () => {
  it("S-7a: for a document never saved it is the only copy: applied, rewritten as v1, legacy removed", async () => {
    world = makeWorld({ [A]: { title: null, content: "" } })
    world.storage.map.set(legacyDraftKey(A), "legacy text")
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("legacy text")
    expect(toast.info).toHaveBeenCalledWith(RESTORED)
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent(""), content: "legacy text" })
    expect(storedLegacy(world.storage)).toBeNull()
  })

  it("S-7b: one that differs from a saved document is not applied: warning, text stashed, legacy removed", async () => {
    world.storage.map.set(legacyDraftKey(A), "stale legacy text")
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("server")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(toast.info).not.toHaveBeenCalled()
    expect(stored(world.storage)).toBeNull()
    expect(storedLegacy(world.storage)).toBeNull()
    expect(storedConflict(world.storage)).toBe("stale legacy text")
    expect(needsAutoSave(A, result.current, result.current.synced)).toBe(false)
  })

  it("S-7c: one equal to the server's content is removed without a toast", async () => {
    world.storage.map.set(legacyDraftKey(A), "server")
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("server")
    expect(storedLegacy(world.storage)).toBeNull()
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("S-7d: when both keys exist the v1 envelope wins and the legacy value is left alone", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("server"), "from v1"))
    world.storage.map.set(legacyDraftKey(A), "from legacy")
    const { result } = await openLoader(world)
    expect(result.current.content).toBe("from v1")
    expect(storedLegacy(world.storage)).toBe("from legacy")
  })

  it("S-7e: while the v1 write is refused the text is applied in memory; the legacy value stays", async () => {
    world = makeWorld({ [A]: { title: null, content: "" } })
    world.storage.map.set(legacyDraftKey(A), "legacy text")
    world.storage.refuseWrites = true
    const first = await openLoader(world)
    expect(first.result.current.content).toBe("legacy text")
    expect(storedLegacy(world.storage)).toBe("legacy text")
    expect(stored(world.storage)).toBeNull()
    first.unmount()

    world.storage.refuseWrites = false
    const second = await openLoader(world)
    expect(second.result.current.content).toBe("legacy text")
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent(""), content: "legacy text" })
    expect(storedLegacy(world.storage)).toBeNull()
  })

  it("S-14b: text under the legacy key that looks like a v1 envelope is only text", async () => {
    world = makeWorld({ [A]: { title: null, content: "" } })
    const lookalike = v1("5:abc", "inner")
    world.storage.map.set(legacyDraftKey(A), lookalike)
    const { result } = await openLoader(world)
    expect(result.current.content).toBe(lookalike)
    expect(draftOf(world.storage)?.content).toBe(lookalike)
  })
})
