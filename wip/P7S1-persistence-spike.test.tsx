// @vitest-environment jsdom
// @ts-nocheck -- see wip/P7S1-loader-race-diagnostic.test.tsx; this file is type-clean once P7S1T1 installs the test packages.
/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-persistence-spike.test.tsx
MIME: text/typescript
Type: TypeScript React test (research spike, not part of the suite)

Created: 20/10/2026 13:16 GMT+10
Last modified: 20/10/2026 14:48 GMT+10
---------------
Proves the hooks of wip/P7S1-persistence-spike.ts over the real loader spike, the real draft writer, the real zustand
stores and a fake server with controllable latency and failures. The fake server records every request in call order, so
the tests assert what reached the server and in which order. Covers tasks T6 to T8: the autosave baseline, the manual save
and the set-title flow, the restore, completions that arrive after a document switch or an unmount, rejected actions and
React Strict Mode. Run with:
npx vitest run --config wip/P7S1-vitest.diag.config.ts wip/P7S1-persistence-spike.test.tsx

Changelog:
20/10/2026 14:48 GMT+10 | Two tests assert the requests the fake server received, not the version rows the fake derives from them
20/10/2026 14:23 GMT+10 | A test that withActionTimeout limits the history read too
20/10/2026 14:09 GMT+10 | The fakes moved to wip/P7S1-test-fakes.ts and the file is typed: no type error with the test packages installed
20/10/2026 13:56 GMT+10 | Tests for the request timeout, the single-flight restore, the blank-title refusal and a restore after a switch
20/10/2026 13:20 GMT+10 | Added the tests for a fake loader that is not ready and for the dirty flag of a document that is not open
20/10/2026 13:16 GMT+10 | Created
*/

import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook, type RenderHookResult } from "@testing-library/react"
import { toast } from "sonner"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import { draftKey, hashContent, REQUEST_TIMED_OUT, REQUEST_TIMEOUT_MS, saveStatus, type SyncedState } from "./P7S1-draft-spike"
import {
  clearDocumentCache,
  getCachedDocument,
  useDocumentLoader,
  type DocumentLoader,
  type DocumentLoaderIo,
} from "./P7S1-loader-spike"
import {
  AUTOSAVE_DELAY_MS,
  FLUSH_FAILED_TOAST,
  NEEDS_TITLE_TOAST,
  useAutoSave,
  useDocumentPersistence,
  useVersionRestore,
  useVersionSave,
  withActionTimeout,
  type DocumentActions,
  type UseAutoSaveOptions,
} from "./P7S1-persistence-spike"
import { A, B, NOW, listItem, makeEnv, type EditorEnv } from "./P7S1-test-fakes"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn() } }))

interface SessionProps {
  promptId: string
  tabId: string
  io: DocumentLoaderIo
  actions: DocumentActions
}

/** What EditorPane composes: the loader and the persistence hook. */
function useSession({ promptId, tabId, io, actions }: SessionProps) {
  const loader = useDocumentLoader({ promptId, io })
  const persistence = useDocumentPersistence({ promptId, tabId, loader, actions, getStorage: io.getStorage })
  return { loader, persistence }
}

async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

const settle = async () => {
  for (let i = 0; i < 3; i++) await tick(0)
}

type Hook = RenderHookResult<ReturnType<typeof useSession>, SessionProps>

interface OpenOptions {
  promptId?: string
  tabId?: string
  actions?: DocumentActions
  wrapper?: typeof StrictMode
}

async function open(env: EditorEnv, { promptId = A, tabId = "tab-A", actions = env.actions, wrapper }: OpenOptions = {}): Promise<Hook> {
  const hook = renderHook((props: SessionProps) => useSession(props), {
    initialProps: { promptId, tabId, io: env.io, actions },
    wrapper,
  })
  await settle()
  return hook
}

async function goTo(hook: Hook, env: EditorEnv, promptId: string, tabId: string, actions: DocumentActions = env.actions) {
  hook.rerender({ promptId, tabId, io: env.io, actions })
  await settle()
}

const loaderOf = (hook: Hook) => hook.result.current.loader
const persistenceOf = (hook: Hook) => hook.result.current.persistence

const type = (hook: Hook, text: string) =>
  act(() => {
    loaderOf(hook).setContent(text)
  })

const setTitle = (hook: Hook, title: string | null) =>
  act(() => {
    loaderOf(hook).setTitle(title)
  })

