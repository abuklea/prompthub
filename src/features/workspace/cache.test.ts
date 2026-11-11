/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/cache.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:09 GMT+10
Last modified: 29/10/2026 21:09 GMT+10
---------------
Unit tests of the workspace cache's bound viewer over the real module state (decision D5, issue #44): binding another
user empties every getter, a snapshot of another user is ignored once a viewer is bound, clearWorkspaceCache empties
everything and unbinds, a hydrate with no viewer bound adopts the snapshot's user, and the writers after a rebind hold
only the new viewer's data.

Changelog:
29/10/2026 21:09 GMT+10 | Created (P7S2T9)
*/
import { beforeEach, describe, expect, it } from "vitest"
import type { Folder } from "@prisma/client"
import {
  bindWorkspaceCacheViewer,
  clearWorkspaceCache,
  getFolderChildrenFromCache,
  getPromptFromCache,
  getPromptsByFolderFromCache,
  getRootFoldersFromCache,
  hasWorkspaceSnapshot,
  hydrateWorkspaceCache,
  removePromptFromCache,
  setPromptsForFolderInCache,
  upsertFolderInCache,
  upsertPromptInCache,
} from "./cache"

type Snapshot = Parameters<typeof hydrateWorkspaceCache>[0]
type SnapshotPrompt = Snapshot["prompts"][number]

const CREATED = new Date("2026-10-01T00:00:00.000Z")

function folder(userId: string, id: string, parentId: string | null): Folder {
  return { id, name: id, parent_id: parentId, user_id: userId, created_at: CREATED }
}

function prompt(userId: string, id: string, folderId: string): SnapshotPrompt {
  return {
    id,
    title: id,
    created_at: CREATED,
    updated_at: CREATED,
    user_id: userId,
    folder_id: folderId,
    folder: { id: folderId, name: folderId },
  }
}

/** A snapshot of one user: root folder `<prefix>-root` with child `<prefix>-child`, one prompt in each. */
function snapshot(userId: string, prefix: string): Snapshot {
  return {
    userId,
    folders: [folder(userId, `${prefix}-root`, null), folder(userId, `${prefix}-child`, `${prefix}-root`)],
    prompts: [prompt(userId, `${prefix}-p1`, `${prefix}-root`), prompt(userId, `${prefix}-p2`, `${prefix}-child`)],
    loadedAt: "2026-10-29T00:00:00.000Z",
  }
}

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id)

/** What every getter returns for the snapshot `snapshot(<user>, prefix)`. */
function visible(prefix: string) {
  return {
    roots: ids(getRootFoldersFromCache()),
    children: ids(getFolderChildrenFromCache(`${prefix}-root`)),
    rootPrompts: ids(getPromptsByFolderFromCache(`${prefix}-root`)),
    childPrompts: ids(getPromptsByFolderFromCache(`${prefix}-child`)),
    prompt: getPromptFromCache(`${prefix}-p1`)?.id ?? null,
    loaded: hasWorkspaceSnapshot(),
  }
}

const EMPTY = { roots: [], children: [], rootPrompts: [], childPrompts: [], prompt: null, loaded: false }

const FULL = (prefix: string) => ({
  roots: [`${prefix}-root`],
  children: [`${prefix}-child`],
  rootPrompts: [`${prefix}-p1`],
  childPrompts: [`${prefix}-p2`],
  prompt: `${prefix}-p1`,
  loaded: true,
})

beforeEach(() => clearWorkspaceCache())

describe("bindWorkspaceCacheViewer", () => {
  it("empties every getter when another user is bound after a hydrate", () => {
    hydrateWorkspaceCache(snapshot("user-1", "a"))
    expect(visible("a")).toEqual(FULL("a"))

    bindWorkspaceCacheViewer("user-2")

    expect(visible("a")).toEqual(EMPTY)
  })

  it("keeps the snapshot when the same user is bound again", () => {
    bindWorkspaceCacheViewer("user-1")
    hydrateWorkspaceCache(snapshot("user-1", "a"))

    bindWorkspaceCacheViewer("user-1")

    expect(visible("a")).toEqual(FULL("a"))
  })

  it("leaves the writers after a rebind holding only the new viewer's data", () => {
    hydrateWorkspaceCache(snapshot("user-1", "a"))
    bindWorkspaceCacheViewer("user-2")

    upsertFolderInCache(folder("user-2", "b-root", null))
    setPromptsForFolderInCache("b-root", [prompt("user-2", "b-p1", "b-root")])
    upsertPromptInCache(prompt("user-2", "b-p3", "b-root"))

    expect(ids(getRootFoldersFromCache())).toEqual(["b-root"])
    expect(ids(getPromptsByFolderFromCache("b-root"))).toEqual(["b-p1", "b-p3"])
    expect(getPromptFromCache("a-p1")).toBeUndefined()
    expect(getPromptFromCache("b-p3")?.folder).toBeNull()

    removePromptFromCache("b-p1", "b-root")
    expect(ids(getPromptsByFolderFromCache("b-root"))).toEqual(["b-p3"])
    expect(getPromptFromCache("b-p1")).toBeUndefined()
  })
})

describe("hydrateWorkspaceCache with a bound viewer", () => {
  it("ignores a snapshot of another user", () => {
    bindWorkspaceCacheViewer("user-2")

    hydrateWorkspaceCache(snapshot("user-1", "a"))

    expect(visible("a")).toEqual(EMPTY)
  })

  it("ignores a late snapshot of another user and keeps the viewer's own", () => {
    bindWorkspaceCacheViewer("user-2")
    hydrateWorkspaceCache(snapshot("user-2", "b"))

    hydrateWorkspaceCache(snapshot("user-1", "a"))

    expect(visible("b")).toEqual(FULL("b"))
    expect(getPromptFromCache("a-p1")).toBeUndefined()
  })
})

describe("clearWorkspaceCache", () => {
  it("empties everything and unbinds the viewer", () => {
    bindWorkspaceCacheViewer("user-1")
    hydrateWorkspaceCache(snapshot("user-1", "a"))

    clearWorkspaceCache()

    expect(visible("a")).toEqual(EMPTY)
    // Unbound: a snapshot of any user is adopted again.
    hydrateWorkspaceCache(snapshot("user-2", "b"))
    expect(visible("b")).toEqual(FULL("b"))
  })
})

describe("hydrateWorkspaceCache with no viewer bound", () => {
  it("adopts the snapshot's user, then ignores another user's snapshot", () => {
    hydrateWorkspaceCache(snapshot("user-1", "a"))
    expect(visible("a")).toEqual(FULL("a"))

    hydrateWorkspaceCache(snapshot("user-2", "b"))

    expect(visible("a")).toEqual(FULL("a"))
    expect(getPromptFromCache("b-p1")).toBeUndefined()
  })

  it("adopts the user, so binding that same user keeps the snapshot", () => {
    hydrateWorkspaceCache(snapshot("user-1", "a"))

    bindWorkspaceCacheViewer("user-1")

    expect(visible("a")).toEqual(FULL("a"))
  })
})
