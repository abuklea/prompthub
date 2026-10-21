// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDraftSync.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 09:36 GMT+10
Last modified: 22/10/2026 09:36 GMT+10
---------------
The only draft writer (contract: Draft Protocol, issue #34), mostly composed with the real loader as EditorPane composes
them: while the document is ready a v1 draft exists exactly while the working content differs from the baseline, it is
gone once an autosave or a restore catches the baseline up (S-1, S-3, S-12), a tab removes only the values it wrote
(S-11, S-11b), ownership survives a document switch, a refused write keeps ownership of the older draft, a broken or
missing storage leaves the editor working (S-13), and no document's text is written under another document's key.
Assertions read the storage itself.

Changelog:
22/10/2026 09:36 GMT+10 | Created: the draft writer cases (P7S1T6 step 1)
*/

import { StrictMode } from "react"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearDocumentCache, setDocumentCacheEntry } from "@/features/editor/document-cache"
import { draftKey, hashContent, type DraftStorage } from "@/features/editor/draft"
import type { SyncedState } from "@/features/editor/sync"
import { A, B, USER_ID, cacheEntryFor, makeWorld, type World } from "@/test/loader-world"
import { makeBrokenStorage, makeStorage } from "@/test/storage-fake"
import { autosaveSucceeds, conflictToast, draftOf, openEditor, settle, stored, typeText, v1 } from "@/test/draft-world"
import { useDraftSync, type UseDraftSyncArgs } from "./useDraftSync"

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn(() => "conflict-toast"), dismiss: vi.fn() },
}))

let world: World

