// @vitest-environment jsdom
// @ts-nocheck -- see wip/P7S1-loader-race-diagnostic.test.tsx; this file is type-clean once P7S1T1 installs the test packages.
/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-draft-spike.test.tsx
MIME: text/typescript
Type: TypeScript React test (research spike, not part of the suite)

Created: 20/10/2026 12:50 GMT+10
Last modified: 20/10/2026 16:12 GMT+10
---------------
Proves the draft protocol of wip/P7S1-draft-spike.ts together with the loader spike (wip/P7S1-loader-spike.ts): the pure
helpers, scenarios S-1 to S-14b (PRPs/docs/P7S1-task-briefs-client.md#draft-scenarios), and an invariant over a seeded
random walk. A "reload" is an unmount followed by a new mount against the same fake server and the same storage. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-draft-spike.test.tsx

Changelog:
20/10/2026 16:12 GMT+10 | The header points at the scenario table in the client briefs, which holds S-1 to S-14b
20/10/2026 15:45 GMT+10 | S-7e and S-8e (a refused write keeps the stored value); stashConflict reports whether it stored
20/10/2026 14:09 GMT+10 | The fakes moved to wip/P7S1-test-fakes.ts and the file is typed: no type error with the test packages installed
20/10/2026 13:20 GMT+10 | Tests for the v1 key, the legacy key, the kept conflict and its action, viewState, saveStatus and needsAutoSave with the document
20/10/2026 13:03 GMT+10 | Scenarios for the legacy rule, S-10b, S-11b and ownership across a switch
20/10/2026 12:50 GMT+10 | Created
*/

import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, type RenderHookResult } from "@testing-library/react"
import { toast } from "sonner"
import {
  clearDraft,
  conflictKey,
  discardRead,
  draftKey,
  getBrowserStorage,
  hashContent,
  legacyDraftKey,
  needsAutoSave,
  parseDraft,
  readDraft,
  readRaw,
  removeIfUnchanged,
  resolveDraft,
  sameFields,
  saveStatus,
  stashConflict,
  type ReadDraft,
  REQUEST_TIMED_OUT,
  REQUEST_TIMEOUT_MS,
  useDraftSync,
  viewState,
  withTimeout,
  writeDraft,
  type DraftStorage,
} from "./P7S1-draft-spike"
import {
  CONFLICT_ACTION,
  CONFLICT_TOAST,
  RESTORED_TOAST,
  clearDocumentCache,
  setDocumentCacheEntry,
  useDocumentLoader,
  type DocumentLoader,
  type DocumentLoaderIo,
} from "./P7S1-loader-spike"
import { A, B, NOW, makeBrokenStorage, makeStorage, makeWorld, promptRow, type World } from "./P7S1-test-fakes"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(() => "conflict-toast"), success: vi.fn(), dismiss: vi.fn() },
}))

interface EditorProps {
  promptId: string
  io: DocumentLoaderIo
}

/** The options the first conflict toast was shown with: the loader gives it one action, "Restore my text". */
function conflictToast(): { duration: number; action: { label: string; onClick(): void } } {
  return vi.mocked(toast.warning).mock.calls[0][1] as unknown as ReturnType<typeof conflictToast>
}

