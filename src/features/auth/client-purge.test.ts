// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/client-purge.test.ts
MIME: text/typescript
Type: TypeScript Module (Vitest, jsdom)

Created: 29/10/2026 21:09 GMT+10
Last modified: 29/10/2026 21:09 GMT+10
---------------
Unit tests of purgeClientState over the real window.localStorage, the real tab and UI stores, the document cache and
the workspace cache (issue #44, decisions Q7, D5, D8): the drafts, their conflict stashes and the legacy drafts go, the
settings key stays, the persisted tab state keeps no title, both caches and the UI selection are emptied, and a
blocked or missing storage skips only the key removal.

Changelog:
29/10/2026 21:09 GMT+10 | Created (P7S2T9)
*/

import { beforeEach, describe, expect, it } from "vitest"
import { getCachedDocument, setDocumentCacheEntry } from "@/features/editor/document-cache"
import {
  bindWorkspaceCacheViewer,
  getPromptFromCache,
  getRootFoldersFromCache,
  hasWorkspaceSnapshot,
  hydrateWorkspaceCache,
} from "@/features/workspace/cache"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import { cacheEntryFor, USER_ID } from "@/test/loader-world"
import { DRAFT_KEY_PREFIX, purgeClientState, type PurgeStorage } from "./client-purge"

const TABS_KEY = "prompthub-tabs-state"
const SETTINGS_KEY = "prompthub:user-settings:v1"
const SETTINGS = JSON.stringify({ preloadWorkspaceOnLaunch: false })
const CREATED = new Date("2026-10-01T00:00:00.000Z")

/** Fills the storage, both stores and both caches with the state of a signed-in user. */
function seedSignedInUser(): void {
  window.localStorage.clear()
  window.localStorage.setItem("prompt-v1-a", JSON.stringify({ v: 1, content: "A draft", base: "1:x" }))
  window.localStorage.setItem("prompt-v1-a:conflict", "A lost text")
  window.localStorage.setItem("prompt-b", "B legacy draft")
  window.localStorage.setItem(SETTINGS_KEY, SETTINGS)

  useTabStore.setState({ tabs: [], activeTabId: null })
  const { openTab, updateTab } = useTabStore.getState()
  openTab({ type: "document", title: "Secret plan A", promptId: "a", folderId: "f1" })
  openTab({ type: "document", title: "Secret plan B", promptId: "b", folderId: "f1" })
  updateTab(useTabStore.getState().tabs[0].id, { isPinned: true })

  setDocumentCacheEntry(USER_ID, "a", cacheEntryFor("a", "Secret plan A", "A content"))
  bindWorkspaceCacheViewer(USER_ID)
  hydrateWorkspaceCache({
    userId: USER_ID,
    folders: [{ id: "f1", name: "Folder", parent_id: null, user_id: USER_ID, created_at: CREATED }],
    prompts: [{
      id: "a", title: "Secret plan A", created_at: CREATED, updated_at: CREATED, user_id: USER_ID, folder_id: "f1",
      folder: { id: "f1", name: "Folder" },
    }],
    loadedAt: CREATED.toISOString(),
  })

  useUiStore.setState({
    expandedFolders: new Set(["f1"]),
    selectedFolder: "f1",
    selectedPrompt: "a",
    prompts: [
      { id: "a", title: "Secret plan A", user_id: USER_ID, folder_id: "f1", created_at: CREATED, updated_at: CREATED },
    ],
    folderFilter: "sec",
    docFilter: "plan",
    selectedTagIds: ["t1"],
    workspaceLoadedAt: CREATED.toISOString(),
    folderSort: "name-desc",
    docSort: "date-desc",
    folderRefetchTrigger: 3,
    promptRefetchTrigger: 4,
  })
}

const storageKeys = (): string[] => Object.keys(window.localStorage)

/** Asserts that every in-memory part of the signed-in user's state is gone and the user's preferences stayed. */
function expectMemoryPurged(): void {
  const tabs = useTabStore.getState()
  expect(tabs.tabs).toEqual([])
  expect(tabs.activeTabId).toBeNull()
  expect(tabs.layout).toEqual({ type: "panel", tabId: "", tabs: [] })

  expect(getCachedDocument(USER_ID, "a")).toBeNull()
  expect(getRootFoldersFromCache()).toEqual([])
  expect(getPromptFromCache("a")).toBeUndefined()
  expect(hasWorkspaceSnapshot()).toBe(false)

  const ui = useUiStore.getState()
  expect({
    expandedFolders: Array.from(ui.expandedFolders),
    selectedFolder: ui.selectedFolder,
    selectedPrompt: ui.selectedPrompt,
    prompts: ui.prompts,
    folderFilter: ui.folderFilter,
    docFilter: ui.docFilter,
    selectedTagIds: ui.selectedTagIds,
    workspaceLoadedAt: ui.workspaceLoadedAt,
  }).toEqual({
    expandedFolders: [],
    selectedFolder: null,
    selectedPrompt: null,
    prompts: [],
    folderFilter: "",
    docFilter: "",
    selectedTagIds: [],
    workspaceLoadedAt: null,
  })
  // Sort orders and refetch counters are preferences and triggers, not the user's data: they stay.
  expect([ui.folderSort, ui.docSort, ui.folderRefetchTrigger, ui.promptRefetchTrigger]).toEqual([
    "name-desc", "date-desc", 3, 4,
  ])
}

beforeEach(seedSignedInUser)

describe("purgeClientState with the browser storage", () => {
  it("starts from a seeded user whose tab titles are persisted", () => {
    expect(window.localStorage.getItem(TABS_KEY)).toContain("Secret plan B")
    expect(storageKeys().filter((key) => key.startsWith(DRAFT_KEY_PREFIX))).toHaveLength(3)
  })

  it("removes every draft, conflict stash and legacy draft key and keeps the settings key", () => {
    purgeClientState()

    expect(storageKeys().filter((key) => key.startsWith("prompt-"))).toEqual([])
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBe(SETTINGS)
  })

  it("leaves Zustand's envelope with no tab on disk, so no title of the previous user remains", () => {
    purgeClientState()

    const persisted = JSON.parse(window.localStorage.getItem(TABS_KEY) ?? "null")
    expect(persisted).toEqual({ state: { tabs: [], activeTabId: null }, version: 0 })
  })

  it("empties the tabs (pinned included), both caches and the UI store's session state", () => {
    purgeClientState()

    expectMemoryPurged()
  })
})

describe("purgeClientState with a blocked or missing storage", () => {
  it("still clears the memory state when the storage's key throws, and does not throw", () => {
    const blocked: PurgeStorage = {
      length: 3,
      key: () => {
        throw new Error("storage blocked")
      },
      removeItem: () => {
        throw new Error("storage blocked")
      },
    }

    expect(() => purgeClientState(blocked)).not.toThrow()

    expectMemoryPurged()
  })

  it("still clears the memory state when there is no storage", () => {
    purgeClientState(null)

    expectMemoryPurged()
    expect(window.localStorage.getItem("prompt-b")).toBe("B legacy draft")
  })
})
