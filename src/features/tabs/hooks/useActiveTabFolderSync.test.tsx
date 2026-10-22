// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/tabs/hooks/useActiveTabFolderSync.test.tsx
MIME: text/typescript
Type: TypeScript React test (Vitest, jsdom)

Created: 22/10/2026 14:37 GMT+10
Last modified: 22/10/2026 14:37 GMT+10
---------------
Unit tests of useActiveTabFolderSync over the real tab and UI stores: the folder tree follows the active document tab
only when that tab changes (mount, activation, its folder changing), never undoing a folder the user selects, and a
non-document tab leaves the selection alone (#95).

Changelog:
22/10/2026 14:37 GMT+10 | Created (#95)
*/

import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { TabData } from "@/features/tabs/types"
import { hydrateWorkspaceCache } from "@/features/workspace/cache"
import { useTabStore } from "@/stores/use-tab-store"
import { useUiStore } from "@/stores/use-ui-store"
import { useActiveTabFolderSync } from "./useActiveTabFolderSync"

const TABS: readonly TabData[] = [
  { id: "tab-A", type: "document", title: "A", promptId: "prompt-A", folderId: "folder-A" },
  { id: "tab-B", type: "document", title: "B", promptId: "prompt-B", folderId: "folder-B" },
  { id: "tab-settings", type: "settings", title: "Settings" },
]

/** Resets both stores to the given active tab and selection, and empties the workspace cache. */
function reset(activeTabId: string, selectedFolder: string | null = null, tabs: readonly TabData[] = TABS): void {
  window.localStorage.clear()
  hydrateWorkspaceCache({ userId: "user-1", folders: [], prompts: [], loadedAt: "" })
  useTabStore.setState({ tabs: tabs.map((tab) => ({ ...tab })), activeTabId })
  useUiStore.setState({ selectedFolder, selectedPrompt: null, prompts: [] })
}

/** The folder and document the browser panels show. */
const selection = () => {
  const { selectedFolder, selectedPrompt } = useUiStore.getState()
  return { selectedFolder, selectedPrompt }
}

/** A folder click in the tree (FolderItem). */
const clickFolder = (folderId: string) => act(() => useUiStore.getState().selectFolder(folderId))

const activate = (tabId: string) => act(() => useTabStore.getState().setActiveTab(tabId))

const updateTab = (tabId: string, updates: Partial<TabData>) =>
  act(() => useTabStore.getState().updateTab(tabId, updates))

beforeEach(() => reset("tab-A"))
afterEach(cleanup)

describe("the active document tab drives the selection when it changes", () => {
  it("on mount, selects the active tab's folder and then its document", () => {
    renderHook(() => useActiveTabFolderSync())
    expect(selection()).toEqual({ selectedFolder: "folder-A", selectedPrompt: "prompt-A" })
  })

  it("on mount, selects the document without clearing it when its folder is already selected", () => {
    reset("tab-A", "folder-A")
    renderHook(() => useActiveTabFolderSync())
    expect(selection()).toEqual({ selectedFolder: "folder-A", selectedPrompt: "prompt-A" })
  })

  it("activating another document tab moves the selection to that tab's folder and document", () => {
    renderHook(() => useActiveTabFolderSync())
    activate("tab-B")
    expect(selection()).toEqual({ selectedFolder: "folder-B", selectedPrompt: "prompt-B" })
  })

  it("the active tab's folder changing (a move, or the folder arriving after the load) moves the selection", () => {
    renderHook(() => useActiveTabFolderSync())
    updateTab("tab-A", { folderId: "folder-C" })
    expect(selection()).toEqual({ selectedFolder: "folder-C", selectedPrompt: "prompt-A" })
  })

  it("re-activating a document tab after a settings tab selects its folder again", () => {
    renderHook(() => useActiveTabFolderSync())
    clickFolder("folder-X")
    activate("tab-settings")
    activate("tab-A")
    expect(selection()).toEqual({ selectedFolder: "folder-A", selectedPrompt: "prompt-A" })
  })

  it("a tab without a folder id takes its folder from the workspace cache", () => {
    const now = new Date("2026-10-22T04:00:00Z")
    reset("tab-N", null, [{ id: "tab-N", type: "document", title: "N", promptId: "prompt-N" }])
    hydrateWorkspaceCache({
      userId: "user-1",
      folders: [],
      prompts: [{
        id: "prompt-N", title: "N", created_at: now, updated_at: now, user_id: "user-1", folder_id: "folder-N",
        folder: { id: "folder-N", name: "N folder" },
      }],
      loadedAt: now.toISOString(),
    })
    renderHook(() => useActiveTabFolderSync())
    expect(selection()).toEqual({ selectedFolder: "folder-N", selectedPrompt: "prompt-N" })
  })

  it("a tab whose folder cannot be resolved selects its document and leaves the folder alone", () => {
    reset("tab-N", "folder-X", [{ id: "tab-N", type: "document", title: "N", promptId: "prompt-N" }])
    renderHook(() => useActiveTabFolderSync())
    expect(selection()).toEqual({ selectedFolder: "folder-X", selectedPrompt: "prompt-N" })
  })
})

describe("the user's folder selection is never undone by the sync", () => {
  it("a folder selected while a document tab is active stays selected", () => {
    renderHook(() => useActiveTabFolderSync())
    clickFolder("folder-X")
    expect(selection()).toEqual({ selectedFolder: "folder-X", selectedPrompt: null })
  })

  it("it stays selected after the active tab's dirty flag and title change", () => {
    renderHook(() => useActiveTabFolderSync())
    clickFolder("folder-X")
    updateTab("tab-A", { isDirty: true })
    updateTab("tab-A", { title: "A renamed", isPreview: false })
    expect(selection()).toEqual({ selectedFolder: "folder-X", selectedPrompt: null })
  })

  it("re-selecting the already active tab leaves the user's folder selected", () => {
    renderHook(() => useActiveTabFolderSync())
    clickFolder("folder-X")
    activate("tab-A")
    expect(selection()).toEqual({ selectedFolder: "folder-X", selectedPrompt: null })
  })

  it("a non-document tab leaves the selection alone", () => {
    reset("tab-settings", "folder-X")
    renderHook(() => useActiveTabFolderSync())
    expect(selection()).toEqual({ selectedFolder: "folder-X", selectedPrompt: null })
    clickFolder("folder-Y")
    activate("tab-settings")
    expect(selection()).toEqual({ selectedFolder: "folder-Y", selectedPrompt: null })
  })
})
