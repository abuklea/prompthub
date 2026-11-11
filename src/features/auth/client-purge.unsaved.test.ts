// @vitest-environment jsdom
/*
Project: PromptHub
Author: Allan James
Source: src/features/auth/client-purge.unsaved.test.ts
MIME: text/typescript
Type: TypeScript Module (Vitest, jsdom)

Created: 29/10/2026 21:28 GMT+10
Last modified: 29/10/2026 21:28 GMT+10
---------------
Unit tests of hasUnsavedClientWork over the real window.localStorage and the real tab store (decision D10, issue
#120): a dirty tab or any draft key (the draft, its conflict stash, the legacy draft) is unsaved work, the settings key
and the persisted tab state are not, and a blocked or missing storage counts as no draft while a dirty tab still counts.

Changelog:
29/10/2026 21:28 GMT+10 | Created (P7S2T14)
*/

import { beforeEach, describe, expect, it } from "vitest"
import { useTabStore } from "@/stores/use-tab-store"
import { hasUnsavedClientWork, type PurgeStorage } from "./client-purge"

const TABS_KEY = "prompthub-tabs-state"
const SETTINGS_KEY = "prompthub:user-settings:v1"

/** A storage whose every member throws, as a browser that blocks storage does. */
const blockedStorage: PurgeStorage = {
  get length(): number {
    throw new Error("storage blocked")
  },
  key: () => {
    throw new Error("storage blocked")
  },
  removeItem: () => {
    throw new Error("storage blocked")
  },
}

/** Opens two clean document tabs, so the tab store also persists its state under TABS_KEY. */
function openCleanTabs(): void {
  useTabStore.setState({ tabs: [], activeTabId: null })
  const { openTab } = useTabStore.getState()
  openTab({ type: "document", title: "Plan A", promptId: "a", folderId: "f1" })
  openTab({ type: "document", title: "Plan B", promptId: "b", folderId: "f1" })
}

/** Marks the first open tab dirty, as useDocumentCacheSync does when the working text differs from the server's. */
function dirtyFirstTab(): void {
  const { tabs, updateTab } = useTabStore.getState()
  updateTab(tabs[0].id, { isDirty: true })
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ preloadWorkspaceOnLaunch: false }))
  openCleanTabs()
})

describe("hasUnsavedClientWork with the browser storage", () => {
  it("is false with no dirty tab and no draft key, the settings and tab-state keys present", () => {
    expect(window.localStorage.getItem(TABS_KEY)).toContain("Plan A")
    expect(window.localStorage.getItem(SETTINGS_KEY)).not.toBeNull()

    expect(hasUnsavedClientWork()).toBe(false)
  })

  it("is true when a tab is dirty", () => {
    dirtyFirstTab()

    expect(hasUnsavedClientWork()).toBe(true)
  })

  it.each([
    ["a draft", "prompt-v1-a"],
    ["a conflict stash", "prompt-v1-a:conflict"],
    ["a legacy draft", "prompt-a"],
  ])("is true when the storage holds %s (%s)", (_kind, key) => {
    window.localStorage.setItem(key, "kept text")

    expect(hasUnsavedClientWork()).toBe(true)
  })
})

describe("hasUnsavedClientWork with a blocked or missing storage", () => {
  it("is false when the storage throws and no tab is dirty, and does not throw", () => {
    window.localStorage.setItem("prompt-v1-a", "a draft the blocked storage cannot show")

    expect(hasUnsavedClientWork(blockedStorage)).toBe(false)
  })

  it("is true when the storage throws but a tab is dirty", () => {
    dirtyFirstTab()

    expect(hasUnsavedClientWork(blockedStorage)).toBe(true)
  })

  it("is false with no storage and no dirty tab, and true with no storage and a dirty tab", () => {
    expect(hasUnsavedClientWork(null)).toBe(false)

    dirtyFirstTab()

    expect(hasUnsavedClientWork(null)).toBe(true)
  })
})