/** What EditorPane composes: the loader plus the only draft writer. */
function useEditor({ promptId, io }: EditorProps) {
  const loader = useDocumentLoader({ promptId, io })
  useDraftSync({
    promptId,
    ready: loader.ready,
    content: loader.content,
    synced: loader.synced,
    getStorage: io.getStorage,
  })
  return loader
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

type Hook = RenderHookResult<DocumentLoader, EditorProps>

async function open(world: World<DraftStorage | null>, promptId = A, options: { wrapper?: typeof StrictMode } = {}): Promise<Hook> {
  const hook = renderHook((props: EditorProps) => useEditor(props), { initialProps: { promptId, io: world.io }, ...options })
  await settle()
  return hook
}

const type = (hook: Hook, text: string) =>
  act(() => {
    hook.result.current.setContent(text)
  })

/** The autosave's success path: the server now holds what was sent, and the editor learns it through markSynced. */
function autosaveSucceeds(world: Pick<World<DraftStorage | null>, "server">, hook: Hook): boolean {
  const { title, content, synced } = hook.result.current
  if (!synced) throw new Error("the document has no baseline")
  world.server.set(synced.promptId, { title, content })
  let accepted = false
  act(() => {
    accepted = hook.result.current.markSynced({ promptId: synced.promptId, title, content })
  })
  return accepted
}

const stored = (world: World, id = A) => world.storage.getItem(draftKey(id))
const storedLegacy = (world: World, id = A) => world.storage.getItem(legacyDraftKey(id))
const storedConflict = (world: World, id = A) => world.storage.getItem(conflictKey(id))
const draftOf = (world: World, id = A) => JSON.parse(stored(world, id) as string)
const v1 = (base: string, content: string) => JSON.stringify({ v: 1, base, content })

beforeEach(() => {
  vi.clearAllMocks()
  clearDocumentCache()
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe("hashContent", () => {
  it("is deterministic and starts with the length", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"))
    expect(hashContent("hello").startsWith("5:")).toBe(true)
    expect(hashContent("").startsWith("0:")).toBe(true)
  })

  it("differs for one changed character and for a different length", () => {
    expect(hashContent("hello")).not.toBe(hashContent("hellp"))
    expect(hashContent("hello")).not.toBe(hashContent("hello "))
  })

  it("has no collision across 10,000 distinct strings", () => {
    const seen = new Set()
    for (let i = 0; i < 10000; i++) seen.add(hashContent(`prompt number ${i} ${"x".repeat(i % 50)}`))
    expect(seen.size).toBe(10000)
  })
})

describe("parseDraft", () => {
  it("reads a v1 envelope, including an empty content", () => {
    expect(parseDraft(v1("5:abc", "text"))).toEqual({ content: "text", base: "5:abc" })
    expect(parseDraft(v1("0:0", ""))).toEqual({ content: "", base: "0:0" })
  })

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["a plain string", "just some text"],
    ["another version", JSON.stringify({ v: 2, base: "x", content: "c" })],
    ["an empty base", JSON.stringify({ v: 1, base: "", content: "c" })],
    ["a non-string content", JSON.stringify({ v: 1, base: "x", content: 5 })],
    ["malformed JSON", '{"v":1,"base":"x"'],
    ["valid JSON that is not a draft", '{"foo":1}'],
    ["a JSON array", "[1,2]"],
    ["a JSON string", '"quoted"'],
    ["JSON null", "null"],
  ])("returns null for %s: only a v1 envelope is a draft", (_name, raw) => {
    expect(parseDraft(raw)).toBeNull()
  })
})

describe("readDraft", () => {
  it("reads the v1 envelope from its own key", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("5:abc", "text") })
    expect(readDraft(storage, A)).toEqual({ draft: { content: "text", base: "5:abc" }, raw: v1("5:abc", "text"), legacy: false })
  })

  it("falls back to the raw text of the removed hook, which has no base", () => {
    const storage = makeStorage({ [legacyDraftKey(A)]: "old text" })
    expect(readDraft(storage, A)).toEqual({ draft: { content: "old text", base: null }, raw: "old text", legacy: true })
  })

  it("prefers the v1 envelope when both keys exist", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("5:abc", "new"), [legacyDraftKey(A)]: "old" })
    expect(readDraft(storage, A)?.draft.content).toBe("new")
  })

  it("ignores an empty legacy value and an unreadable v1 value", () => {
    expect(readDraft(makeStorage({ [legacyDraftKey(A)]: "" }), A)).toBeNull()
    expect(readDraft(makeStorage({ [draftKey(A)]: JSON.stringify({ v: 2, base: "x", content: "c" }) }), A)).toBeNull()
  })

  it("treats text that looks like a v1 envelope under the legacy key as text", () => {
    const lookalike = v1("5:abc", "inner")
    const storage = makeStorage({ [legacyDraftKey(A)]: lookalike })
    expect(readDraft(storage, A)).toEqual({ draft: { content: lookalike, base: null }, raw: lookalike, legacy: true })
  })

  it("never throws: a null storage and a blocked storage read as no draft", () => {
    expect(readDraft(null, A)).toBeNull()
    expect(readDraft(makeBrokenStorage(), A)).toBeNull()
    expect(readRaw(makeBrokenStorage(), "k")).toBeNull()
  })
})

