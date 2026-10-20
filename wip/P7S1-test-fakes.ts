/*
Project: PromptHub
Author: Allan James
Source: wip/P7S1-test-fakes.ts
MIME: text/typescript
Type: TypeScript test fakes (research spike, not imported by the application)

Created: 20/10/2026 14:03 GMT+10
Last modified: 20/10/2026 14:03 GMT+10
---------------
P7S1 research spike. The typed fakes that the three spike suites share: a recording storage, the fetch seam of the loader
over a map of rows, a deferred seam for tests that settle each lookup by hand, and a fake server for the persistence
hooks with per-action holds and one-shot failures. None of it mocks a module of this repository: every fake is injected
through a seam the production code already exposes. The file imports no test library (the one thing that needs `act` takes
it as an argument), so `npx tsc --noEmit` accepts it before P7S1T1 adds the dev dependencies. P7S1T4 writes the storage
part as src/test/storage-fake.ts, P7S1T5 the loader part as src/test/loader-world.ts and P7S1T7 the server part as
src/test/editor-env.ts.

Changelog:
20/10/2026 14:03 GMT+10 | Created
*/

import type { PromptListItem } from "@/features/prompts/types"
import type { ActionResult } from "@/types/actions"
import type { DraftStorage } from "./P7S1-draft-spike"
import type { DocumentLoaderIo, PromptWithFolder } from "./P7S1-loader-spike"
import type { DocumentActions } from "./P7S1-persistence-spike"

export const A = "11111111-1111-4111-8111-111111111111"
export const B = "22222222-2222-4222-8222-222222222222"
export const C = "33333333-3333-4333-8333-333333333333"
export const NOW = new Date("2026-10-20T01:00:00.000Z")
export const USER_ID = "user-1"

// ---- src/test/storage-fake.ts (T4) ----

/** An in-memory storage that records its writes and can be told to refuse them like a full quota. */
export interface FakeStorage extends DraftStorage {
  map: Map<string, string>
  sets: Array<{ key: string; value: string }>
  refuseWrites: boolean
}

