// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/hooks/useDocumentPersistence.restore.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 10:38 GMT+10
Last modified: 22/10/2026 10:51 GMT+10
---------------
The version restore through the persistence hook (contract: Async Completions and Failures, decision D4): the
restored row replaces the working copy, the baseline, promptData, the cache entry and the tab and list titles; unsaved
edits of a titled document are saved first and a failed save aborts the restore; a blank title with unsaved edits is
refused; autosave and Ctrl+S are paused while it runs; a completion after a switch or an unmount touches only the
restored document's cache entry and tab; a failed, rejected or abandoned restore keeps the working copy. Composed with
the real loader over the fake server; assertions read the requests the server received and what the hooks and stores
show.

Changelog:
22/10/2026 10:51 GMT+10 | A restore that fails after its edits were saved leaves them as the baseline (mutation finding)
22/10/2026 10:38 GMT+10 | Created (P7S1T8 step 2)
*/

import { act, cleanup, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { withActionTimeout, type DocumentActions } from "@/features/editor/document-actions"
import { getCachedDocument } from "@/features/editor/document-cache"
import { REQUEST_TIMEOUT_MS } from "@/features/editor/request-timeout"
import { useUiStore } from "@/stores/use-ui-store"
import { draftOf } from "@/test/draft-world"
import { listItem, makeEnv, type EditorEnv } from "@/test/editor-env"
import {
  goTo, open, pressCtrlS, resetEditorWorld, setTitle, settle, tabOf, tick, typeContent, type SessionHook,
} from "@/test/editor-session"
import { A, B, USER_ID } from "@/test/loader-world"
import { AUTOSAVE_DELAY_MS } from "./useAutoSave"
import type { DocumentLoader } from "./useDocumentLoader"
import { useVersionRestore } from "./useVersionRestore"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}))

const NEEDS_TITLE = "Give the document a title first, so your changes are saved before a version is restored"
const FLUSH_FAILED = "Your current changes could not be saved, so nothing was restored"

/** What a restore resolved to; a rejection is reported as "rejected", so a test fails on its assertion. */
type Outcome = boolean | "rejected"

/**
 * Starts a restore through the persistence hook without waiting for it.
 * @returns The outcome, once it settles.
 */
function startRestore(hook: SessionHook, versionId: number): Promise<Outcome> {
  let pending: Promise<Outcome> = Promise.resolve("rejected")
  act(() => {
    pending = hook.result.current.persistence.handleRestore(versionId).catch((): Outcome => "rejected")
  })
  return pending
}

/** Waits inside `act` for a restore started earlier. */
async function finish(pending: Promise<Outcome>): Promise<Outcome> {
  let outcome: Outcome = "rejected"
  await act(async () => {
    outcome = await pending
  })
  return outcome
}

/** Restores a version through the persistence hook and waits for it. */
const restoreNow = (hook: SessionHook, versionId: number): Promise<Outcome> => finish(startRestore(hook, versionId))

let env: EditorEnv

beforeEach(() => {
  resetEditorWorld()
  env = makeEnv({ [A]: { title: "Title", content: "current" }, [B]: { title: "B title", content: "B server" } })
  env.state.versions.push({ id: 1, promptId: A, title: "Old title", content: "old text" })
  env.state.nextVersionId = 2
})

afterEach(cleanup)
afterEach(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())