describe("resolveDraft", () => {
  const text = "server text"
  const base = hashContent(text)
  const saved = { title: "Title", content: text }
  const unsaved = { title: null, content: text }

  it("returns none without a draft and when the draft equals the server content", () => {
    expect(resolveDraft(saved, null)).toEqual({ kind: "none" })
    expect(resolveDraft(saved, { content: text, base })).toEqual({ kind: "none" })
    expect(resolveDraft(saved, { content: text, base: null })).toEqual({ kind: "none" })
    expect(resolveDraft(saved, { content: text, base: "9:other" })).toEqual({ kind: "none" })
  })

  it("applies a legacy draft only to a document that was never saved (blank title)", () => {
    for (const title of [null, "", "  "]) {
      expect(resolveDraft({ title, content: text }, { content: "legacy", base: null })).toEqual({ kind: "apply", content: "legacy" })
    }
  })

  it("reports a conflict for a legacy draft that differs from a saved document: it is usually older than the server", () => {
    expect(resolveDraft(saved, { content: "legacy", base: null })).toEqual({ kind: "conflict" })
  })

  it("applies a v1 draft whose base is the hash of the server content, including an empty draft", () => {
    expect(resolveDraft(saved, { content: "local", base })).toEqual({ kind: "apply", content: "local" })
    expect(resolveDraft(saved, { content: "", base })).toEqual({ kind: "apply", content: "" })
    expect(resolveDraft(unsaved, { content: "local", base })).toEqual({ kind: "apply", content: "local" })
  })

  it("reports a conflict for a v1 draft whose base is another server content, whatever the title", () => {
    const stale = { content: "local", base: hashContent("older") }
    expect(resolveDraft(saved, stale)).toEqual({ kind: "conflict" })
    expect(resolveDraft(unsaved, stale)).toEqual({ kind: "conflict" })
  })
})

describe("writeDraft, clearDraft, removeIfUnchanged, stashConflict and discardRead", () => {
  it("writeDraft stores the envelope under the v1 key and returns the raw value written", () => {
    const storage = makeStorage()
    const raw = writeDraft(storage, A, { content: "text", base: "4:x" })
    expect(raw).toBe(v1("4:x", "text"))
    expect(storage.getItem(draftKey(A))).toBe(raw)
    expect(storage.getItem(legacyDraftKey(A))).toBeNull()
  })

  it("never throws: a null storage, a blocked storage and a refused write all degrade to null", () => {
    const refusing = makeStorage()
    refusing.refuseWrites = true
    expect(writeDraft(null, A, { content: "t", base: "b" })).toBeNull()
    expect(writeDraft(makeBrokenStorage(), A, { content: "t", base: "b" })).toBeNull()
    expect(writeDraft(refusing, A, { content: "t", base: "b" })).toBeNull()
    expect(() => clearDraft(null, A, "x")).not.toThrow()
    expect(() => clearDraft(makeBrokenStorage(), A, "x")).not.toThrow()
    expect(stashConflict(refusing, A, "text")).toBe(false)
    expect(stashConflict(null, A, "text")).toBe(false)
    expect(stashConflict(makeBrokenStorage(), A, "text")).toBe(false)
  })

  it("removeIfUnchanged removes the key only while it still holds the given raw value", () => {
    const storage = makeStorage({ k: "mine" })
    removeIfUnchanged(storage, "k", "someone else's")
    expect(storage.getItem("k")).toBe("mine")
    removeIfUnchanged(storage, "k", "mine")
    expect(storage.getItem("k")).toBeNull()
  })

  it("clearDraft with no ownership leaves an existing draft alone", () => {
    const storage = makeStorage({ [draftKey(A)]: "theirs" })
    clearDraft(storage, A, null)
    expect(storage.getItem(draftKey(A))).toBe("theirs")
  })

  it("stashConflict keeps the text in its own slot, one per document, and reports that it did", () => {
    const storage = makeStorage()
    expect(stashConflict(storage, A, "first")).toBe(true)
    expect(stashConflict(storage, A, "second")).toBe(true)
    expect(storage.getItem(conflictKey(A))).toBe("second")
    expect(conflictKey(A).startsWith("prompt-")).toBe(true)
  })

  it("discardRead removes the key the draft was read from, and only while unchanged", () => {
    const storage = makeStorage({ [draftKey(A)]: v1("1:a", "x"), [legacyDraftKey(B)]: "old" })
    const read = (raw: string, legacy: boolean): ReadDraft => ({ draft: { content: "", base: null }, raw, legacy })
    discardRead(storage, A, read("different", false))
    expect(storage.getItem(draftKey(A))).not.toBeNull()
    discardRead(storage, A, read(v1("1:a", "x"), false))
    expect(storage.getItem(draftKey(A))).toBeNull()
    discardRead(storage, B, read("old", true))
    expect(storage.getItem(legacyDraftKey(B))).toBeNull()
  })
})

