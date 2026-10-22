/*
Project: PromptHub
Author: Allan James
Source: src/test/loader-world.ts
MIME: text/typescript
Type: TypeScript test fake

Created: 22/10/2026 09:10 GMT+10
Last modified: 22/10/2026 09:10 GMT+10
---------------
The document loader's test world, injected through the DocumentLoaderIo seam of
src/features/editor/loader-protocol.ts: shared ids, the prompt row the fetch returns, a world that answers every
lookup at once over a map of rows, a deferred io whose user lookup and fetches a test settles by hand, and the render
helpers the loader suites share. Nothing here mocks a module of this repository.

Changelog:
22/10/2026 09:10 GMT+10 | Created from the loader part of the P7S1 test fakes, with the shared render helpers (P7S1T5)
*/

import type { StrictMode } from "react"
import { expect } from "vitest"
import { renderHook, type RenderHookResult } from "@testing-library/react"
import type { CacheEntry, PromptWithFolder } from "@/features/editor/document-cache"
import type { DraftStorage } from "@/features/editor/draft"
import type { DocumentLoaderIo } from "@/features/editor/loader-protocol"
import { useDocumentLoader, type DocumentLoader } from "@/features/editor/hooks/useDocumentLoader"
import type { ActionResult } from "@/types/actions"
import { makeStorage, type FakeStorage } from "./storage-fake"

/** The first test document. */
export const A = "11111111-1111-4111-8111-111111111111"
/** The second test document. */
export const B = "22222222-2222-4222-8222-222222222222"
/** The third test document. */
export const C = "33333333-3333-4333-8333-333333333333"
/** The `created_at` and `updated_at` of every row the fakes return. */
export const NOW = new Date("2026-10-20T01:00:00.000Z")
/** The signed-in user the fakes report. */
export const USER_ID = "user-1"

/** What the fake server holds for one document. */
export interface Row {
  /** The stored title; null for a document never titled. */
  title: string | null
  /** The stored text. */
  content: string
}

/** The row the production fetch returns: the prompt, its folder and the (always empty) tags. */
export type FetchedRow = PromptWithFolder & { tags: never[] }

/**
 * Builds the row the document fetch returns for a document.
 * @param id - The document id.
 * @param row - Its title and content.
 * @returns The prompt row, stamped with `NOW`, owned by `USER_ID`, in folder `f1`.
 */
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

/**
 * Builds a successful fetch result; the narrow type lets a test read `.data` without a guard.
 * @param id - The document id.
 * @param title - Its title.
 * @param content - Its content.
 * @returns `{ success: true, data }` with the row of `promptRow`.
 */
export function serverRow(id: string, title: string | null, content: string): { success: true; data: FetchedRow } {
  return { success: true, data: promptRow(id, { title, content }) }
}

/** A server (rows by id), a storage and the io seam the loader reads: real promises, no mocks of repository modules. */
export interface World<S extends DraftStorage | null = FakeStorage> {
  /** The rows the fetch answers with, by document id; a missing id answers "Prompt not found". */
  server: Map<string, Row>
  /** The storage `io.getStorage()` returns. */
  storage: S
  /** The io to pass to the loader: the user is `USER_ID` and every lookup settles at once. */
  io: DocumentLoaderIo
}

/**
 * Builds a world whose user lookup and fetches resolve at once.
 * @param rows - The server's rows by document id.
 * @param storage - The storage the io returns; a fresh `makeStorage()` when omitted.
 * @returns The server map, the storage and the io.
 */
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
      const result: ActionResult = row
        ? { success: true, data: promptRow(id, row) }
        : { success: false, error: "Prompt not found" }
      return Promise.resolve(result)
    },
    getStorage: () => storage,
  }
  return { server, storage, io }
}

/** A promise with its settle functions exposed. */
export interface Deferred<T> {
  /** The pending promise. */
  promise: Promise<T>
  /** Fulfils the promise. */
  resolve(value: T): void
  /** Rejects the promise. */
  reject(reason: unknown): void
}

/**
 * Builds a promise that the caller settles.
 * @returns The promise with its `resolve` and `reject`.
 */
export function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Testing Library's `act`, passed in by the caller, as the reference suites do. */
export type Act = (callback: () => Promise<void>) => Promise<unknown>

/** An io whose user lookup and every fetch the test settles by hand. */
export interface DeferredIo {
  /** The io to pass to the loader; its storage is null. */
  io: DocumentLoaderIo
  /** Every fetch the loader started, in call order, each waiting for `resolveFetch`. */
  calls: Array<{ promptId: string; d: Deferred<ActionResult> }>
  /**
   * Resolves the user lookup inside `act`.
   * @param id - The user id; `USER_ID` when omitted.
   */
  resolveUser(id?: string): Promise<unknown>
  /**
   * Settles the latest fetch of `promptId` inside `act`.
   * @throws When no fetch of `promptId` was started.
   */
  resolveFetch(promptId: string, value: ActionResult): Promise<unknown>
}

/**
 * Builds an io whose user lookup and fetches the test settles by hand, to place each completion exactly.
 * @param act - Testing Library's `act`, so each settlement flushes React's updates.
 * @returns The io, the started fetches and the settle helpers.
 */
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

/** The props the loader hook takes. */
export interface LoaderProps {
  /** The open document; "" for none. */
  promptId: string
  /** The loader's io. */
  io: DocumentLoaderIo
}

/** A rendered loader hook. */
export type LoaderHook = RenderHookResult<DocumentLoader, LoaderProps>

/**
 * Renders the loader hook.
 * @param io - The io the loader reads.
 * @param promptId - The document to open; `A` when omitted.
 * @param options - `wrapper: StrictMode` renders under React Strict Mode.
 * @returns Testing Library's render result, whose `rerender` takes new `LoaderProps`.
 */
export function mountLoader(
  io: DocumentLoaderIo,
  promptId: string = A,
  options: { wrapper?: typeof StrictMode } = {}
): LoaderHook {
  return renderHook((props: LoaderProps) => useDocumentLoader(props), { initialProps: { promptId, io }, ...options })
}

/**
 * Asserts that the loader shows one document, applied and ready. Title and content are checked first, so a load that
 * ended without the document fails on what the user would see.
 * @param result - The rendered hook's result.
 * @param id - The document that must be open.
 * @param title - Its expected title.
 * @param content - Its expected content, which is also the expected baseline.
 */
export function expectReady(result: LoaderHook["result"], id: string, title: string | null, content: string): void {
  const s = result.current
  expect(s.title).toBe(title)
  expect(s.content).toBe(content)
  expect(s.loading).toBe(false)
  expect(s.ready).toBe(true)
  expect(s.monacoPromptIdRef.current).toBe(id)
  expect(s.synced).toEqual({ promptId: id, title, content })
}

/**
 * Builds a cache entry whose working copy equals its baseline.
 * @param id - The document id.
 * @param title - Its title.
 * @param content - Its content.
 * @returns The entry without its user id, saved at `NOW`.
 */
export function cacheEntryFor(id: string, title: string | null, content: string): Omit<CacheEntry, "userId"> {
  return {
    promptData: serverRow(id, title, content).data,
    title,
    content,
    lastSaved: NOW,
    synced: { promptId: id, title, content },
  }
}