describe("restore into the editor", () => {
  it("applies the restored row to the working copy, baseline, promptData, cache, tab and list", async () => {
    useUiStore.setState({ prompts: [listItem(A, "Title")] })
    const hook = await open(env)
    const outcome = await restoreNow(hook, 1)
    await settle()

    expect(outcome).toBe(true)
    expect(env.names()).toEqual(["restore"])
    const { loader, persistence } = hook.result.current
    expect(loader).toMatchObject({ title: "Old title", content: "old text" })
    expect(loader.synced).toEqual({ promptId: A, title: "Old title", content: "old text" })
    expect(loader.promptData).toMatchObject({ title: "Old title", content: "old text" })
    expect(getCachedDocument(USER_ID, A)).toMatchObject({ title: "Old title", content: "old text" })
    expect(getCachedDocument(USER_ID, A)?.synced).toEqual({ promptId: A, title: "Old title", content: "old text" })
    expect(tabOf("tab-A")).toMatchObject({ title: "Old title", isDirty: false })
    expect(toast.success).toHaveBeenCalledWith("Version restored")
    expect(useUiStore.getState().promptRefetchTrigger).toBe(1)
    expect(useUiStore.getState().prompts.find((p) => p.id === A)?.title).toBe("Old title")
    expect(persistence.restoring).toBe(false)

    typeContent(hook, "old text!")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.state.requests.at(-1)).toEqual({
      name: "autosave",
      input: { promptId: A, title: "Old title", content: "old text!" },
    })
  })

  it("autosave and Ctrl+S are paused while it runs, so nothing queued behind it overwrites the restore", async () => {
    const hook = await open(env)
    typeContent(hook, "unsaved edit")
    const release = env.hold("restore")
    const pending = startRestore(hook, 1)
    await settle()
    expect(hook.result.current.persistence.restoring).toBe(true)
    pressCtrlS()
    await tick(AUTOSAVE_DELAY_MS * 4)
    expect(env.names().at(-1)).toBe("restore")

    release()
    expect(await finish(pending)).toBe(true)
    await tick(AUTOSAVE_DELAY_MS * 4)
    await settle()
    expect(env.state.requests).toEqual([
      { name: "autosave", input: { promptId: A, title: "Title", content: "unsaved edit" } },
      { name: "restore", input: { promptId: A, versionId: 1 } },
    ])
    expect(hook.result.current.loader).toMatchObject({ title: "Old title", content: "old text" })
  })

  it("unsaved edits of a titled document are saved first: the requests are an autosave, then the restore", async () => {
    const hook = await open(env)
    typeContent(hook, "unsaved edit")
    const outcome = await restoreNow(hook, 1)
    await settle()

    expect(outcome).toBe(true)
    expect(env.names()).toEqual(["autosave", "restore"])
    expect(env.inputs("autosave")).toEqual([{ promptId: A, title: "Title", content: "unsaved edit" }])
    expect(hook.result.current.loader.content).toBe("old text")
    expect(draftOf(env.storage)).toBeNull()
  })

  it("a failed save of the unsaved edits aborts the restore and keeps them", async () => {
    env.failNext("autosave")
    const hook = await open(env)
    typeContent(hook, "unsaved edit")
    const outcome = await restoreNow(hook, 1)
    await settle()

    expect(outcome).toBe(false)
    expect(env.names()).toEqual(["autosave"])
    expect(toast.error).toHaveBeenCalledWith(FLUSH_FAILED)
    expect(hook.result.current.loader.content).toBe("unsaved edit")
    expect(draftOf(env.storage)?.content).toBe("unsaved edit")
    expect(hook.result.current.persistence.restoring).toBe(false)
  })

  it("a restore that fails after its edits were saved leaves them as the baseline: no second save", async () => {
    env.failNext("restore")
    const hook = await open(env)
    typeContent(hook, "unsaved edit")
    expect(await restoreNow(hook, 1)).toBe(false)
    await settle()
    expect(hook.result.current.loader.synced).toEqual({ promptId: A, title: "Title", content: "unsaved edit" })

    await tick(AUTOSAVE_DELAY_MS * 2)
    await settle()
    expect(env.names()).toEqual(["autosave", "restore"])
  })

  it("a blank title with unsaved edits refuses the restore, sends nothing and keeps the edits", async () => {
    const hook = await open(env)
    setTitle(hook, "")
    typeContent(hook, "typed under a blank title")
    const outcome = await restoreNow(hook, 1)

    expect(outcome).toBe(false)
    expect(env.names()).toEqual([])
    expect(toast.error).toHaveBeenCalledWith(NEEDS_TITLE)
    expect(hook.result.current.loader.content).toBe("typed under a blank title")
    expect(draftOf(env.storage)?.content).toBe("typed under a blank title")
    expect(hook.result.current.persistence.restoring).toBe(false)
  })

  it("a document with a blank title and no edits can be restored: there is nothing to lose", async () => {
    env = makeEnv({ [A]: { title: null, content: "" } })
    env.state.versions.push({ id: 1, promptId: A, title: "Old title", content: "old text" })
    env.state.nextVersionId = 2
    const hook = await open(env)
    expect(await restoreNow(hook, 1)).toBe(true)
    expect(env.names()).toEqual(["restore"])
    expect(hook.result.current.loader).toMatchObject({ title: "Old title", content: "old text" })
  })

  it("a second restore while one runs is refused and sends nothing", async () => {
    const hook = await open(env)
    const release = env.hold("restore")
    const first = startRestore(hook, 1)
    await settle()
    // Reason: started, not awaited, so a second request that reached the held server fails here instead of hanging.
    const second = startRestore(hook, 1)
    await settle()
    expect(env.names()).toEqual(["restore"])

    release()
    expect(await finish(second)).toBe(false)
    expect(await finish(first)).toBe(true)
    expect(hook.result.current.persistence.restoring).toBe(false)
  })
})