describe("getBrowserStorage", () => {
  it("returns window.localStorage", () => {
    expect(getBrowserStorage()).toBe(window.localStorage)
  })

  it("returns null when reading the property throws", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked")
      },
    })
    try {
      expect(getBrowserStorage()).toBeNull()
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original)
    }
  })
})

describe("sameFields, needsAutoSave, viewState and saveStatus", () => {
  const synced = { promptId: A, title: "T", content: "c" }

  it("sameFields treats a null title and an empty title as the same", () => {
    expect(sameFields({ title: null, content: "c" }, { title: "", content: "c" })).toBe(true)
    expect(sameFields({ title: "T", content: "c" }, { title: "U", content: "c" })).toBe(false)
  })

  it.each([
    ["no baseline", A, { title: "T", content: "d" }, null, false],
    ["equal fields", A, { title: "T", content: "c" }, synced, false],
    ["changed content", A, { title: "T", content: "d" }, synced, true],
    ["changed title", A, { title: "U", content: "c" }, synced, true],
    ["a null title", A, { title: null, content: "d" }, synced, false],
    ["a whitespace title", A, { title: "   ", content: "d" }, synced, false],
    ["a baseline for another document", B, { title: "T", content: "d" }, synced, false],
  ])("needsAutoSave with %s is %s", (_name, promptId, working, baseline, expected) => {
    expect(needsAutoSave(promptId, working, baseline)).toBe(expected)
  })

  it.each([
    ["no document", { promptId: "", error: "", loading: false, ready: false }, "empty"],
    ["a failed load, which is neither loading nor ready", { promptId: A, error: "x", loading: false, ready: false }, "error"],
    ["an error while loading", { promptId: A, error: "x", loading: true, ready: false }, "error"],
    ["loading", { promptId: A, error: "", loading: true, ready: false }, "loading"],
    ["not loading but not ready: the render where the document just changed", { promptId: A, error: "", loading: false, ready: false }, "loading"],
    ["ready", { promptId: A, error: "", loading: false, ready: true }, "editor"],
  ])("viewState for %s is %s", (_name, state, expected) => {
    expect(viewState(state)).toBe(expected)
  })

  it.each([
    ["autosaving", true, { title: "T", content: "d" }, synced, "saving"],
    ["no baseline", false, { title: "T", content: "c" }, null, "unsaved"],
    ["equal to the baseline", false, { title: "T", content: "c" }, synced, "saved"],
    ["a draft applied over the baseline", false, { title: "T", content: "d" }, synced, "unsaved"],
    ["a title typed over a null title", false, { title: "T", content: "c" }, { ...synced, title: null }, "unsaved"],
  ])("saveStatus while %s is %s", (_name, autoSaving, working, baseline, expected) => {
    expect(saveStatus({ autoSaving, working, synced: baseline })).toBe(expected)
  })
})

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves with the value and leaves no timer behind", async () => {
    vi.useFakeTimers()
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("passes a rejection through and leaves no timer behind", async () => {
    vi.useFakeTimers()
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000)).rejects.toThrow("boom")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects when the promise has not settled within the limit, and ignores a late result", async () => {
    vi.useFakeTimers()
    let settle = (_value: string) => {}
    const slow = new Promise<string>((resolve) => {
      settle = resolve
    })
    const limited = withTimeout(slow, 1000)
    const outcome = expect(limited).rejects.toThrow(REQUEST_TIMED_OUT)
    await vi.advanceTimersByTimeAsync(999)
    await vi.advanceTimersByTimeAsync(1)
    await outcome
    settle("late")
    await Promise.resolve()
  })

  it("defaults to 30 seconds", async () => {
    vi.useFakeTimers()
    const limited = withTimeout(new Promise(() => {}))
    const outcome = expect(limited).rejects.toThrow(REQUEST_TIMED_OUT)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await outcome
    expect(REQUEST_TIMEOUT_MS).toBe(30000)
  })
})