const pressCtrlS = (modifiers: KeyboardEventInit = { ctrlKey: true }) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", cancelable: true, ...modifiers }))
  })

const tabOf = (id: string) => useTabStore.getState().tabs.find((t) => t.id === id)
const draftOf = (env: EditorEnv, id = A) => JSON.parse(env.storage.getItem(draftKey(id)) as string)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  clearDocumentCache()
  window.localStorage.clear()
  useTabStore.setState({
    tabs: [
      { id: "tab-A", type: "document", title: "A", promptId: A, isPreview: true },
      { id: "tab-B", type: "document", title: "B", promptId: B },
    ],
    activeTabId: "tab-A",
  })
  useUiStore.setState({ promptRefetchTrigger: 0 })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ---- useAutoSave ----

describe("useAutoSave", () => {
  type Props = Omit<UseAutoSaveOptions, "onSave" | "delay">
  const baseline: SyncedState = { promptId: A, title: "T", content: "c" }
  const initial: Props = { promptId: A, title: "T", content: "c", baseline }

  function mount(props: Props = initial) {
    const calls: Array<{ id: string; title: string | null; content: string }> = []
    const hook = renderHook((p: Props) => useAutoSave({ onSave: (id, title, content) => calls.push({ id, title, content }), ...p }), {
      initialProps: props,
    })
    return { hook, calls }
  }

  it("writes nothing on mount or while the working copy equals the baseline (#35)", async () => {
    const { calls } = mount()
    await tick(5000)
    expect(calls).toEqual([])
  })

  it("writes once for a burst of edits, with the last text, after the delay", async () => {
    const { hook, calls } = mount()
    hook.rerender({ ...initial, content: "a" })
    await tick(200)
    hook.rerender({ ...initial, content: "ab" })
    await tick(200)
    hook.rerender({ ...initial, content: "abc" })
    await tick(AUTOSAVE_DELAY_MS - 1)
    expect(calls).toEqual([])
    await tick(1)
    expect(calls).toEqual([{ id: A, title: "T", content: "abc" }])
  })

  it("writes nothing for an edit reverted to the baseline", async () => {
    const { hook, calls } = mount()
    hook.rerender({ ...initial, content: "x" })
    await tick(300)
    hook.rerender(initial)
    await tick(2000)
    expect(calls).toEqual([])
  })

  it.each<[string, Partial<Props>]>([
    ["a null title", { title: null }],
    ["a whitespace title", { title: "   " }],
    ["no baseline", { baseline: null }],
    ["a baseline for another document", { baseline: { ...baseline, promptId: B } }],
    ["no document", { promptId: null }],
  ])("writes nothing with %s", async (_name, override) => {
    const { hook, calls } = mount()
    hook.rerender({ ...initial, content: "changed", ...override })
    await tick(2000)
    expect(calls).toEqual([])
  })

  it("a baseline that catches up cancels the pending write", async () => {
    const { hook, calls } = mount()
    hook.rerender({ ...initial, content: "x" })
    await tick(300)
    hook.rerender({ ...initial, content: "x", baseline: { ...baseline, content: "x" } })
    await tick(2000)
    expect(calls).toEqual([])
  })

  it("a promptId that becomes null cancels the pending write", async () => {
    const { hook, calls } = mount()
    hook.rerender({ ...initial, content: "x" })
    await tick(300)
    hook.rerender({ ...initial, content: "x", promptId: null })
    await tick(2000)
    expect(calls).toEqual([])
  })

  it("a new onSave identity each render neither resets the timer nor loses the latest callback", async () => {
    const seen: Array<{ who: string; content: string }> = []
    const hook = renderHook((p: Props & { who: string }) => useAutoSave({ ...p, onSave: (_id, _title, content) => seen.push({ who: p.who, content }) }), {
      initialProps: { ...initial, content: "x", who: "first" },
    })
    await tick(300)
    hook.rerender({ ...initial, content: "x", who: "second" })
    await tick(200)
    expect(seen).toEqual([{ who: "second", content: "x" }])
  })
})

// ---- autosave through the composed hooks ----