export function makeStorage(initial: Record<string, string> = {}): FakeStorage {
  const map = new Map(Object.entries(initial))
  const api: FakeStorage = {
    map,
    sets: [],
    refuseWrites: false,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      if (api.refuseWrites) throw new Error("QuotaExceededError")
      api.sets.push({ key, value })
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
  return api
}

/** A storage every call of which throws, as a browser with storage blocked does. */
export function makeBrokenStorage(): DraftStorage {
  const fail = (): never => {
    throw new Error("storage blocked")
  }
  return { getItem: fail, setItem: fail, removeItem: fail }
}

// ---- src/test/loader-world.ts (T5) ----

/** What the fake server holds for one document. */
export interface Row {
  title: string | null
  content: string
}

/** The row the production fetch returns: the prompt, its folder and the (always empty) tags. */
export type FetchedRow = PromptWithFolder & { tags: never[] }

export function promptRow(id: string, row: Row): FetchedRow {
  return {
    id,
    title: row.title,
    content: row.content,
    created_at: NOW,
    updated_at: NOW,
    user_id: USER_ID,
    folder_id: "f1",
    folder: { id: "f1", name: "Folder" },
    tags: [],
  }
}

/** A row of the document list that the sidebar and the stores hold. */
export function listItem(id: string, title: string | null): PromptListItem {
  return { id, title, created_at: NOW, updated_at: NOW, user_id: USER_ID, folder_id: "f1" }
}

/** A successful fetch result; the narrow type lets a test read `.data` without a guard. */
export function serverRow(id: string, title: string | null, content: string): { success: true; data: FetchedRow } {
  return { success: true, data: promptRow(id, { title, content }) }
}

/** A server (rows by id), a storage and the io seam the loader reads: real promises, no mocks of repository modules. */
export interface World<S extends DraftStorage | null = FakeStorage> {
  server: Map<string, Row>
  storage: S
  io: DocumentLoaderIo
}

export function makeWorld(rows: Record<string, Row>): World
export function makeWorld<S extends DraftStorage | null>(rows: Record<string, Row>, storage: S): World<S>
export function makeWorld(
  rows: Record<string, Row>,
  storage: DraftStorage | null = makeStorage()
): World<DraftStorage | null> {
  const server = new Map(Object.entries(rows))
  const io: DocumentLoaderIo = {
    getUserId: () => Promise.resolve(USER_ID),
    fetchPrompt: (id) => {
      const row = server.get(id)
      return Promise.resolve(row ? { success: true, data: promptRow(id, row) } : { success: false, error: "Prompt not found" })
    },
    getStorage: () => storage,
  }
  return { server, storage, io }
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}

export function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** RTL's `act`, passed in so that this file imports no test library. */
export type Act = (callback: () => Promise<void>) => Promise<unknown>

export interface DeferredIo {
  io: DocumentLoaderIo
  /** Every fetch the loader started, in call order, each waiting for `resolveFetch`. */
  calls: Array<{ promptId: string; d: Deferred<ActionResult> }>
  resolveUser(id?: string): Promise<unknown>
  /** Settles the latest fetch of `promptId`. */
  resolveFetch(promptId: string, value: ActionResult): Promise<unknown>
}

/** An io whose user lookup and every fetch the test settles by hand, to place each completion exactly. */
export function makeDeferredIo(act: Act): DeferredIo {
  const user = defer<string>()
  const calls: DeferredIo["calls"] = []
  const io: DocumentLoaderIo = {
    getUserId: () => user.promise,
    getStorage: () => null,
    fetchPrompt: (promptId) => {
      const d = defer<ActionResult>()
      calls.push({ promptId, d })
      return d.promise
    },
  }
  return {
    io,
    calls,
    resolveUser: (id = USER_ID) =>
      act(async () => {
        user.resolve(id)
      }),
    resolveFetch: (promptId, value) =>
      act(async () => {
        const call = calls.filter((c) => c.promptId === promptId).at(-1)
        if (!call) throw new Error(`no fetch was started for ${promptId}`)
        call.d.resolve(value)
      }),
  }
}

// ---- src/test/editor-env.ts (T7) ----

export interface Version {
  id: number
  promptId: string
  title: string | null
  content: string
}

type Input<K extends keyof DocumentActions> = Parameters<DocumentActions[K]>[0]

/** The name the tests use for each action, with the input that action takes. */
interface RequestInputs {
  save: Input<"saveNewVersion">
  autosave: Input<"autoSavePrompt">
  restore: Input<"restorePromptVersion">
}

export type RequestName = keyof RequestInputs
export type InputOf<N extends RequestName> = RequestInputs[N]

/** One request that reached the fake server. */
export type RecordedRequest = { [N in RequestName]: { name: N; input: RequestInputs[N] } }[RequestName]

/** `fetch` holds the document read; the others hold the action of that name. */
export type HoldName = RequestName | "fetch"

/** Releases every held call; `releaseOne` releases the oldest one only. */
export type Release = (() => void) & { releaseOne(): void }

/** `result` answers `{ success: false }`; `reject` throws as a dropped connection does. */
export type FailureMode = "result" | "reject"

export interface EditorEnv {
  rows: Map<string, Row>
  storage: FakeStorage
  state: { requests: RecordedRequest[]; versions: Version[]; nextVersionId: number }
  actions: DocumentActions
  io: DocumentLoaderIo
  /** Holds every later call of `name` until the returned function releases it. Calls queue in order. */
  hold(name: HoldName): Release
  /** Makes the next call of `name` fail once. */
  failNext(name: RequestName, mode?: FailureMode): void
  /** The names of the requests received so far, in order. */
  names(): RequestName[]
  /** The inputs of the requests of one kind, in order. */
  inputs<N extends RequestName>(name: N): Array<InputOf<N>>
}

/** Per-action holds and one-shot failures. */
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
  async function intercept(name: RequestName): Promise<{ success: false; error: string } | null> {
    await passGate(name)
    const mode = failures.get(name)
    if (!mode) return null
    failures.delete(name)
    if (mode === "reject") throw new Error("Failed to fetch")
    return { success: false, error: `${name} failed` }
  }

  return { hold, passGate, failNext, intercept }
}

/** A fake server: rows, versions, every request in call order, per-action holds and one-shot failures. */
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
  function pushVersion(promptId: string, title: string | null, content: string): Version {
    const mine = state.versions.filter((v) => v.promptId === promptId)
    const newest = mine[mine.length - 1]
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
      const version = pushVersion(input.promptId, input.newTitle, input.newContent)
      return { success: true, data: { versionId: version.id } }
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
    // Reason: filter cannot narrow a union by a generic key, so the cast restates what the filter has just established.
    inputs: <N extends RequestName>(name: N) => state.requests.filter((r) => r.name === name).map((r) => r.input as InputOf<N>),
  }
}
