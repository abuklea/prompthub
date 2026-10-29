/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/client-purge.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:09 GMT+10
Last modified: 29/10/2026 21:11 GMT+10
---------------
The sign-out purge (issue #44): empties every piece of client state that belongs to the signed-in user before the
session ends, so that nothing of it reaches the next user of the same browser tab. It clears the document cache and the
workspace cache, removes the browser drafts, resets the tab store (in memory and on disk) and the UI store's session
state. The storage is a seam; nothing here throws.

Changelog:
29/10/2026 21:11 GMT+10 | Created (P7S2T9; decisions Q7, D5, D8)
*/

import { clearDocumentCache } from "@/features/editor/document-cache"
import { clearWorkspaceCache } from "@/features/workspace/cache"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"

/** The part of the Web Storage API the purge uses; `window.localStorage` in the browser. */
export interface PurgeStorage {
  /** The number of stored keys. May throw when the browser blocks storage. */
  readonly length: number
  /** Returns the key at `index`, or null past the end. May throw when the browser blocks storage. */
  key(index: number): string | null
  /** Removes `key`. May throw when the browser blocks storage. */
  removeItem(key: string): void
}

/**
 * The prefix of every draft key: the draft `prompt-v1-<id>`, its stash `prompt-v1-<id>:conflict` and the legacy
 * `prompt-<id>`. With the hyphen: prompthub-tabs-state and prompthub:user-settings:v1 also start with "prompt".
 */
export const DRAFT_KEY_PREFIX = "prompt-"

/** @returns `window.localStorage`, or null on the server and when the browser blocks it (reading it can throw). */
function browserStorage(): PurgeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

/** Removes every draft key. Reason: the keys are collected first, because each removal shifts `key(index)`. */
function removeDraftKeys(storage: PurgeStorage | null): void {
  if (!storage) return
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key)
  }
  keys.forEach((key) => storage.removeItem(key))
}

/** Runs one purge step; a failure is logged and never stops the steps after it. */
function attempt(step: string, run: () => void): void {
  try {
    run()
  } catch (error) {
    console.error(`Sign-out purge: ${step} failed`, error)
  }
}

/**
 * Purges the signed-in user's client state; the Header calls it before `signOut()`. Each of its five steps runs even
 * when another fails, so a blocked or throwing storage skips only the draft removal.
 *
 * @param storage - Where the drafts are kept; `window.localStorage` by default, null when there is none.
 */
export function purgeClientState(storage: PurgeStorage | null = browserStorage()): void {
  attempt("the document cache", clearDocumentCache)
  attempt("the workspace cache", clearWorkspaceCache)
  attempt("the draft removal", () => removeDraftKeys(storage))
  attempt("the tab reset", () => useTabStore.getState().resetTabs())
  attempt("the session reset", () => useUiStore.getState().resetSession())
}