describe("autosave through the persistence hook", () => {
  let env: EditorEnv

  beforeEach(() => {
    env = makeEnv({ [A]: { title: "Title", content: "server" }, [B]: { title: "B title", content: "B server" } })
  })

  it("#35: opening a titled document writes nothing, even long after the delay", async () => {
    await open(env)
    await tick(5000)
    expect(env.names()).toEqual([])
  })

  it("S-1: an edit is autosaved once after the delay; the baseline advances, the draft goes, the footer reads saved", async () => {
    const hook = await open(env)
    type(hook, "typed")
    expect(draftOf(env)).toEqual({ v: 1, base: hashContent("server"), content: "typed" })
    expect(saveStatus({ autoSaving: false, working: loaderOf(hook), synced: loaderOf(hook).synced })).toBe("unsaved")

    await tick(AUTOSAVE_DELAY_MS - 1)
    expect(env.names()).toEqual([])
    await tick(1)
    await settle()
    expect(env.state.requests).toEqual([{ name: "autosave", input: { promptId: A, title: "Title", content: "typed" } }])
    expect(env.rows.get(A)?.content).toBe("typed")
    expect(loaderOf(hook).synced).toEqual({ promptId: A, title: "Title", content: "typed" })
    expect(env.storage.getItem(draftKey(A))).toBeNull()
    expect(persistenceOf(hook).autoSaving).toBe(false)
    expect(saveStatus({ autoSaving: false, working: loaderOf(hook), synced: loaderOf(hook).synced })).toBe("saved")
  })

  it("a burst of edits is one request", async () => {
    const hook = await open(env)
    type(hook, "a")
    await tick(100)
    type(hook, "ab")
    await tick(100)
    type(hook, "abc")
    await tick(2000)
    expect(env.names()).toEqual(["autosave"])
    expect(env.inputs("autosave")[0].content).toBe("abc")
  })

  it("a failed autosave keeps the draft, sets no baseline and is not retried", async () => {
    env.failNext("autosave")
    const hook = await open(env)
    type(hook, "typed")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    await tick(20000)
    expect(env.names()).toEqual(["autosave"])
    expect(loaderOf(hook).synced?.content).toBe("server")
    expect(draftOf(env).content).toBe("typed")
    expect(persistenceOf(hook).autoSaving).toBe(false)
  })

  it("a rejected autosave resets the saving flag, and the next edit is saved", async () => {
    env.failNext("autosave", "reject")
    const hook = await open(env)
    type(hook, "a")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(persistenceOf(hook).autoSaving).toBe(false)
    expect(env.rows.get(A)?.content).toBe("server")

    type(hook, "ab")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.rows.get(A)?.content).toBe("ab")
  })

  it("an autosave that completes after a switch to another document leaves that document's state alone", async () => {
    const hook = await open(env)
    type(hook, "A typed")
    const release = env.hold("autosave")
    await tick(AUTOSAVE_DELAY_MS)
    expect(env.names()).toEqual(["autosave"])

    await goTo(hook, env, B, "tab-B")
    expect(loaderOf(hook).lastSaved).toEqual(NOW)
    release()
    await settle()

    expect(loaderOf(hook).synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(loaderOf(hook).lastSaved).toEqual(NOW)
    expect(getCachedDocument("user-1", A)?.synced).toEqual({ promptId: A, title: "Title", content: "A typed" })
  })

  it("a title typed before the document is ready is neither written nor kept", async () => {
    const release = env.hold("fetch")
    const hook = await open(env)
    expect(loaderOf(hook).ready).toBe(false)
    setTitle(hook, "early")
    await tick(5000)
    expect(env.names()).toEqual([])

    release()
    await settle()
    expect(loaderOf(hook).title).toBe("Title")
    expect(env.names()).toEqual([])
  })

  it("autoSaving stays true until every overlapping request has finished", async () => {
    const hook = await open(env)
    const gate = env.hold("autosave")
    type(hook, "one")
    await tick(AUTOSAVE_DELAY_MS)
    type(hook, "one two")
    await tick(AUTOSAVE_DELAY_MS)
    expect(env.names()).toEqual(["autosave", "autosave"])
    expect(persistenceOf(hook).autoSaving).toBe(true)

    gate.releaseOne()
    await settle()
    expect(persistenceOf(hook).autoSaving).toBe(true)
    gate.releaseOne()
    await settle()
    expect(persistenceOf(hook).autoSaving).toBe(false)
  })

  it("a successful autosave updates the title in the document list", async () => {
    useUiStore.setState({ prompts: [listItem(A, "Old list title")] })
    const hook = await open(env)
    setTitle(hook, "Renamed")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(useUiStore.getState().prompts.find((p) => p.id === A)?.title).toBe("Renamed")
  })

  it("a request that never settles is abandoned after the timeout: the flag resets and the next edit is saved", async () => {
    const actions = withActionTimeout(env.actions)
    const gate = env.hold("autosave")
    const hook = await open(env, { actions })
    type(hook, "stuck")
    await tick(AUTOSAVE_DELAY_MS)
    expect(persistenceOf(hook).autoSaving).toBe(true)

    await tick(REQUEST_TIMEOUT_MS)
    await settle()
    expect(persistenceOf(hook).autoSaving).toBe(false)

    gate()
    type(hook, "stuck, then saved")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.rows.get(A)?.content).toBe("stuck, then saved")
  })

  it("works under React Strict Mode: one request, draft cleared", async () => {
    const hook = await open(env, { wrapper: StrictMode })
    type(hook, "typed")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["autosave"])
    expect(env.storage.getItem(draftKey(A))).toBeNull()
  })
})