describe("restore failures", () => {
  it("a failed restore keeps the working copy, resets restoring and resumes autosave", async () => {
    env.failNext("restore")
    const hook = await open(env)
    expect(await restoreNow(hook, 1)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("restore failed")
    expect(hook.result.current.loader).toMatchObject({ title: "Title", content: "current" })
    expect(hook.result.current.persistence.restoring).toBe(false)

    typeContent(hook, "after")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["restore", "autosave"])
  })

  it("a rejected restore keeps the working copy, resets restoring and resumes autosave", async () => {
    env.failNext("restore", "reject")
    const hook = await open(env)
    expect(await restoreNow(hook, 1)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("The version could not be restored")
    expect(hook.result.current.loader).toMatchObject({ title: "Title", content: "current" })
    expect(hook.result.current.persistence.restoring).toBe(false)

    typeContent(hook, "after")
    await tick(AUTOSAVE_DELAY_MS)
    await settle()
    expect(env.names()).toEqual(["restore", "autosave"])
  })

  it("a restore that never settles is abandoned after the timeout and the editor stays usable", async () => {
    const gate = env.hold("restore")
    const hook = await open(env, { actions: withActionTimeout(env.actions) })
    const pending = startRestore(hook, 1)
    await settle()
    expect(hook.result.current.persistence.restoring).toBe(true)

    await tick(REQUEST_TIMEOUT_MS)
    expect(await finish(pending)).toBe(false)
    expect(hook.result.current.persistence.restoring).toBe(false)
    expect(hook.result.current.loader.content).toBe("current")
    gate()
  })

  it("an unknown version fails without changing the editor", async () => {
    const hook = await open(env)
    expect(await restoreNow(hook, 99)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("Version not found")
    expect(hook.result.current.loader).toMatchObject({ title: "Title", content: "current" })
    expect(hook.result.current.loader.synced).toEqual({ promptId: A, title: "Title", content: "current" })
    expect(hook.result.current.persistence.restoring).toBe(false)
  })

  it("nothing is sent while the document is not ready", async () => {
    env.hold("fetch")
    const hook = await open(env)
    expect(hook.result.current.loader.ready).toBe(false)
    expect(await restoreNow(hook, 1)).toBe(false)
    expect(env.names()).toEqual([])
  })

  it("does nothing for a loader that is not ready, even when its fields look valid", async () => {
    const sent: unknown[] = []
    // Reason: a loader that is not ready but whose fields look valid; the hook must act on `ready`, not on the fields.
    const notReady: DocumentLoader = {
      promptData: null,
      title: "Title",
      content: "changed",
      lastSaved: null,
      synced: { promptId: A, title: "Title", content: "server" },
      loading: false,
      error: "",
      currentUserId: USER_ID,
      ready: false,
      monacoPromptIdRef: { current: A },
      promptIdRef: { current: A },
      setTitle: () => undefined,
      setContent: () => undefined,
      markSynced: () => true,
      applyServerState: () => true,
    }
    const actions: DocumentActions = {
      ...env.actions,
      autoSavePrompt: async (input) => {
        sent.push(input)
        return { success: true, data: undefined }
      },
      restorePromptVersion: async (input) => {
        sent.push(input)
        return { success: true, data: { title: "x", content: "y" } }
      },
    }
    const hook = renderHook(() => useVersionRestore({ promptId: A, tabId: "tab-A", loader: notReady, actions }))
    let outcome: Outcome = "rejected"
    await act(async () => {
      outcome = await hook.result.current.handleRestore(1)
    })
    expect(outcome).toBe(false)
    expect(sent).toEqual([])
  })
})

describe("restore completions", () => {
  it("a restore that completes after a switch leaves the open document alone and replaces its own entry", async () => {
    const hook = await open(env)
    const release = env.hold("restore")
    const pending = startRestore(hook, 1)
    await settle()

    await goTo(hook, env, B, "tab-B")
    release()
    const outcome = await finish(pending)
    await settle()

    expect(outcome).toBe(true)
    const { loader } = hook.result.current
    expect(loader).toMatchObject({ title: "B title", content: "B server" })
    expect(loader.synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(loader.promptData).toMatchObject({ id: B, title: "B title", content: "B server" })
    expect(getCachedDocument(USER_ID, A)).toMatchObject({ title: "Old title", content: "old text" })
    expect(getCachedDocument(USER_ID, A)?.synced).toEqual({ promptId: A, title: "Old title", content: "old text" })
    expect(getCachedDocument(USER_ID, B)?.synced).toEqual({ promptId: B, title: "B title", content: "B server" })
    expect(tabOf("tab-A")?.title).toBe("Old title")
    expect(tabOf("tab-B")).toMatchObject({ title: "B title", isDirty: false })
  })

  it("a restore that completes after a switch clears the dirty flag of the tab it belongs to", async () => {
    const hook = await open(env)
    typeContent(hook, "unsaved edit")
    expect(tabOf("tab-A")?.isDirty).toBe(true)
    const release = env.hold("restore")
    const pending = startRestore(hook, 1)
    await settle()
    await goTo(hook, env, B, "tab-B")
    release()
    await finish(pending)
    await settle()

    expect(tabOf("tab-A")).toMatchObject({ title: "Old title", isDirty: false })
    await goTo(hook, env, A, "tab-A")
    expect(hook.result.current.loader).toMatchObject({ title: "Old title", content: "old text" })
    expect(tabOf("tab-A")?.isDirty).toBe(false)
  })

  it("a handleRestore left over from the previous document restores nothing and saves nothing", async () => {
    const hook = await open(env)
    typeContent(hook, "unsaved edit")
    const stale = hook.result.current.persistence.handleRestore
    await goTo(hook, env, B, "tab-B")
    typeContent(hook, "B edit")

    let outcome: Outcome = "rejected"
    await act(async () => {
      outcome = await stale(1).catch((): Outcome => "rejected")
    })
    expect(outcome).toBe(false)
    expect(env.names()).toEqual([])
    expect(hook.result.current.loader).toMatchObject({ title: "B title", content: "B edit" })
  })

  it("a restore that completes after an unmount replaces the cache entry, so a later open shows it", async () => {
    const first = await open(env)
    const release = env.hold("restore")
    const pending = startRestore(first, 1)
    await settle()
    first.unmount()
    release()
    expect(await finish(pending)).toBe(true)

    expect(getCachedDocument(USER_ID, A)?.synced).toEqual({ promptId: A, title: "Old title", content: "old text" })
    const second = await open(env)
    expect(second.result.current.loader).toMatchObject({ title: "Old title", content: "old text" })
    expect(second.result.current.loader.synced?.content).toBe("old text")
    await tick(5000)
    expect(env.names()).toEqual(["restore"])
  })
})
