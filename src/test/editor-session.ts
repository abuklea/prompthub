/*
Project: PromptHub
Author: Allan James
Source: src/test/editor-session.ts
MIME: text/typescript
Type: TypeScript test helper

Created: 22/10/2026 10:15 GMT+10
Last modified: 22/10/2026 10:15 GMT+10
---------------
The render helpers the persistence suites share, over the fake server of src/test/editor-env.ts: a session that
composes the real loader with useDocumentPersistence as EditorPane does, opening and switching documents, typing,
editing the title, Ctrl+S, driving the fake clock, and a reset of the real stores for each test.

Changelog:
22/10/2026 10:15 GMT+10 | Created from the helpers of the P7S1 persistence spike suite (P7S1T7)
*/

import type { StrictMode } from "react"
import { vi } from "vitest"
import { act, renderHook, type RenderHookResult } from "@testing-library/react"
import type { DocumentActions } from "@/features/editor/document-actions"
import { clearDocumentCache } from "@/features/editor/document-cache"
import type { DocumentLoaderIo } from "@/features/editor/loader-protocol"
import { useDocumentLoader, type DocumentLoader } from "@/features/editor/hooks/useDocumentLoader"
import { useDocumentPersistence, type DocumentPersistence } from "@/features/editor/hooks/useDocumentPersistence"
import type { TabData } from "@/features/tabs/types"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import type { EditorEnv } from "./editor-env"
import { A, B } from "./loader-world"

/** The two tabs every persistence suite starts with: a preview tab for `A` and a tab for `B`. */
export const START_TABS: readonly TabData[] = [
  { id: "tab-A", type: "document", title: "A", promptId: A, isPreview: true },
  { id: "tab-B", type: "document", title: "B", promptId: B },
]

/** The beforeEach of a persistence suite: fake timers, cleared mocks, a silent console.error and fresh stores. */
export function resetEditorWorld(): void {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  clearDocumentCache()
  window.localStorage.clear()
  useTabStore.setState({ tabs: START_TABS.map((tab) => ({ ...tab })), activeTabId: "tab-A" })
  useUiStore.setState({ promptRefetchTrigger: 0, prompts: [] })
}

/** The props of the composed editor session. */
export interface SessionProps {
  /** The open document. */
  promptId: string
  /** The tab that shows it. */
  tabId: string
  /** The loader's io. */
  io: DocumentLoaderIo
  /** The injected actions. */
  actions: DocumentActions
}

/** What the session renders: the loader and the persistence hook over it. */
export interface Session {
  /** The document loader. */
  loader: DocumentLoader
  /** The persistence hook's result. */
  persistence: DocumentPersistence
}

/** A rendered session. */
export type SessionHook = RenderHookResult<Session, SessionProps>

/**
 * What EditorPane composes: the loader and the persistence hook, sharing the io's storage seam.
 * @param props - The document, its tab, the io and the actions.
 * @returns The loader and the persistence result.
 */
export function useSession({ promptId, tabId, io, actions }: SessionProps): Session {
  const loader = useDocumentLoader({ promptId, io })
  const persistence = useDocumentPersistence({ promptId, tabId, loader, actions, getStorage: io.getStorage })
  return { loader, persistence }
}

/**
 * Advances the fake clock inside `act`, then flushes the promises the timers released.
 * @param ms - How far to advance, in milliseconds; 0 when omitted.
 */
export async function tick(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

/** Lets the user lookup, the fetch, a released request and the effects they trigger run to completion. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) await tick(0)
}

/** Options of `open`. */
export interface OpenOptions {
  /** The document; `A` when omitted. */
  promptId?: string
  /** Its tab; `tab-A` when omitted. */
  tabId?: string
  /** The actions; the env's own when omitted. */
  actions?: DocumentActions
  /** React's `StrictMode` in the Strict Mode cases. */
  wrapper?: typeof StrictMode
}

/**
 * Renders the session for a document and waits for the load.
 * @param env - The fake server.
 * @param options - The document, tab, actions and wrapper.
 * @returns The rendered session.
 */
export async function open(env: EditorEnv, options: OpenOptions = {}): Promise<SessionHook> {
  const { promptId = A, tabId = "tab-A", actions = env.actions, wrapper } = options
  const hook = renderHook((props: SessionProps) => useSession(props), {
    initialProps: { promptId, tabId, io: env.io, actions },
    wrapper,
  })
  await settle()
  return hook
}

/**
 * Switches the session to another document and waits for its load.
 * @param hook - The rendered session.
 * @param env - The fake server.
 * @param promptId - The document to switch to.
 * @param tabId - Its tab.
 * @param actions - The actions; the env's own when omitted.
 */
export async function goTo(
  hook: SessionHook,
  env: EditorEnv,
  promptId: string,
  tabId: string,
  actions: DocumentActions = env.actions
): Promise<void> {
  hook.rerender({ promptId, tabId, io: env.io, actions })
  await settle()
}

/**
 * Types into the open document: replaces its working content.
 * @param hook - The rendered session.
 * @param text - The new content.
 */
export function typeContent(hook: SessionHook, text: string): void {
  act(() => {
    hook.result.current.loader.setContent(text)
  })
}

/**
 * Edits the working title of the open document.
 * @param hook - The rendered session.
 * @param title - The new title.
 */
export function setTitle(hook: SessionHook, title: string | null): void {
  act(() => {
    hook.result.current.loader.setTitle(title)
  })
}

/**
 * Presses Ctrl+S (or another modifier with S) on the window.
 * @param modifiers - The modifier keys; Ctrl when omitted.
 */
export function pressCtrlS(modifiers: KeyboardEventInit = { ctrlKey: true }): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", cancelable: true, ...modifiers }))
  })
}

/**
 * Reads a tab from the real tab store.
 * @param id - The tab id.
 * @returns The tab, or undefined.
 */
export const tabOf = (id: string): TabData | undefined => useTabStore.getState().tabs.find((t) => t.id === id)