// ---- cache and tab metadata ----

describe("cache and tab metadata", () => {
  let env: EditorEnv

  beforeEach(() => {
    env = makeEnv({ [A]: { title: "Title", content: "server" }, [B]: { title: "B title", content: "B server" } })
  })

  it("the tab follows the document: title, folder, dirty flag, and a preview tab is promoted by the first edit", async () => {
    const hook = await open(env)
    expect(tabOf("tab-A")).toMatchObject({ title: "Title", folderId: "f1", isDirty: false, isPreview: true })

    type(hook, "typed")
    expect(tabOf("tab-A")).toMatchObject({ isDirty: true, isPreview: false })
  })

  it("the working copy is cached, so a remount shows it and the autosave resumes", async () => {
    const first = await open(env)
    type(first, "typed")
    first.unmount()

    const second = await open(env)
    expect(loaderOf(second).content).toBe("typed")
    expect(loaderOf(second).synced?.content).toBe("server")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.rows.get(A)?.content).toBe("typed")
  })

  it("nothing is cached for a document that is not ready, and a switch never caches one document's text under another", async () => {
    const hook = await open(env)
    type(hook, "A typed")
    const release = env.hold("fetch")
    await goTo(hook, env, B, "tab-B")
    expect(loaderOf(hook).ready).toBe(false)
    expect(getCachedDocument("user-1", B)).toBeNull()
    expect(getCachedDocument("user-1", A)?.content).toBe("A typed")
    release()
    await settle()
    expect(getCachedDocument("user-1", B)?.content).toBe("B server")
  })
})

// ---- manual save ----

