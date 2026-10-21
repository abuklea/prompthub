/*
Project: PromptHub
Author: Allan James
Source: src/test/draft-world.ts
MIME: text/typescript
Type: TypeScript test fake

Created: 22/10/2026 09:34 GMT+10
Last modified: 22/10/2026 09:34 GMT+10
---------------
Helpers the draft protocol suites share, over the loader world of src/test/loader-world.ts: open a document with the
loader alone or with the loader and the draft writer composed as EditorPane composes them, type, let an autosave
succeed, read the three draft keys straight from the storage, and read the conflict toast's options from the mocked
sonner. A "reload" is an unmount followed by a new open against the same server and storage. The suites that use
`conflictToast` mock "sonner" (not a module of this repository).

Changelog:
22/10/2026 09:34 GMT+10 | Created from the helpers of the P7S1 draft spike suite (P7S1T6)
*/

import type { StrictMode } from "react"
import { vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { toast } from "sonner"
import { conflictKey, draftKey, legacyDraftKey, type DraftStorage } from "@/features/editor/draft"
import { useDocumentLoader, type DocumentLoader } from "@/features/editor/hooks/useDocumentLoader"
import { useDraftSync } from "@/features/editor/hooks/useDraftSync"
import { A, mountLoader, type LoaderHook, type LoaderProps, type World } from "./loader-world"

/** Render options: `wrapper: StrictMode` renders under React Strict Mode. */
export interface OpenOptions {
  /** A wrapper component; React's `StrictMode` in the Strict Mode cases. */
  wrapper?: typeof StrictMode
}

/**
 * Builds the raw value of a v1 draft envelope.
 * @param base - The hash of the server content the draft was written against.
 * @param content - The draft's text.
 * @returns The JSON the draft store keeps under `draftKey(id)`.
 */
export function v1(base: string, content: string): string {
  return JSON.stringify({ v: 1, base, content })
}

/** Lets the user lookup, the fetch and the effects they trigger run to completion. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

/**
 * Opens a document with the loader alone and waits for the load.
 * @param world - The server, storage and io.
 * @param promptId - The document; `A` when omitted.
 * @param options - Render options.
 * @returns The rendered loader.
 */
export async function openLoader(
  world: World<DraftStorage | null>,
  promptId: string = A,
  options: OpenOptions = {}
): Promise<LoaderHook> {
  const hook = mountLoader(world.io, promptId, options)
  await settle()
  return hook
}

/**
 * What EditorPane composes: the loader plus the only draft writer, reading the same storage seam.
 * @param props - The open document and the io.
 * @returns The loader.
 */
export function useEditor({ promptId, io }: LoaderProps): DocumentLoader {
  const loader = useDocumentLoader({ promptId, io })
  const { ready, content, synced } = loader
  useDraftSync({ promptId, ready, content, synced, getStorage: io.getStorage })
  return loader
}

/**
 * Opens a document with the loader and the draft writer composed, and waits for the load.
 * @param world - The server, storage and io.
 * @param promptId - The document; `A` when omitted.
 * @param options - Render options.
 * @returns The rendered composition; its result is the loader.
 */
export async function openEditor(
  world: World<DraftStorage | null>,
  promptId: string = A,
  options: OpenOptions = {}
): Promise<LoaderHook> {
  const hook = renderHook((props: LoaderProps) => useEditor(props), {
    initialProps: { promptId, io: world.io },
    ...options,
  })
  await settle()
  return hook
}

/**
 * Types into the open document: replaces its working content.
 * @param hook - The rendered loader or composition.
 * @param text - The new content.
 */
export function typeText(hook: LoaderHook, text: string): void {
  act(() => {
    hook.result.current.setContent(text)
  })
}

/**
 * The autosave's success path: the server now holds the working copy, and the editor learns it through markSynced.
 * @param world - The world whose server the write reaches.
 * @param hook - The rendered loader or composition.
 * @returns What markSynced returned: true when the document is still the open one.
 * @throws When the open document has no baseline yet.
 */
export function autosaveSucceeds(world: Pick<World<DraftStorage | null>, "server">, hook: LoaderHook): boolean {
  const { title, content, synced } = hook.result.current
  if (!synced) throw new Error("the document has no baseline")
  world.server.set(synced.promptId, { title, content })
  let accepted = false
  act(() => {
    accepted = hook.result.current.markSynced({ promptId: synced.promptId, title, content })
  })
  return accepted
}

/** @returns The raw value under the v1 draft key of `id` (`A` when omitted), or null. */
export const stored = (storage: DraftStorage, id: string = A): string | null => storage.getItem(draftKey(id))

/** @returns The raw value under the legacy draft key of `id` (`A` when omitted), or null. */
export const storedLegacy = (storage: DraftStorage, id: string = A): string | null =>
  storage.getItem(legacyDraftKey(id))

/** @returns The text stashed under the conflict key of `id` (`A` when omitted), or null. */
export const storedConflict = (storage: DraftStorage, id: string = A): string | null =>
  storage.getItem(conflictKey(id))

/**
 * Parses the v1 draft stored for a document.
 * @param storage - The storage.
 * @param id - The document; `A` when omitted.
 * @returns The parsed envelope, or null when nothing is stored, so a missing draft fails the assertion that reads it.
 */
export function draftOf(storage: DraftStorage, id: string = A): { v: number; base: string; content: string } | null {
  const raw = stored(storage, id)
  return raw === null ? null : (JSON.parse(raw) as { v: number; base: string; content: string })
}

/** The options of a conflict toast: its duration and its one action. */
export interface ConflictToastOptions {
  /** How long the toast stays, in milliseconds. */
  duration: number
  /** The action that puts the stashed text back into the editor. */
  action: { label: string; onClick(): void }
}

/**
 * Reads the options of the first warning toast from the mocked sonner.
 * @returns The options the loader showed the conflict toast with.
 * @throws When no warning toast was shown.
 */
export function conflictToast(): ConflictToastOptions {
  const call = vi.mocked(toast.warning).mock.calls[0]
  if (!call) throw new Error("no warning toast was shown")
  return call[1] as unknown as ConflictToastOptions
}