beforeEach(() => {
  clearDocumentCache()
  localStorage.clear()
  vi.clearAllMocks()
  world = makeWorld({ [A]: { title: "Title", content: "server" } })
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())

/** A world with two titled documents. */
const twoDocuments = (): World =>
  makeWorld({ [A]: { title: "A", content: "A server" }, [B]: { title: "B", content: "B server" } })

describe("useDraftSync with the loader", () => {
  it("opening an unmodified document writes nothing", async () => {
    await openEditor(world)
    expect(world.storage.sets).toEqual([])
    expect(stored(world.storage)).toBeNull()
  })

  it("S-1: typing writes a v1 draft against the server content; a successful autosave removes it", async () => {
    const hook = await openEditor(world)
    typeText(hook, "typed")
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent("server"), content: "typed" })
    expect(autosaveSucceeds(world, hook)).toBe(true)
    expect(stored(world.storage)).toBeNull()
  })

  it("S-3: clearing to empty is a draft until the autosave succeeds; the reload shows the empty document", async () => {
    const first = await openEditor(world)
    typeText(first, "")
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent("server"), content: "" })
    autosaveSucceeds(world, first)
    expect(stored(world.storage)).toBeNull()
    first.unmount()

    const second = await openEditor(world)
    expect(second.result.current.content).toBe("")
    expect(stored(world.storage)).toBeNull()
  })

  it("typing while an autosave request is in flight keeps a draft against the new baseline", async () => {
    const hook = await openEditor(world)
    typeText(hook, "one")
    typeText(hook, "one two")
    world.server.set(A, { title: "Title", content: "one" })
    act(() => {
      hook.result.current.markSynced({ promptId: A, title: "Title", content: "one" })
    })
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent("one"), content: "one two" })
  })

  it("S-8b: the text the conflict toast restores is written as a v1 draft against the server content", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older server"), "stale local"))
    const hook = await openEditor(world)
    act(() => conflictToast().action.onClick())
    expect(hook.result.current.content).toBe("stale local")
    expect(draftOf(world.storage)).toEqual({ v: 1, base: hashContent("server"), content: "stale local" })
  })

  it("S-11: two tabs share one key; a tab removes only the value it wrote", async () => {
    const tab1 = await openEditor(world)
    const tab2 = await openEditor(world)
    typeText(tab1, "one")
    typeText(tab2, "two")
    expect(draftOf(world.storage)?.content).toBe("two")

    autosaveSucceeds(world, tab1)
    expect(draftOf(world.storage)?.content).toBe("two")

    autosaveSucceeds(world, tab2)
    expect(stored(world.storage)).toBeNull()
  })

  it("S-11b: opening a document from the cache never removes another tab's draft for it", async () => {
    world = twoDocuments()
    const other = await openEditor(world, A)
    typeText(other, "theirs")
    const theirs = stored(world.storage)
    expect(theirs).not.toBeNull()

    setDocumentCacheEntry(USER_ID, A, cacheEntryFor(A, "A", "A server"))
    const mine = await openEditor(world, B)
    mine.rerender({ promptId: A, io: world.io })
    await settle()
    expect(mine.result.current.content).toBe("A server")
    expect(mine.result.current.ready).toBe(true)
    expect(stored(world.storage)).toBe(theirs)
  })

  it("S-12: a restore replaces the working copy and the baseline, and the draft goes", async () => {
    const hook = await openEditor(world)
    typeText(hook, "typed")
    expect(stored(world.storage)).not.toBeNull()

    act(() => {
      hook.result.current.applyServerState(A, { title: "Old title", content: "restored" })
    })
    expect(hook.result.current.content).toBe("restored")
    expect(hook.result.current.synced).toEqual({ promptId: A, title: "Old title", content: "restored" })
    expect(stored(world.storage)).toBeNull()
  })

  it.each<[string, DraftStorage | null]>([
    ["a storage that throws on every call", makeBrokenStorage()],
    ["no storage at all", null],
  ])("S-13: with %s the editor works without drafts", async (_name, storage) => {
    const unsafe = makeWorld({ [A]: { title: "Title", content: "server" } }, storage)
    const hook = await openEditor(unsafe)
    expect(hook.result.current.content).toBe("server")
    typeText(hook, "typed")
    expect(hook.result.current.content).toBe("typed")
    expect(autosaveSucceeds(unsafe, hook)).toBe(true)
    expect(hook.result.current.synced?.content).toBe("typed")
  })

  it("a refused write keeps ownership of the older draft, so the next clear still removes it", async () => {
    const hook = await openEditor(world)
    typeText(hook, "a")
    const older = stored(world.storage)
    expect(older).not.toBeNull()
    world.storage.refuseWrites = true
    typeText(hook, "ab")
    expect(stored(world.storage)).toBe(older)
    world.storage.refuseWrites = false

    autosaveSucceeds(world, hook)
    expect(stored(world.storage)).toBeNull()
  })

  it("ownership survives a switch: this tab's draft is cleared on return after its autosave completed", async () => {
    world = twoDocuments()
    const hook = await openEditor(world, A)
    typeText(hook, "A typed")
    setDocumentCacheEntry(USER_ID, A, { ...cacheEntryFor(A, "A", "A server"), content: "A typed" })
    hook.rerender({ promptId: B, io: world.io })
    await settle()

    world.server.set(A, { title: "A", content: "A typed" })
    let accepted = true
    act(() => {
      accepted = hook.result.current.markSynced({ promptId: A, title: "A", content: "A typed" })
    })
    expect(accepted).toBe(false)
    expect(draftOf(world.storage, A)?.content).toBe("A typed")

    hook.rerender({ promptId: A, io: world.io })
    await settle()
    expect(hook.result.current.content).toBe("A typed")
    expect(stored(world.storage, A)).toBeNull()
  })

  it("switching documents never writes one document's text under another's key", async () => {
    world = twoDocuments()
    const hook = await openEditor(world, A)
    typeText(hook, "A typed")

    hook.rerender({ promptId: B, io: world.io })
    await settle()
    expect(hook.result.current.content).toBe("B server")
    expect(world.storage.sets.filter((s) => s.key === draftKey(B))).toEqual([])
    expect(draftOf(world.storage, A)?.content).toBe("A typed")

    hook.rerender({ promptId: A, io: world.io })
    await settle()
    expect(hook.result.current.content).toBe("A typed")
    expect(hook.result.current.synced?.content).toBe("A server")
  })

  it("works under React Strict Mode", async () => {
    const hook = await openEditor(world, A, { wrapper: StrictMode })
    typeText(hook, "typed")
    expect(draftOf(world.storage)?.content).toBe("typed")
    autosaveSucceeds(world, hook)
    expect(stored(world.storage)).toBeNull()
  })

  it("works against the real window.localStorage", async () => {
    const real = makeWorld({ [A]: { title: "Title", content: "server" } }, window.localStorage)
    const hook = await openEditor(real)
    typeText(hook, "typed")
    expect(draftOf(window.localStorage)?.content).toBe("typed")
    autosaveSucceeds(real, hook)
    expect(window.localStorage.getItem(draftKey(A))).toBeNull()
  })
})

describe("useDraftSync alone", () => {
  const syncedA: SyncedState = { promptId: A, title: "A", content: "A server" }

  it("writes no key of another document in the render where the document just changed", () => {
    const storage = makeStorage()
    const getStorage = () => storage
    const args: UseDraftSyncArgs = { promptId: A, ready: true, content: "A typed", synced: syncedA, getStorage }
    const hook = renderHook((p: UseDraftSyncArgs) => useDraftSync(p), { initialProps: args })
    expect(draftOf(storage, A)).toEqual({ v: 1, base: hashContent("A server"), content: "A typed" })

    hook.rerender({ ...args, promptId: B, ready: false })
    expect(storage.sets.map((s) => s.key)).toEqual([draftKey(A)])
    expect(stored(storage, B)).toBeNull()
    expect(draftOf(storage, A)?.content).toBe("A typed")
  })

  it("writes nothing while the document is not ready or has no baseline", () => {
    const storage = makeStorage()
    const getStorage = () => storage
    const args: UseDraftSyncArgs = { promptId: A, ready: false, content: "typed", synced: syncedA, getStorage }
    const hook = renderHook((p: UseDraftSyncArgs) => useDraftSync(p), { initialProps: args })
    hook.rerender({ ...args, ready: true, synced: null })
    expect(storage.sets).toEqual([])
  })
})
