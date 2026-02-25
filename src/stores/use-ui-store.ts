import { create } from 'zustand'
import type { Folder, Prompt } from '@prisma/client'

export type FolderSort = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'
export type DocSort = 'title-asc' | 'title-desc' | 'date-asc' | 'date-desc' | 'size-asc' | 'size-desc'

interface CachedDocument {
  title: string | null
  content: string
  updatedAt: string
}

interface UiState {
  expandedFolders: Set<string>
  selectedFolder: string | null
  selectedPrompt: string | null

  folderSort: FolderSort
  folderFilter: string
  docSort: DocSort
  docFilter: string

  folderRefetchTrigger: number
  promptRefetchTrigger: number

  folders: Folder[]
  prompts: Prompt[]
  promptsByFolder: Record<string, Prompt[]>
  documentCache: Record<string, CachedDocument>
  workspaceReady: boolean
  workspaceSyncing: boolean

  toggleFolder: (folderId: string) => void
  selectFolder: (folderId: string | null) => void
  selectPrompt: (promptId: string | null) => void

  setFolderSort: (sort: FolderSort) => void
  setFolderFilter: (filter: string) => void
  setDocSort: (sort: DocSort) => void
  setDocFilter: (filter: string) => void

  triggerFolderRefetch: () => void
  triggerPromptRefetch: () => void

  preloadWorkspace: (payload: { folders: Folder[]; prompts: Prompt[] }) => void
  setWorkspaceSyncing: (syncing: boolean) => void

  setFolders: (folders: Folder[]) => void
  upsertFolder: (folder: Folder) => void
  removeFolder: (folderId: string) => void

  setPrompts: (prompts: Prompt[]) => void
  setPromptsForFolder: (folderId: string, prompts: Prompt[]) => void
  updatePromptTitle: (promptId: string, newTitle: string) => void
  addPrompt: (prompt: Prompt) => void
  removePrompt: (promptId: string) => void
  cacheDocument: (prompt: Prompt) => void
}

const sortByName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
const sortByTitle = (a: Prompt, b: Prompt) => (a.title || '').localeCompare(b.title || '')