describe("manual save", () => {
  let env: EditorEnv

  beforeEach(() => {
    env = makeEnv({
      [A]: { title: "Title", content: "server" },
      [B]: { title: "B title", content: "B server" },
      untitled: { title: null, content: "" },
    })
  })

  it("Ctrl+S saves a version: request, baseline, promptData, toast, tab flags and a list refetch", async () => {
    const hook = await open(env)
    type(hook, "v2")
    pressCtrlS()
    await settle()

    expect(env.state.requests).toEqual([{ name: "save", input: { promptId: A, newTitle: "Title", newContent: "v2" } }])
    expect(loaderOf(hook).synced).toEqual({ promptId: A, title: "Title", content: "v2" })
    expect(loaderOf(hook).promptData).toMatchObject({ title: "Title", content: "v2" })
    expect(env.storage.getItem(draftKey(A))).toBeNull()
    expect(toast.success).toHaveBeenCalledWith("Version saved successfully")
    expect(tabOf("tab-A")).toMatchObject({ isDirty: false, isNewDocument: false })
    expect(useUiStore.getState().promptRefetchTrigger).toBe(1)
    expect(persistenceOf(hook).saving).toBe(false)
  })

  it("the Save button handler does the same as Ctrl+S", async () => {
    const hook = await open(env)
    type(hook, "v2")
    act(() => persistenceOf(hook).handleSave())
    await settle()
    expect(env.names()).toEqual(["save"])
  })

  it("a null title opens the dialog and writes nothing; confirming saves once with the confirmed title and keeps it (#36)", async () => {
    const hook = await open(env, { promptId: "untitled", tabId: "tab-A" })
    type(hook, "first text")
    pressCtrlS()
    await settle()
    expect(persistenceOf(hook).showSetTitleDialog).toBe(true)
    expect(env.names()).toEqual([])

    act(() => persistenceOf(hook).handleSetTitle("My prompt"))
    await settle()
    expect(env.state.requests).toEqual([
      { name: "save", input: { promptId: "untitled", newTitle: "My prompt", newContent: "first text" } },
    ])
    expect(persistenceOf(hook).showSetTitleDialog).toBe(false)
    expect(loaderOf(hook).title).toBe("My prompt")
    expect(env.rows.get("untitled")?.title).toBe("My prompt")

    type(hook, "first text, more")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["save", "autosave"])
    expect(env.state.requests[1].input).toEqual({ promptId: "untitled", title: "My prompt", content: "first text, more" })
  })

  it("a placeholder title opens the dialog too", async () => {
    const hook = await open(env)
    setTitle(hook, "[Untitled Doc 2]")
    pressCtrlS()
    await settle()
    expect(persistenceOf(hook).showSetTitleDialog).toBe(true)
    expect(env.state.requests.filter((r) => r.name === "save")).toEqual([])
  })

  it("nothing is saved while the document is not ready", async () => {
    env.hold("fetch")
    await open(env)
    pressCtrlS()
    await settle()
    expect(env.names()).toEqual([])
  })

  it("a second Ctrl+S while a save is in flight is ignored", async () => {
    const hook = await open(env)
    type(hook, "v2")
    const release = env.hold("save")
    pressCtrlS()
    await settle()
    expect(persistenceOf(hook).saving).toBe(true)
    pressCtrlS()
    await settle()
    expect(env.names()).toEqual(["save"])
    release()
    await settle()
    expect(persistenceOf(hook).saving).toBe(false)
  })

  it("a failed save keeps the working copy and the draft and reports the error", async () => {
    env.failNext("save")
    const hook = await open(env)
    type(hook, "v2")
    pressCtrlS()
    await settle()
    expect(toast.error).toHaveBeenCalledWith("save failed", { duration: 6000 })
    expect(loaderOf(hook).synced?.content).toBe("server")
    expect(draftOf(env).content).toBe("v2")
    expect(persistenceOf(hook).saving).toBe(false)
  })

  it("a rejected save resets the flag and a later Ctrl+S works", async () => {
    env.failNext("save", "reject")
    const hook = await open(env)
    type(hook, "v2")
    pressCtrlS()
    await settle()
    expect(toast.error).toHaveBeenCalled()
    expect(persistenceOf(hook).saving).toBe(false)

    pressCtrlS()
    await settle()
    expect(env.rows.get(A)?.content).toBe("v2")
  })

  it("Cmd+S (the Meta key) saves too", async () => {
    const hook = await open(env)
    type(hook, "v2")
    pressCtrlS({ metaKey: true })
    await settle()
    expect(env.names()).toEqual(["save"])
    expect(persistenceOf(hook).saving).toBe(false)
  })

  it("a save that never settles is abandoned after the timeout: an error, the flag resets and Ctrl+S works again", async () => {
    const gate = env.hold("save")
    const hook = await open(env, { actions: withActionTimeout(env.actions) })
    type(hook, "v2")
    pressCtrlS()
    await settle()
    expect(persistenceOf(hook).saving).toBe(true)
    pressCtrlS()
    expect(env.names()).toEqual(["save"])

    await tick(REQUEST_TIMEOUT_MS)
    await settle()
    expect(persistenceOf(hook).saving).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("The version could not be saved", { duration: 6000 })
    expect(loaderOf(hook).synced?.content).toBe("server")

    gate()
    pressCtrlS()
    await settle()
    expect(loaderOf(hook).synced?.content).toBe("v2")
  })

  it("the Ctrl+S handler uses the latest title", async () => {
    const hook = await open(env)
    setTitle(hook, "First")
    pressCtrlS()
    await settle()
    setTitle(hook, "Second")
    type(hook, "again")
    pressCtrlS()
    await settle()
    expect(env.inputs("save").map((input) => input.newTitle)).toEqual(["First", "Second"])
  })

  it("edits typed during a save stay, keep their draft, and are autosaved after it", async () => {
    const hook = await open(env)
    type(hook, "one")
    const release = env.hold("save")
    pressCtrlS()
    await settle()
    type(hook, "one two")
    await tick(AUTOSAVE_DELAY_MS * 4)
    expect(env.names()).toEqual(["save"])

    release()
    await settle()
    expect(loaderOf(hook).content).toBe("one two")
    expect(draftOf(env)).toEqual({ v: 1, base: hashContent("one"), content: "one two" })
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["save", "autosave"])
    expect(env.rows.get(A)?.content).toBe("one two")
  })

  it("a save that completes after a switch to another document leaves that document alone and patches its own cache entry", async () => {
    const hook = await open(env)
    type(hook, "A saved")
    const release = env.hold("save")
    pressCtrlS()
    await settle()

    await goTo(hook, env, B, "tab-B")
    release()
    await settle()

    expect(loaderOf(hook).promptData).toMatchObject({ id: B, title: "B title", content: "B server" })
    expect(loaderOf(hook).lastSaved).toEqual(NOW)
    expect(tabOf("tab-B")).toMatchObject({ title: "B title" })
    const entry = getCachedDocument("user-1", A)
    expect(entry?.promptData).toMatchObject({ title: "Title", content: "A saved" })
    expect(entry?.synced).toEqual({ promptId: A, title: "Title", content: "A saved" })
    expect(tabOf("tab-A")?.isNewDocument).toBe(false)
    // The dirty flag of a document that is not open is recomputed from its cache entry when it opens again.
    expect(tabOf("tab-A")?.isDirty).toBe(true)
    await goTo(hook, env, A, "tab-A")
    expect(tabOf("tab-A")?.isDirty).toBe(false)
  })

  it("does nothing for a document that is not ready, even when the fields in the loader look valid", async () => {
    const calls: unknown[] = []
    // Reason: a plain fake that is not ready; the hook must act on `ready`, not on the fields that look valid.
    const notReady = {
      ready: false,
      title: "Title",
      content: "text",
      markSynced: () => true,
      setTitle: () => {},
    } as unknown as DocumentLoader
    const actions: DocumentActions = {
      ...makeEnv({}).actions,
      saveNewVersion: async (input) => (calls.push(input), { success: true, data: { versionId: 1 } }),
    }
    const hook = renderHook(() => useVersionSave({ promptId: A, tabId: "tab-A", loader: notReady, actions, blocked: false }))
    act(() => hook.result.current.handleSave())
    pressCtrlS()
    await settle()
    expect(calls).toEqual([])
    expect(hook.result.current.showSetTitleDialog).toBe(false)
  })
})