describe("draft protocol scenarios", () => {
  let world: World

  beforeEach(() => {
    world = makeWorld({ [A]: { title: "Title", content: "server" } })
  })

  it("opening an unmodified document writes nothing", async () => {
    await open(world)
    expect(world.storage.sets).toHaveLength(0)
    expect(stored(world)).toBeNull()
  })

  it("S-1: typing writes a v1 draft against the server content; a successful autosave removes it", async () => {
    const hook = await open(world)
    type(hook, "typed")
    expect(draftOf(world)).toEqual({ v: 1, base: hashContent("server"), content: "typed" })
    expect(autosaveSucceeds(world, hook)).toBe(true)
    expect(stored(world)).toBeNull()
  })

  it("S-2: after a failed autosave the next open applies the draft with a toast and keeps the server as baseline", async () => {
    const first = await open(world)
    type(first, "typed")
    first.unmount()

    const second = await open(world)
    expect(second.result.current.content).toBe("typed")
    expect(second.result.current.synced?.content).toBe("server")
    expect(toast.info).toHaveBeenCalledWith(RESTORED_TOAST)
    expect(needsAutoSave(A, second.result.current, second.result.current.synced)).toBe(true)

    autosaveSucceeds(world, second)
    expect(stored(world)).toBeNull()
  })

  it("S-3: clearing to empty with a successful autosave leaves no draft and no toast on reload", async () => {
    const first = await open(world)
    type(first, "")
    expect(draftOf(world)).toEqual({ v: 1, base: hashContent("server"), content: "" })
    autosaveSucceeds(world, first)
    expect(stored(world)).toBeNull()
    first.unmount()

    const second = await open(world)
    expect(second.result.current.content).toBe("")
    expect(toast.info).not.toHaveBeenCalled()
    expect(stored(world)).toBeNull()
  })

  it("S-4: clearing to empty with a failed autosave applies the empty draft on reload", async () => {
    const first = await open(world)
    type(first, "")
    first.unmount()

    const second = await open(world)
    expect(second.result.current.content).toBe("")
    expect(second.result.current.synced?.content).toBe("server")
    expect(toast.info).toHaveBeenCalledWith(RESTORED_TOAST)
    expect(draftOf(world)).toEqual({ v: 1, base: hashContent("server"), content: "" })
  })

  it("S-5: an untitled document keeps its typed text through a reload and is never autosaved", async () => {
    world = makeWorld({ [A]: { title: null, content: "server" } })
    const first = await open(world)
    type(first, "typed")
    first.unmount()

    const second = await open(world)
    expect(second.result.current.content).toBe("typed")
    expect(second.result.current.title).toBeNull()
    expect(needsAutoSave(A, second.result.current, second.result.current.synced)).toBe(false)
    expect(draftOf(world).content).toBe("typed")
  })

  it("S-6: a rename from the list does not invalidate the draft", async () => {
    world = makeWorld({ [A]: { title: null, content: "server" } })
    const first = await open(world)
    type(first, "typed")
    first.unmount()
    world.server.set(A, { title: "Renamed", content: "server" })

    const second = await open(world)
    expect(second.result.current.content).toBe("typed")
    expect(second.result.current.title).toBe("Renamed")
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("S-7a: a legacy raw draft for a document that was never saved is its only copy: applied, migrated to v1", async () => {
    world = makeWorld({ [A]: { title: null, content: "" } })
    world.storage.map.set(legacyDraftKey(A), "legacy text")
    const hook = await open(world)
    expect(hook.result.current.content).toBe("legacy text")
    expect(toast.info).toHaveBeenCalledWith(RESTORED_TOAST)
    expect(draftOf(world)).toEqual({ v: 1, base: hashContent(""), content: "legacy text" })
    expect(storedLegacy(world)).toBeNull()
  })

  it("S-7b: a legacy raw draft that differs from a saved document is not applied: the server wins, the text is kept", async () => {
    world.storage.map.set(legacyDraftKey(A), "stale legacy text")
    const hook = await open(world)
    expect(hook.result.current.content).toBe("server")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(toast.info).not.toHaveBeenCalled()
    expect(stored(world)).toBeNull()
    expect(storedLegacy(world)).toBeNull()
    expect(storedConflict(world)).toBe("stale legacy text")
    expect(needsAutoSave(A, hook.result.current, hook.result.current.synced)).toBe(false)
  })

  it("S-7e: a legacy raw draft stays in place while the v1 draft cannot be written, so its text is never the only loss", async () => {
    world = makeWorld({ [A]: { title: null, content: "" } })
    world.storage.map.set(legacyDraftKey(A), "legacy text")
    world.storage.refuseWrites = true
    const hook = await open(world)
    expect(hook.result.current.content).toBe("legacy text")
    expect(storedLegacy(world)).toBe("legacy text")
    expect(stored(world)).toBeNull()
  })

  it("S-7c: a legacy raw draft equal to the server content is removed without a toast; an empty one is ignored", async () => {
    world.storage.map.set(legacyDraftKey(A), "server")
    await open(world)
    expect(storedLegacy(world)).toBeNull()
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("S-7d: when both keys exist the v1 draft wins and the legacy value is left for the next migration", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("server"), "from v1"))
    world.storage.map.set(legacyDraftKey(A), "from legacy")
    const hook = await open(world)
    expect(hook.result.current.content).toBe("from v1")
    expect(storedLegacy(world)).toBe("from legacy")
  })

  it("S-8: a draft written against other server content loses to the server, with a warning, and its text is kept", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older server"), "stale local"))
    const hook = await open(world)
    expect(hook.result.current.content).toBe("server")
    expect(hook.result.current.synced?.content).toBe("server")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toBe(CONFLICT_TOAST)
    expect(toast.info).not.toHaveBeenCalled()
    expect(stored(world)).toBeNull()
    expect(storedConflict(world)).toBe("stale local")
  })

  it("S-8b: the conflict toast's action puts the kept text back, and the writer and autosave then treat it as an edit", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older server"), "stale local"))
    const hook = await open(world)
    const options = conflictToast()
    expect(options.action.label).toBe(CONFLICT_ACTION)

    act(() => options.action.onClick())
    expect(hook.result.current.content).toBe("stale local")
    expect(draftOf(world)).toEqual({ v: 1, base: hashContent("server"), content: "stale local" })
    expect(needsAutoSave(A, hook.result.current, hook.result.current.synced)).toBe(true)
  })

  it("S-8e: when the storage refuses the stash, the draft stays where it is and the toast still offers the text", async () => {
    const raw = v1(hashContent("older server"), "stale local")
    world.storage.map.set(draftKey(A), raw)
    world.storage.refuseWrites = true
    const hook = await open(world)
    expect(hook.result.current.content).toBe("server")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(storedConflict(world)).toBeNull()
    expect(stored(world)).toBe(raw)

    act(() => conflictToast().action.onClick())
    expect(hook.result.current.content).toBe("stale local")
  })

  it("S-8c: the conflict toast's action does nothing once another document is open", async () => {
    world = makeWorld({ [A]: { title: "A", content: "A server" }, [B]: { title: "B", content: "B server" } })
    world.storage.map.set(draftKey(A), v1(hashContent("older"), "stale local"))
    const hook = await open(world, A)
    const options = conflictToast()

    hook.rerender({ promptId: B, io: world.io })
    await settle()
    act(() => options.action.onClick())
    expect(hook.result.current.content).toBe("B server")
    expect(stored(world, B)).toBeNull()
  })

  it("S-8d: the conflict toast is dismissed when the document is left and when the editor unmounts", async () => {
    world = makeWorld({ [A]: { title: "A", content: "A server" }, [B]: { title: "B", content: "B server" } })
    world.storage.map.set(draftKey(A), v1(hashContent("older"), "stale local"))
    const hook = await open(world, A)
    expect(toast.dismiss).not.toHaveBeenCalled()

    hook.rerender({ promptId: B, io: world.io })
    await settle()
    expect(toast.dismiss).toHaveBeenCalledWith("conflict-toast")

    vi.mocked(toast.dismiss).mockClear()
    world.storage.map.set(draftKey(B), v1(hashContent("older"), "stale B"))
    hook.unmount()
    const again = await open(world, B)
    again.unmount()
    expect(toast.dismiss).toHaveBeenCalledWith("conflict-toast")
  })

  it("S-9: a draft equal to the server content is removed without a toast, in v1 and in legacy form", async () => {
    world.storage.map.set(draftKey(A), v1(hashContent("older"), "server"))
    const first = await open(world)
    expect(first.result.current.content).toBe("server")
    expect(stored(world)).toBeNull()
    first.unmount()

    world.storage.map.set(legacyDraftKey(A), "server")
    const second = await open(world)
    expect(second.result.current.content).toBe("server")
    expect(storedLegacy(world)).toBeNull()
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("S-10: an autosave that committed with a lost response leaves a draft equal to the server: no toast", async () => {
    const first = await open(world)
    type(first, "typed")
    first.unmount()
    world.server.set(A, { title: "Title", content: "typed" })

    const second = await open(world)
    expect(second.result.current.content).toBe("typed")
    expect(second.result.current.synced?.content).toBe("typed")
    expect(toast.info).not.toHaveBeenCalled()
    expect(stored(world)).toBeNull()
  })

  it("S-10b: typing after a lost autosave response is a conflict on reload; the text is kept and offered, not deleted", async () => {
    const first = await open(world)
    type(first, "one")
    world.server.set(A, { title: "Title", content: "one" })
    type(first, "one two")
    first.unmount()

    const second = await open(world)
    expect(second.result.current.content).toBe("one")
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(storedConflict(world)).toBe("one two")
    act(() => conflictToast().action.onClick())
    expect(second.result.current.content).toBe("one two")
  })

  it("S-11: two tabs share one key; a tab removes only the value it wrote", async () => {
    const tab1 = await open(world)
    const tab2 = await open(world)
    type(tab1, "one")
    type(tab2, "two")
    expect(draftOf(world).content).toBe("two")

    autosaveSucceeds(world, tab1)
    expect(draftOf(world).content).toBe("two")

    autosaveSucceeds(world, tab2)
    expect(stored(world)).toBeNull()
  })

  it("S-11b: opening a document from the cache never removes another tab's draft for it", async () => {
    world = makeWorld({
      [A]: { title: "Title", content: "server" },
      [B]: { title: "B", content: "B server" },
    })
    const other = await open(world, A)
    type(other, "two")
    const theirs = stored(world)

    setDocumentCacheEntry("user-1", A, {
      promptData: promptRow(A, { title: "Title", content: "server" }),
      title: "Title",
      content: "server",
      lastSaved: NOW,
      synced: { promptId: A, title: "Title", content: "server" },
    })
    const mine = await open(world, B)
    mine.rerender({ promptId: A, io: world.io })
    await settle()
    expect(mine.result.current.content).toBe("server")
    expect(mine.result.current.ready).toBe(true)
    expect(stored(world)).toBe(theirs)
  })

  it("a draft this tab wrote is cleared when the document is reopened after an autosave completed elsewhere", async () => {
    world = makeWorld({
      [A]: { title: "A", content: "A server" },
      [B]: { title: "B", content: "B server" },
    })
    const hook = await open(world, A)
    type(hook, "A typed")
    setDocumentCacheEntry("user-1", A, {
      promptData: promptRow(A, { title: "A", content: "A server" }),
      title: "A",
      content: "A typed",
      lastSaved: NOW,
      synced: { promptId: A, title: "A", content: "A server" },
    })
    hook.rerender({ promptId: B, io: world.io })
    await settle()

    world.server.set(A, { title: "A", content: "A typed" })
    let accepted
    act(() => {
      accepted = hook.result.current.markSynced({ promptId: A, title: "A", content: "A typed" })
    })
    expect(accepted).toBe(false)
    expect(draftOf(world, A).content).toBe("A typed")

    hook.rerender({ promptId: A, io: world.io })
    await settle()
    expect(hook.result.current.content).toBe("A typed")
    expect(stored(world, A)).toBeNull()
  })

  it("S-12: restore replaces the working copy and the baseline and removes the draft", async () => {
    const hook = await open(world)
    type(hook, "typed")
    expect(stored(world)).not.toBeNull()

    act(() => {
      hook.result.current.applyServerState(A, { title: "Old title", content: "restored" })
    })
    expect(hook.result.current.content).toBe("restored")
    expect(hook.result.current.synced).toEqual({ promptId: A, title: "Old title", content: "restored" })
    expect(stored(world)).toBeNull()
  })

  it("S-13: a storage that throws on every call, or no storage at all, leaves the editor working without drafts", async () => {
    for (const storage of [makeBrokenStorage(), null]) {
      const unsafe = makeWorld({ [A]: { title: "Title", content: "server" } }, storage)
      const hook = await open(unsafe)
      expect(hook.result.current.content).toBe("server")
      type(hook, "typed")
      expect(hook.result.current.content).toBe("typed")
      expect(autosaveSucceeds(unsafe, hook)).toBe(true)
      expect(hook.result.current.synced?.content).toBe("typed")
      hook.unmount()
    }
  })

  it("S-14: a value under the v1 key that is not a v1 envelope is left alone and never applied", async () => {
    world.storage.map.set(draftKey(A), JSON.stringify({ v: 2, base: "x", content: "from the future" }))
    const hook = await open(world)
    expect(hook.result.current.content).toBe("server")
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    expect(JSON.parse(stored(world) as string).v).toBe(2)
  })

  it("S-14b: text under the legacy key that looks like an envelope is only text", async () => {
    world = makeWorld({ [A]: { title: null, content: "" } })
    const lookalike = v1("5:abc", "inner")
    world.storage.map.set(legacyDraftKey(A), lookalike)
    const hook = await open(world)
    expect(hook.result.current.content).toBe(lookalike)
  })

  it("typing while an autosave request is in flight keeps a draft against the new baseline", async () => {
    const first = await open(world)
    type(first, "one")
    const sent = first.result.current.content
    type(first, "one two")
    world.server.set(A, { title: "Title", content: sent })
    act(() => {
      first.result.current.markSynced({ promptId: A, title: "Title", content: sent })
    })
    expect(draftOf(world)).toEqual({ v: 1, base: hashContent("one"), content: "one two" })
    first.unmount()

    const second = await open(world)
    expect(second.result.current.content).toBe("one two")
    expect(second.result.current.synced?.content).toBe("one")
  })

  it("a refused write keeps ownership of the older draft, so the next clear still removes it", async () => {
    const hook = await open(world)
    type(hook, "a")
    const older = stored(world)
    world.storage.refuseWrites = true
    type(hook, "ab")
    expect(stored(world)).toBe(older)
    world.storage.refuseWrites = false

    autosaveSucceeds(world, hook)
    expect(stored(world)).toBeNull()
  })

  it("switching documents never writes one document's text under another's key", async () => {
    world = makeWorld({
      [A]: { title: "A", content: "A server" },
      [B]: { title: "B", content: "B server" },
    })
    const hook = await open(world, A)
    type(hook, "A typed")

    hook.rerender({ promptId: B, io: world.io })
    await settle()
    expect(hook.result.current.content).toBe("B server")
    expect(world.storage.sets.filter((s) => s.key === draftKey(B))).toHaveLength(0)
    expect(stored(world, B)).toBeNull()
    expect(draftOf(world, A).content).toBe("A typed")

    hook.rerender({ promptId: A, io: world.io })
    await settle()
    expect(hook.result.current.content).toBe("A typed")
    expect(hook.result.current.synced?.content).toBe("A server")
  })

  it("works under React Strict Mode", async () => {
    const hook = await open(world, A, { wrapper: StrictMode })
    type(hook, "typed")
    expect(draftOf(world).content).toBe("typed")
    autosaveSucceeds(world, hook)
    expect(stored(world)).toBeNull()
  })

  it("works against the real window.localStorage", async () => {
    const real = makeWorld({ [A]: { title: "Title", content: "server" } }, window.localStorage)
    const hook = await open(real)
    type(hook, "typed")
    expect(JSON.parse(window.localStorage.getItem(draftKey(A)) as string).content).toBe("typed")
    autosaveSucceeds(real, hook)
    expect(window.localStorage.getItem(draftKey(A))).toBeNull()
  })
})

describe("invariant over a seeded random walk", () => {
  function mulberry32(seed: number) {
    let a = seed
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function expectInvariant(world: World, hook: Hook) {
    const { ready, content, synced } = hook.result.current
    if (!ready || !synced) return
    const raw = world.storage.getItem(draftKey(synced.promptId))
    if (content === synced.content) {
      expect(raw).toBeNull()
    } else {
      expect(JSON.parse(raw as string)).toEqual({ v: 1, base: hashContent(synced.content), content })
    }
  }

  it.each([1, 2, 3])("seed %i: a draft exists exactly while the working copy differs from the baseline", async (seed) => {
    const rand = mulberry32(seed)
    const world = makeWorld({ [A]: { title: "Title", content: "server" } })
    let hook = await open(world)
    const texts = ["", "a", "ab", "abc", "server", "line one\nline two", '{"v":1}']

    for (let step = 0; step < 150; step++) {
      const op = Math.floor(rand() * 5)
      if (op === 0 || op === 1) {
        type(hook, texts[Math.floor(rand() * texts.length)])
      } else if (op === 2) {
        autosaveSucceeds(world, hook)
      } else if (op === 3) {
        act(() => {
          hook.result.current.applyServerState(A, { title: "Title", content: texts[Math.floor(rand() * texts.length)] })
        })
        world.server.set(A, { title: "Title", content: hook.result.current.content })
      } else {
        hook.unmount()
        hook = await open(world)
      }
      expectInvariant(world, hook)
    }
    hook.unmount()
  })
})
