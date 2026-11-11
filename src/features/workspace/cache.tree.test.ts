/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/cache.tree.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 20:53 GMT+10
Last modified: 29/10/2026 20:53 GMT+10
---------------
Unit tests of removeFolderTreeFromCache over the real workspace cache module: after a folder delete it drops every
returned folder id from every parent list and map key, the prompt lists of those folders and every returned prompt
entry, refreshes the root folders, and leaves siblings and unrelated entries alone.

Changelog:
29/10/2026 20:53 GMT+10 | Created (P7S2T5, issue #113)
*/
import { beforeEach, describe, expect, it } from "vitest"
import type { Folder } from "@prisma/client"
import {
  getFolderChildrenFromCache,
  getPromptFromCache,
  getPromptsByFolderFromCache,
  getRootFoldersFromCache,
  hydrateWorkspaceCache,
  removeFolderTreeFromCache,
  upsertFolderInCache,
} from "./cache"

type Snapshot = Parameters<typeof hydrateWorkspaceCache>[0]
type SnapshotPrompt = Snapshot["prompts"][number]

const USER = "user-1"
const CREATED = new Date("2026-10-01T00:00:00.000Z")

function folder(id: string, name: string, parentId: string | null): Folder {
  return { id, name, parent_id: parentId, user_id: USER, created_at: CREATED }
}

function prompt(id: string, folderId: string | null): SnapshotPrompt {
  return {
    id,
    title: id,
    created_at: CREATED,
    updated_at: CREATED,
    user_id: USER,
    folder_id: folderId,
    folder: folderId ? { id: folderId, name: folderId } : null,
  }
}

// Two root folders. R holds A (with child A1) and B; S holds S1. Every folder holds one prompt, and one is unfiled.
const R = folder("R", "Root R", null)
const S = folder("S", "Root S", null)
const A = folder("A", "Alpha", "R")
const A1 = folder("A1", "Alpha child", "A")
const B = folder("B", "Beta", "R")
const S1 = folder("S1", "Sigma child", "S")

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id)

beforeEach(() => {
  hydrateWorkspaceCache({
    userId: USER,
    folders: [R, S, A, A1, B, S1],
    prompts: [
      prompt("pR", "R"),
      prompt("pA", "A"),
      prompt("pA1", "A1"),
      prompt("pB", "B"),
      prompt("pS", "S"),
      prompt("pS1", "S1"),
      prompt("pFree", null),
    ],
    loadedAt: "2026-10-29T00:00:00.000Z",
  })
})

describe("removeFolderTreeFromCache", () => {
  it("removes a nested tree from its parent's list and leaves the sibling", () => {
    removeFolderTreeFromCache({ folderIds: ["A", "A1"], promptIds: ["pA", "pA1"] })

    expect(ids(getFolderChildrenFromCache("R"))).toEqual(["B"])
    expect(getFolderChildrenFromCache("A")).toEqual([])
    expect(ids(getRootFoldersFromCache())).toEqual(["R", "S"])
    expect(ids(getFolderChildrenFromCache("S"))).toEqual(["S1"])
  })

  it("drops the prompt lists of the deleted folders and keeps the others", () => {
    removeFolderTreeFromCache({ folderIds: ["A", "A1"], promptIds: ["pA", "pA1"] })

    expect(getPromptsByFolderFromCache("A")).toEqual([])
    expect(getPromptsByFolderFromCache("A1")).toEqual([])
    expect(ids(getPromptsByFolderFromCache("R"))).toEqual(["pR"])
    expect(ids(getPromptsByFolderFromCache("B"))).toEqual(["pB"])
  })

  it("drops every returned prompt entry and keeps the others", () => {
    removeFolderTreeFromCache({ folderIds: ["A", "A1"], promptIds: ["pA", "pA1"] })

    expect(getPromptFromCache("pA")).toBeUndefined()
    expect(getPromptFromCache("pA1")).toBeUndefined()
    for (const kept of ["pR", "pB", "pS", "pS1", "pFree"]) {
      expect(getPromptFromCache(kept)?.id).toBe(kept)
    }
  })

  it("refreshes the root folders when a root folder and its whole tree go", () => {
    removeFolderTreeFromCache({ folderIds: ["R", "A", "B", "A1"], promptIds: ["pR", "pA", "pB", "pA1"] })

    expect(ids(getRootFoldersFromCache())).toEqual(["S"])
    expect(getFolderChildrenFromCache("R")).toEqual([])
    expect(getFolderChildrenFromCache("A")).toEqual([])
    expect(getPromptsByFolderFromCache("R")).toEqual([])
    expect(getPromptFromCache("pB")).toBeUndefined()
    expect(ids(getFolderChildrenFromCache("S"))).toEqual(["S1"])
    expect(getPromptFromCache("pS1")?.id).toBe("pS1")
  })

  it("removes a folder id from every parent list, including a stale one", () => {
    // Reason: upsertFolderInCache adds a re-parented folder to its new parent's list without removing it from the old
    // one, so a deleted id can sit in more than one list.
    upsertFolderInCache({ ...A, parent_id: "S" })
    expect(ids(getFolderChildrenFromCache("S"))).toEqual(["A", "S1"])

    removeFolderTreeFromCache({ folderIds: ["A", "A1"], promptIds: ["pA", "pA1"] })

    expect(ids(getFolderChildrenFromCache("R"))).toEqual(["B"])
    expect(ids(getFolderChildrenFromCache("S"))).toEqual(["S1"])
  })

  it("leaves the cache unchanged for ids it does not hold", () => {
    removeFolderTreeFromCache({ folderIds: ["missing"], promptIds: ["missing-prompt"] })

    expect(ids(getRootFoldersFromCache())).toEqual(["R", "S"])
    expect(ids(getFolderChildrenFromCache("R"))).toEqual(["A", "B"])
    expect(ids(getFolderChildrenFromCache("A"))).toEqual(["A1"])
    expect(ids(getPromptsByFolderFromCache("A"))).toEqual(["pA"])
    expect(getPromptFromCache("pFree")?.id).toBe("pFree")
  })
})