export const useUiStore = create<UiState>((set, get) => ({
  expandedFolders: new Set(),
  selectedFolder: null,
  selectedPrompt: null,

  folderSort: 'name-asc',
  folderFilter: '',
  docSort: 'title-asc',
  docFilter: '',

  folderRefetchTrigger: 0,
  promptRefetchTrigger: 0,

  folders: [],
  prompts: [],
  promptsByFolder: {},
  documentCache: {},
  workspaceReady: false,
  workspaceSyncing: false,

  toggleFolder: (folderId) =>
    set((state) => {
      const next = new Set(state.expandedFolders)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return { expandedFolders: next }
    }),

  selectFolder: (folderId) =>
    set((state) => ({
      selectedFolder: folderId,
      selectedPrompt: null,
      prompts: folderId ? state.promptsByFolder[folderId] || [] : [],
    })),

  selectPrompt: (promptId) => set({ selectedPrompt: promptId }),

  setFolderSort: (sort) => set({ folderSort: sort }),
  setFolderFilter: (filter) => set({ folderFilter: filter }),
  setDocSort: (sort) => set({ docSort: sort }),
  setDocFilter: (filter) => set({ docFilter: filter }),

  triggerFolderRefetch: () => set((s) => ({ folderRefetchTrigger: s.folderRefetchTrigger + 1 })),
  triggerPromptRefetch: () => set((s) => ({ promptRefetchTrigger: s.promptRefetchTrigger + 1 })),

  preloadWorkspace: ({ folders, prompts }) => {
    const promptsByFolder = prompts.reduce<Record<string, Prompt[]>>((acc, prompt) => {
      const key = prompt.folder_id || '__unfiled__'
      if (!acc[key]) acc[key] = []
      acc[key].push(prompt)
      return acc
    }, {})

    for (const key of Object.keys(promptsByFolder)) {
      promptsByFolder[key].sort(sortByTitle)
    }

    const selectedFolder = get().selectedFolder

    set({
      folders: [...folders].sort(sortByName),
      promptsByFolder,
      prompts: selectedFolder ? promptsByFolder[selectedFolder] || [] : [],
      workspaceReady: true,
      workspaceSyncing: false,
      documentCache: prompts.reduce<Record<string, CachedDocument>>((acc, prompt) => {
        acc[prompt.id] = {
          title: prompt.title,
          content: prompt.content,
          updatedAt: prompt.updated_at.toISOString(),
        }
        return acc
      }, {}),
    })
  },

  setWorkspaceSyncing: (workspaceSyncing) => set({ workspaceSyncing }),

  setFolders: (folders) => set({ folders: [...folders].sort(sortByName) }),

  upsertFolder: (folder) =>
    set((state) => {
      const next = state.folders.some((f) => f.id === folder.id)
        ? state.folders.map((f) => (f.id === folder.id ? folder : f))
        : [...state.folders, folder]
      return { folders: next.sort(sortByName) }
    }),

  removeFolder: (folderId) =>
    set((state) => {
      const childIds = new Set(
        state.folders.filter((f) => f.parent_id === folderId).map((f) => f.id)
      )
      childIds.add(folderId)

      const promptsByFolder = Object.fromEntries(
        Object.entries(state.promptsByFolder).filter(([key]) => !childIds.has(key))
      )

      return {
        folders: state.folders.filter((f) => !childIds.has(f.id)),
        promptsByFolder,
        prompts: state.selectedFolder && childIds.has(state.selectedFolder)
          ? []
          : state.prompts,
      }
    }),

  setPrompts: (prompts) =>
    set((state) => {
      if (!state.selectedFolder) return { prompts }
      return {
        prompts,
        promptsByFolder: {
          ...state.promptsByFolder,
          [state.selectedFolder]: [...prompts].sort(sortByTitle),
        },
      }
    }),

  setPromptsForFolder: (folderId, prompts) =>
    set((state) => ({
      promptsByFolder: {
        ...state.promptsByFolder,
        [folderId]: [...prompts].sort(sortByTitle),
      },
      prompts: state.selectedFolder === folderId ? [...prompts].sort(sortByTitle) : state.prompts,
    })),

  updatePromptTitle: (promptId, newTitle) =>
    set((state) => {
      const update = (items: Prompt[]) =>
        items.map((prompt) => (prompt.id === promptId ? { ...prompt, title: newTitle } : prompt))

      const promptsByFolder = Object.fromEntries(
        Object.entries(state.promptsByFolder).map(([folderId, folderPrompts]) => [folderId, update(folderPrompts)])
      ) as Record<string, Prompt[]>

      return {
        prompts: update(state.prompts),
        promptsByFolder,
        documentCache: state.documentCache[promptId]
          ? {
              ...state.documentCache,
              [promptId]: {
                ...state.documentCache[promptId],
                title: newTitle,
              },
            }
          : state.documentCache,
      }
    }),

  addPrompt: (prompt) =>
    set((state) => {
      const folderId = prompt.folder_id || '__unfiled__'
      const folderPrompts = [...(state.promptsByFolder[folderId] || []), prompt].sort(sortByTitle)

      return {
        promptsByFolder: {
          ...state.promptsByFolder,
          [folderId]: folderPrompts,
        },
        prompts: state.selectedFolder === folderId ? folderPrompts : state.prompts,
        documentCache: {
          ...state.documentCache,
          [prompt.id]: {
            title: prompt.title,
            content: prompt.content,
            updatedAt: prompt.updated_at.toISOString(),
          },
        },
      }
    }),

  removePrompt: (promptId) =>
    set((state) => {
      const promptsByFolder = Object.fromEntries(
        Object.entries(state.promptsByFolder).map(([folderId, items]) => [folderId, items.filter((p) => p.id !== promptId)])
      ) as Record<string, Prompt[]>

      return {
        prompts: state.prompts.filter((prompt) => prompt.id !== promptId),
        promptsByFolder,
        documentCache: Object.fromEntries(
          Object.entries(state.documentCache).filter(([id]) => id !== promptId)
        ),
      }
    }),

  cacheDocument: (prompt) =>
    set((state) => ({
      documentCache: {
        ...state.documentCache,
        [prompt.id]: {
          title: prompt.title,
          content: prompt.content,
          updatedAt: prompt.updated_at.toISOString(),
        },
      },
    })),
}))