// ---- restore ----

describe("restore", () => {
  let env: EditorEnv

  beforeEach(() => {
    env = makeEnv({ [A]: { title: "Title", content: "current" }, [B]: { title: "B title", content: "B server" } })
    env.state.versions.push({ id: 1, promptId: A, title: "Old title", content: "old text" })
    env.state.nextVersionId = 2
  })

  it("applies the restored row: working copy, baseline, promptData, cache, tab and list; autosave then continues from it", async () => {
    useUiStore.setState({ prompts: [listItem(A, "Title")] })
    const hook = await open(env)
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    await settle()

    expect(result).toBe(true)
    expect(env.names()).toEqual(["restore"])
    expect(loaderOf(hook)).toMatchObject({ title: "Old title", content: "old text" })
    expect(loaderOf(hook).synced).toEqual({ promptId: A, title: "Old title", content: "old text" })
    expect(loaderOf(hook).promptData).toMatchObject({ title: "Old title", content: "old text" })
    expect(getCachedDocument("user-1", A)).toMatchObject({ title: "Old title", content: "old text" })
    expect(tabOf("tab-A")).toMatchObject({ title: "Old title", isDirty: false })
    expect(toast.success).toHaveBeenCalledWith("Version restored")
    expect(useUiStore.getState().promptRefetchTrigger).toBe(1)
    expect(useUiStore.getState().prompts.find((p) => p.id === A)?.title).toBe("Old title")
    expect(persistenceOf(hook).restoring).toBe(false)

    type(hook, "old text!")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.state.requests.at(-1)).toEqual({
      name: "autosave",
      input: { promptId: A, title: "Old title", content: "old text!" },
    })
  })

  it("autosave is paused while the request runs and nothing queued behind it can overwrite the restore", async () => {
    const hook = await open(env)
    const release = env.hold("restore")
    let pending: Promise<boolean> | undefined
    act(() => {
      pending = persistenceOf(hook).handleRestore(1)
    })
    await settle()
    expect(persistenceOf(hook).restoring).toBe(true)
    pressCtrlS()
    await tick(AUTOSAVE_DELAY_MS * 4)
    expect(env.names()).toEqual(["restore"])

    release()
    await act(async () => {
      await pending
    })
    await settle()
    expect(env.names()).toEqual(["restore"])
    expect(env.rows.get(A)).toEqual({ title: "Old title", content: "old text" })
  })

  it("unsaved edits of a titled document are saved first: the requests are an autosave, then the restore", async () => {
    const hook = await open(env)
    type(hook, "unsaved edit")
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    await settle()

    expect(result).toBe(true)
    expect(env.names()).toEqual(["autosave", "restore"])
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Title", content: "unsaved edit" }])
    expect(loaderOf(hook).content).toBe("old text")
    expect(env.storage.getItem(draftKey(A))).toBeNull()
  })

  it("a failed save of the unsaved edits aborts the restore and keeps them", async () => {
    env.failNext("autosave")
    const hook = await open(env)
    type(hook, "unsaved edit")
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    await settle()

    expect(result).toBe(false)
    expect(env.names()).toEqual(["autosave"])
    expect(loaderOf(hook).content).toBe("unsaved edit")
    expect(draftOf(env).content).toBe("unsaved edit")
    expect(toast.error).toHaveBeenCalled()
    expect(persistenceOf(hook).restoring).toBe(false)
  })

  it("a blank title with unsaved edits refuses the restore and keeps the edits", async () => {
    const hook = await open(env)
    setTitle(hook, "")
    type(hook, "typed under a blank title")
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    expect(result).toBe(false)
    expect(env.names()).toEqual([])
    expect(toast.error).toHaveBeenCalledWith(NEEDS_TITLE_TOAST)
    expect(loaderOf(hook).content).toBe("typed under a blank title")
    expect(draftOf(env).content).toBe("typed under a blank title")
    expect(persistenceOf(hook).restoring).toBe(false)
  })

  it("a document with a blank title and no edits can be restored: there is nothing to lose", async () => {
    env = makeEnv({ [A]: { title: null, content: "" } })
    env.state.versions.push({ id: 1, promptId: A, title: "Old title", content: "old text" })
    env.state.nextVersionId = 2
    const hook = await open(env)
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    expect(result).toBe(true)
    expect(loaderOf(hook)).toMatchObject({ title: "Old title", content: "old text" })
  })

  it("a second restore while one runs is refused and sends nothing", async () => {
    const hook = await open(env)
    const release = env.hold("restore")
    let first: Promise<boolean> | undefined
    act(() => {
      first = persistenceOf(hook).handleRestore(1)
    })
    await settle()
    let second: boolean | undefined
    await act(async () => {
      second = await persistenceOf(hook).handleRestore(1)
    })
    expect(second).toBe(false)
    expect(env.names()).toEqual(["restore"])

    release()
    let firstResult
    await act(async () => {
      firstResult = await first
    })
    expect(firstResult).toBe(true)
    expect(persistenceOf(hook).restoring).toBe(false)
  })

  it("a restore that never settles is abandoned after the timeout and the editor stays usable", async () => {
    const gate = env.hold("restore")
    const hook = await open(env, { actions: withActionTimeout(env.actions) })
    let pending: Promise<boolean> | undefined
    act(() => {
      pending = persistenceOf(hook).handleRestore(1)
    })
    await settle()
    expect(persistenceOf(hook).restoring).toBe(true)

    await tick(REQUEST_TIMEOUT_MS)
    let result: boolean | undefined
    await act(async () => {
      result = await pending
    })
    expect(result).toBe(false)
    expect(persistenceOf(hook).restoring).toBe(false)
    expect(loaderOf(hook).content).toBe("current")
    gate()
  })

  it("a failed restore keeps the working copy and resumes autosave", async () => {
    env.failNext("restore")
    const hook = await open(env)
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("restore failed")
    expect(loaderOf(hook).content).toBe("current")

    type(hook, "after")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["restore", "autosave"])
  })

  it("a rejected restore resets the flag", async () => {
    env.failNext("restore", "reject")
    const hook = await open(env)
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    expect(result).toBe(false)
    expect(persistenceOf(hook).restoring).toBe(false)
  })

  it("an unknown version fails without changing the editor", async () => {
    const hook = await open(env)
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(99)
    })
    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("Version not found")
    expect(loaderOf(hook).content).toBe("current")
  })

  it("nothing is sent while the document is not ready", async () => {
    env.hold("fetch")
    const hook = await open(env)
    let result: boolean | undefined
    await act(async () => {
      result = await persistenceOf(hook).handleRestore(1)
    })
    expect(result).toBe(false)
    expect(env.names()).toEqual([])
  })

  it("does nothing for a document that is not ready, even when the fields in the loader look valid", async () => {
    const calls: unknown[] = []
    // Reason: a plain fake that is not ready; the hook must act on `ready`, not on the fields that look valid.
    const notReady = {
      ready: false,
      title: "Title",
      content: "changed",
      synced: { promptId: A, title: "Title", content: "server" },
      markSynced: () => true,
      applyServerState: () => true,
    } as unknown as DocumentLoader
    const actions: DocumentActions = {
      ...makeEnv({}).actions,
      autoSavePrompt: async (input) => (calls.push(input), { success: true, data: undefined }),
      restorePromptVersion: async (input) => (calls.push(input), { success: true, data: { title: "x", content: "y" } }),
    }
    const hook = renderHook(() => useVersionRestore({ promptId: A, tabId: "tab-A", loader: notReady, actions }))
    let result: boolean | undefined
    await act(async () => {
      result = await hook.result.current.handleRestore(1)
    })
    expect(result).toBe(false)
    expect(calls).toEqual([])
  })

  it("a restore that completes after a switch to another document leaves it alone and replaces its own cache entry", async () => {
    const hook = await open(env)
    const release = env.hold("restore")
    let pending: Promise<boolean> | undefined
    act(() => {
      pending = persistenceOf(hook).handleRestore(1)
    })
    await settle()

    await goTo(hook, env, B, "tab-B")
    release()
    let result: boolean | undefined
    await act(async () => {
      result = await pending
    })
    await settle()

    expect(result).toBe(true)
    expect(loaderOf(hook)).toMatchObject({ title: "B title", content: "B server" })
    expect(loaderOf(hook).synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(getCachedDocument("user-1", A)).toMatchObject({ title: "Old title", content: "old text" })
    expect(getCachedDocument("user-1", A)?.synced).toEqual({ promptId: A, title: "Old title", content: "old text" })
    expect(tabOf("tab-A")?.title).toBe("Old title")
    expect(tabOf("tab-B")?.title).toBe("B title")
  })

  it("a restore that completes after a switch clears the dirty flag of the tab it belongs to", async () => {
    const hook = await open(env)
    type(hook, "unsaved edit")
    expect(tabOf("tab-A")?.isDirty).toBe(true)
    const release = env.hold("restore")
    let pending: Promise<boolean> | undefined
    act(() => {
      pending = persistenceOf(hook).handleRestore(1)
    })
    await settle()
    await goTo(hook, env, B, "tab-B")
    release()
    await act(async () => {
      await pending
    })
    await settle()
    expect(tabOf("tab-A")?.isDirty).toBe(false)
    expect(tabOf("tab-A")?.title).toBe("Old title")
  })

  it("a restore that completes after the editor unmounted still replaces the cache entry, so a later open shows it", async () => {
    const first = await open(env)
    const release = env.hold("restore")
    let pending: Promise<boolean> | undefined
    act(() => {
      pending = persistenceOf(first).handleRestore(1)
    })
    await settle()
    first.unmount()
    release()
    await act(async () => {
      await pending
    })

    const second = await open(env)
    expect(loaderOf(second)).toMatchObject({ title: "Old title", content: "old text" })
    expect(loaderOf(second).synced?.content).toBe("old text")
    await tick(5000)
    expect(env.names()).toEqual(["restore"])
  })
})

// ---- withActionTimeout ----

describe("withActionTimeout", () => {
  it("rejects a history read that never settles, and passes a result that arrives in time", async () => {
    const env = makeEnv({ [A]: { title: "T", content: "c" } })
    const limited = withActionTimeout(env.actions, 1000)
    const release = env.hold("history")
    const stuck = limited.getPromptVersionHistory({ promptId: A }).then(
      () => "settled",
      (error: Error) => error.message
    )
    await tick(1000)
    expect(await stuck).toBe(REQUEST_TIMED_OUT)

    release()
    expect(await limited.getPromptVersionHistory({ promptId: A })).toEqual({ success: true, data: [] })
  })
})
