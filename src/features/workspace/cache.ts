import type { Folder, Prompt } from "@prisma/client"

type PromptWithFolder = Prompt & {
  folder: {
    id: string
    name: string
  } | null
}

interface WorkspaceSnapshot {
  userId: string
  folders: Folder[]
  prompts: PromptWithFolder[]
  loadedAt: string
}

const workspaceCache = {
  userId: "",
  loadedAt: "",
  rootFolders: [] as Folder[],
  foldersByParent: new Map<string | null, Folder[]>(),
  promptsByFolder: new Map<string, Prompt[]>(),
  promptsById: new Map<string, PromptWithFolder>(),
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

export function removeFolderFromCache(folderId: string, parentId: string | null) {
  const parentList = workspaceCache.foldersByParent.get(parentId) ?? []
  workspaceCache.foldersByParent.set(parentId, parentList.filter((item) => item.id !== folderId))
  workspaceCache.rootFolders = workspaceCache.foldersByParent.get(null) ?? []
}

export function setPromptsForFolderInCache(folderId: string, prompts: Prompt[]) {
  workspaceCache.promptsByFolder.set(folderId, [...prompts])
  prompts.forEach((prompt) => {
    const existing = workspaceCache.promptsById.get(prompt.id)
    workspaceCache.promptsById.set(prompt.id, { ...prompt, folder: existing?.folder ?? null })
  })
}

export function upsertPromptInCache(prompt: Prompt) {
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
