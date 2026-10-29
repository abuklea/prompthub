/*
Project: PromptHub
Author: Allan James
Source: src/features/workspace/cache.ts
MIME: text/typescript
Type: TypeScript Module

Created: 25/02/2026 16:11 GMT+10
Last modified: 29/10/2026 20:53 GMT+10
---------------
The client-side workspace cache: the folder tree and the prompt listings of the workspace snapshot, read by the folder
and prompt panels before their own fetches answer, and kept current by their writes.

Changelog:
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
  userId: "",
  loadedAt: "",
  rootFolders: [] as Folder[],
  foldersByParent: new Map<string | null, Folder[]>(),
  promptsByFolder: new Map<string, PromptListing[]>(),
  promptsById: new Map<string, PromptListingWithFolder>(),
}

export function hydrateWorkspaceCache(snapshot: WorkspaceSnapshot) {
  workspaceCache.userId = snapshot.userId
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
