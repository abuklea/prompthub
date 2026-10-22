/*
Project: PromptHub
Author: Allan James
Source: src/test/editor-env.ts
MIME: text/typescript
Type: TypeScript test fake

Created: 22/10/2026 10:15 GMT+10
Last modified: 22/10/2026 10:15 GMT+10
---------------
The editor's fake server, behind the DocumentActions and DocumentLoaderIo seams: rows, commit-style versions, every
request in call order, per-request holds and one-shot failures. The render helpers that drive the persistence hooks
over it are in src/test/editor-session.ts. Nothing here mocks a module of this repository.

Changelog:
22/10/2026 10:15 GMT+10 | Created from the editor part of the P7S1 test fakes (P7S1T7)
*/

import type { DocumentActions } from "@/features/editor/document-actions"
import type { DocumentLoaderIo } from "@/features/editor/loader-protocol"
import type { PromptListItem } from "@/features/prompts/types"
import { NOW, USER_ID, promptRow, type Row } from "./loader-world"
import { makeStorage, type FakeStorage } from "./storage-fake"

type Input<K extends keyof DocumentActions> = Parameters<DocumentActions[K]>[0]

/** The name the tests use for each action, with the input that action takes. */
interface RequestInputs {
  save: Input<"saveNewVersion">
  autosave: Input<"autoSavePrompt">
  restore: Input<"restorePromptVersion">
  history: Input<"getPromptVersionHistory">
}

/** The name of a request the fake server records. */
export type RequestName = keyof RequestInputs
/** The input of the request named `N`. */
export type InputOf<N extends RequestName> = RequestInputs[N]
/** One request that reached the fake server. */
export type RecordedRequest = { [N in RequestName]: { name: N; input: RequestInputs[N] } }[RequestName]
/** `fetch` holds the document read; the others hold the action of that name. */
export type HoldName = RequestName | "fetch"
/** Releases every held call; `releaseOne` releases the oldest one only. */
export type Release = (() => void) & { releaseOne(): void }
/** `result` answers `{ success: false }`; `reject` throws as a dropped connection does. */
export type FailureMode = "result" | "reject"

/** One version the fake server keeps. */
export interface Version {
  /** The version id; ids only grow. */
  id: number
  /** The document it belongs to. */
  promptId: string
  /** The title snapshot. */
  title: string | null
  /** The content snapshot. */
  content: string
}

/** The fake server and the seams to inject. */
export interface EditorEnv {
  /** The rows by document id. */
  rows: Map<string, Row>
  /** The draft storage `io.getStorage()` returns. */
  storage: FakeStorage
  /** Every request in call order, and the versions derived from them. */
  state: { requests: RecordedRequest[]; versions: Version[]; nextVersionId: number }
  /** The actions to inject; each records its request before it waits at its hold. */
  actions: DocumentActions
  /** The loader's io: the user is `USER_ID`; the fetch waits at the `fetch` hold. */
  io: DocumentLoaderIo
  /**
   * Holds every later call of `name` until the returned function releases it; held calls queue in order.
   * @param name - The request to hold.
   * @returns The release function.
   */
  hold(name: HoldName): Release
  /**
   * Makes the next call of `name` fail once.
   * @param name - The request to fail.
   * @param mode - How it fails; `result` when omitted.
   */
  failNext(name: RequestName, mode?: FailureMode): void
  /** @returns The names of the requests received so far, in call order. */
  names(): RequestName[]
  /**
   * The inputs of the requests of one kind.
   * @param name - The request name.
   * @returns Their inputs, in call order.
   */
  inputs<N extends RequestName>(name: N): Array<InputOf<N>>
}

/** Per-request holds and one-shot failures. */
function makeGates() {
  const holds = new Map<HoldName, Array<() => void>>()
  const failures = new Map<RequestName, FailureMode>()

  const hold = (name: HoldName): Release => {
    const waiting: Array<() => void> = []
    holds.set(name, waiting)
    const releaseAll = () => {
      holds.delete(name)
      waiting.splice(0).forEach((resolve) => resolve())
    }
    return Object.assign(releaseAll, { releaseOne: () => waiting.shift()?.() })
  }
  const passGate = async (name: HoldName): Promise<void> => {
    const waiting = holds.get(name)
    if (waiting) await new Promise<void>((resolve) => waiting.push(resolve))
  }
  const failNext = (name: RequestName, mode: FailureMode = "result") => {
    failures.set(name, mode)
  }
  /** Waits at the hold of the request and applies its one-shot failure; null means "carry on". */
  const intercept = async (name: RequestName): Promise<{ success: false; error: string } | null> => {
    await passGate(name)
    const mode = failures.get(name)
    if (!mode) return null
    failures.delete(name)
    if (mode === "reject") throw new Error("Failed to fetch")
    return { success: false, error: `${name} failed` }
  }
  return { hold, passGate, failNext, intercept }
}

