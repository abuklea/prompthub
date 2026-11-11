/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/cache.ts
MIME: text/typescript
Type: TypeScript Module

Created: 25/02/2026 16:11 GMT+10
Last modified: 29/10/2026 21:11 GMT+10
---------------
The client-side workspace cache: the folder tree and the prompt listings of the workspace snapshot, read by the folder
and prompt panels before their own fetches answer, and kept current by their writes. It holds the data of one bound
viewer only: binding another user empties it, and sign-out clears it.

Changelog:
29/10/2026 21:11 GMT+10 | P7S2T9: bound viewer (bindWorkspaceCacheViewer, decision D5) and clearWorkspaceCache for the
                         sign-out purge; a snapshot of another user than the bound viewer is ignored (issue #44)
29/10/2026 20:53 GMT+10 | P7S2T5: the one-level folder removal replaced by removeFolderTreeFromCache, which drops
                         every folder and prompt a folder delete removed (finding F-6, issue #113); header added (F-9)
25/02/2026 16:11 GMT+10 | Created (commit b8fb4db)
*/
import type { Folder, Prompt } from "@prisma/client"

// Reason: Workspace preload excludes content/content_tsv for performance.
// On-demand fetches supply full Prompt objects which also satisfy this type.
type PromptListing = Omit<Prompt, 'content' | 'content_tsv'> & {
  content?: string
}

type PromptListingWithFolder = PromptListing & {
  folder: {
    id: string
    name: string
  } | null
}

interface WorkspaceSnapshot {
  userId: string
  folders: Folder[]
  prompts: PromptListingWithFolder[]
  loadedAt: string
}

const workspaceCache = {
  // The bound viewer: the only user whose data the cache holds; "" means no user is bound yet.
  userId: "",
  loadedAt: "",
  rootFolders: [] as Folder[],
  foldersByParent: new Map<string | null, Folder[]>(),
  promptsByFolder: new Map<string, PromptListing[]>(),
  promptsById: new Map<string, PromptListingWithFolder>(),
}

/** Empties every map and the root list and forgets the snapshot time; the viewer is left as it is. */
function emptyWorkspaceCache(): void {
  workspaceCache.loadedAt = ""
  workspaceCache.rootFolders = []
  workspaceCache.foldersByParent.clear()
  workspaceCache.promptsByFolder.clear()
  workspaceCache.promptsById.clear()
}

/** Empties the cache and unbinds the viewer, so the next snapshot of any user is adopted; sign-out calls it. */
export function clearWorkspaceCache(): void {
  emptyWorkspaceCache()
  workspaceCache.userId = ""
}

/**
 * Binds the signed-in user as the cache's viewer (decision D5). Binding another user than the bound one empties the
 * cache first, so every getter and writer afterwards sees only that user's data; binding the same user keeps it.
 *
 * @param userId - The signed-in user's id.
 */
export function bindWorkspaceCacheViewer(userId: string): void {
  if (workspaceCache.userId !== userId) emptyWorkspaceCache()
  workspaceCache.userId = userId
}

/**
 * Replaces the cache with a workspace snapshot. With no viewer bound (a fresh module, or after a purge) it adopts the
 * snapshot's user as the viewer; a snapshot of another user than the bound viewer is ignored.
 *
 * @param snapshot - The snapshot getWorkspaceSnapshot returned.
 */
export function hydrateWorkspaceCache(snapshot: WorkspaceSnapshot) {
  if (workspaceCache.userId === "") workspaceCache.userId = snapshot.userId
  // Reason: a late answer of an earlier session must not refill the cache of the user signed in now.
  if (snapshot.userId !== workspaceCache.userId) return

  workspaceCache.loadedAt = snapshot.loadedAt
  workspaceCache.foldersByParent.clear()
  workspaceCache.promptsByFolder.clear()
  workspaceCache.promptsById.clear()

  for (const folder of snapshot.folders) {
    const key = folder.parent_id
    const existing = workspaceCache.foldersByParent.get(key) ?? []
    existing.push(folder)
    workspaceCache.foldersByParent.set(key, existing)
  }

  workspaceCache.foldersByParent.forEach((list, parentId) => {
    workspaceCache.foldersByParent.set(parentId, [...list].sort((a, b) => a.name.localeCompare(b.name)))
  })

  workspaceCache.rootFolders = workspaceCache.foldersByParent.get(null) ?? []

  for (const prompt of snapshot.prompts) {
    workspaceCache.promptsById.set(prompt.id, prompt)

    if (prompt.folder_id) {
      const existing = workspaceCache.promptsByFolder.get(prompt.folder_id) ?? []
      existing.push(prompt)
      workspaceCache.promptsByFolder.set(prompt.folder_id, existing)
    }
  }

  workspaceCache.promptsByFolder.forEach((list, folderId) => {
    workspaceCache.promptsByFolder.set(folderId, [...list].sort((a, b) => (a.title || "").localeCompare(b.title || "")))
  })
}

export function getRootFoldersFromCache() {
  return workspaceCache.rootFolders
}

export function getFolderChildrenFromCache(parentId: string) {
  return workspaceCache.foldersByParent.get(parentId) ?? []
}

export function getPromptsByFolderFromCache(folderId: string) {
  return workspaceCache.promptsByFolder.get(folderId) ?? []
}

export function upsertFolderInCache(folder: Folder) {
  const parentKey = folder.parent_id
  const parentList = workspaceCache.foldersByParent.get(parentKey) ?? []
  const next = [...parentList.filter((item) => item.id !== folder.id), folder].sort((a, b) => a.name.localeCompare(b.name))
  workspaceCache.foldersByParent.set(parentKey, next)
  workspaceCache.rootFolders = workspaceCache.foldersByParent.get(null) ?? []
}

/**
 * Drop a deleted folder tree from the cache, driven by the ids deleteFolder returns.
 *
 * @param tree - `folderIds`: the deleted folder and every descendant; `promptIds`: every prompt filed in them.
 *   Each folder id leaves every parent list (a stale list included) and is no longer a key of `foldersByParent` or
 *   `promptsByFolder`; each prompt id leaves `promptsById`. The root folders are refreshed. Unknown ids are ignored.
 */
export function removeFolderTreeFromCache(tree: { folderIds: readonly string[]; promptIds: readonly string[] }) {
  const deleted = new Set(tree.folderIds)
  // Reason: every list is filtered, not only the parent's, because upsertFolderInCache can leave a re-parented folder
  // in its old parent's list as well.
  workspaceCache.foldersByParent.forEach((list, parentId) => {
    if (list.some((item) => deleted.has(item.id))) {
      workspaceCache.foldersByParent.set(parentId, list.filter((item) => !deleted.has(item.id)))
    }
  })
  deleted.forEach((folderId) => {
    workspaceCache.foldersByParent.delete(folderId)
    workspaceCache.promptsByFolder.delete(folderId)
  })
  tree.promptIds.forEach((promptId) => workspaceCache.promptsById.delete(promptId))
  workspaceCache.rootFolders = workspaceCache.foldersByParent.get(null) ?? []
}

export function setPromptsForFolderInCache(folderId: string, prompts: PromptListing[]) {
  workspaceCache.promptsByFolder.set(folderId, [...prompts])
  prompts.forEach((prompt) => {
    const existing = workspaceCache.promptsById.get(prompt.id)
    workspaceCache.promptsById.set(prompt.id, { ...prompt, folder: existing?.folder ?? null })
  })
}

export function upsertPromptInCache(prompt: PromptListing) {
  if (!prompt.folder_id) return

  const list = workspaceCache.promptsByFolder.get(prompt.folder_id) ?? []
  const next = [...list.filter((item) => item.id !== prompt.id), prompt].sort((a, b) => (a.title || "").localeCompare(b.title || ""))
  workspaceCache.promptsByFolder.set(prompt.folder_id, next)

  const existing = workspaceCache.promptsById.get(prompt.id)
  workspaceCache.promptsById.set(prompt.id, { ...prompt, folder: existing?.folder ?? null })
}

export function removePromptFromCache(promptId: string, folderId?: string | null) {
  if (folderId) {
    const list = workspaceCache.promptsByFolder.get(folderId) ?? []
    workspaceCache.promptsByFolder.set(folderId, list.filter((item) => item.id !== promptId))
  }
  workspaceCache.promptsById.delete(promptId)
}

export function getPromptFromCache(promptId: string) {
  return workspaceCache.promptsById.get(promptId)
}

export function hasWorkspaceSnapshot() {
  return Boolean(workspaceCache.loadedAt)
}