/**
 * Builds a fake server over the given rows.
 * @param rows - The rows by document id.
 * @returns The server, its storage, the seams and the controls.
 */
export function makeEnv(rows: Record<string, Row>): EditorEnv {
  const rowsMap = new Map(Object.entries(rows))
  const storage = makeStorage()
  const state: EditorEnv["state"] = { requests: [], versions: [], nextVersionId: 1 }
  const gates = makeGates()
  const begin = (request: RecordedRequest) => {
    state.requests.push(request)
    return gates.intercept(request.name)
  }
  /** Commit-style history: a version equal to the newest one for the document is not added. */
  const pushVersion = (promptId: string, title: string | null, content: string): Version => {
    const newest = state.versions.filter((v) => v.promptId === promptId).at(-1)
    if (newest && newest.title === title && newest.content === content) return newest
    const version: Version = { id: state.nextVersionId++, promptId, title, content }
    state.versions.push(version)
    return version
  }

  const actions: DocumentActions = {
    saveNewVersion: async (input) => {
      const early = await begin({ name: "save", input })
      if (early) return early
      rowsMap.set(input.promptId, { title: input.newTitle, content: input.newContent })
      return { success: true, data: { versionId: pushVersion(input.promptId, input.newTitle, input.newContent).id } }
    },
    autoSavePrompt: async (input) => {
      const early = await begin({ name: "autosave", input })
      if (early) return early
      rowsMap.set(input.promptId, { title: input.title, content: input.content })
      return { success: true, data: undefined }
    },
    restorePromptVersion: async (input) => {
      const early = await begin({ name: "restore", input })
      if (early) return early
      const version = state.versions.find((v) => v.id === input.versionId && v.promptId === input.promptId)
      const row = rowsMap.get(input.promptId)
      if (!version || !row) return { success: false, error: "Version not found" }
      pushVersion(input.promptId, row.title, row.content)
      rowsMap.set(input.promptId, { title: version.title, content: version.content })
      pushVersion(input.promptId, version.title, version.content)
      return { success: true, data: { title: version.title, content: version.content } }
    },
    getPromptVersionHistory: async (input) => {
      const early = await begin({ name: "history", input })
      if (early) return early
      // Reason: the server lists the newest snapshot first; ids only grow, so the id orders them.
      const mine = state.versions.filter((v) => v.promptId === input.promptId).sort((a, b) => b.id - a.id)
      const data = mine.map((v) => ({
        id: v.id, created_at: NOW, title_snapshot: v.title, content_snapshot: v.content,
      }))
      return { success: true, data }
    },
  }

  const io: DocumentLoaderIo = {
    getUserId: () => Promise.resolve(USER_ID),
    fetchPrompt: async (id) => {
      await gates.passGate("fetch")
      const row = rowsMap.get(id)
      return row ? { success: true, data: promptRow(id, row) } : { success: false, error: "Prompt not found" }
    },
    getStorage: () => storage,
  }

  return {
    rows: rowsMap,
    storage,
    state,
    actions,
    io,
    hold: gates.hold,
    failNext: gates.failNext,
    names: () => state.requests.map((r) => r.name),
    // Reason: filter cannot narrow a union by a generic key, so the cast restates what the filter established.
    inputs: <N extends RequestName>(name: N) =>
      state.requests.filter((r) => r.name === name).map((r) => r.input as InputOf<N>),
  }
}

/**
 * Builds a row of the document list that the sidebar and the stores hold.
 * @param id - The document id.
 * @param title - Its listed title.
 * @returns The list item, stamped with `NOW`.
 */
export function listItem(id: string, title: string | null): PromptListItem {
  return { id, title, created_at: NOW, updated_at: NOW, user_id: USER_ID, folder_id: "f1" }
}
