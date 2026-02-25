import { create } from 'zustand'
import type { Prompt } from '@prisma/client'

// Sort and filter types
export type FolderSort = 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc'
export type DocSort = 'title-asc' | 'title-desc' | 'date-asc' | 'date-desc' | 'size-asc' | 'size-desc'

interface UiState {
  // Selection state
  expandedFolders: Set<string>
  selectedFolder: string | null
  selectedPrompt: string | null

  // Sort and filter state
  folderSort: FolderSort
  folderFilter: string
  docSort: DocSort
  docFilter: string

  // Refetch triggers (P5S4bT2)
  folderRefetchTrigger: number
  promptRefetchTrigger: number

  // Prompts state (for auto-save updates without refetch)
  prompts: Prompt[]

  // Workspace preload state
  workspacePreloading: boolean
  workspaceLoadedAt: string | null

  // Selection actions
  toggleFolder: (folderId: string) => void
  selectFolder: (folderId: string | null) => void
  selectPrompt: (promptId: string | null) => void

  // Sort and filter actions
  setFolderSort: (sort: FolderSort) => void
  setFolderFilter: (filter: string) => void
  setDocSort: (sort: DocSort) => void
  setDocFilter: (filter: string) => void

  // Refetch trigger actions (P5S4bT2)
  triggerFolderRefetch: () => void
  triggerPromptRefetch: () => void

  // Prompts management actions
  setPrompts: (prompts: Prompt[]) => void

  // Workspace preload actions
  setWorkspacePreloading: (loading: boolean) => void
  setWorkspaceLoadedAt: (loadedAt: string | null) => void
  updatePromptTitle: (promptId: string, newTitle: string) => void
  addPrompt: (prompt: Prompt) => void
  removePrompt: (promptId: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  // Selection state
  expandedFolders: new Set(),
  selectedFolder: null,
  selectedPrompt: null,

  // Sort and filter state
  folderSort: 'name-asc',
  folderFilter: '',
  docSort: 'title-asc',
  docFilter: '',

  // Refetch triggers (P5S4bT2)
  folderRefetchTrigger: 0,
  promptRefetchTrigger: 0,

  // Prompts state
  prompts: [],

  // Workspace preload state
  workspacePreloading: false,
  workspaceLoadedAt: null,

  // Selection actions
  toggleFolder: (folderId) =>
    set((state) => {
      const newExpandedFolders = new Set(state.expandedFolders)
      if (newExpandedFolders.has(folderId)) {
        newExpandedFolders.delete(folderId)
      } else {
        newExpandedFolders.add(folderId)
      }
      return { expandedFolders: newExpandedFolders }
    }),
  selectFolder: (folderId) => set({ selectedFolder: folderId, selectedPrompt: null }),
  selectPrompt: (promptId) => set({ selectedPrompt: promptId }),

  // Sort and filter actions
  setFolderSort: (sort) => set({ folderSort: sort }),
  setFolderFilter: (filter) => set({ folderFilter: filter }),
  setDocSort: (sort) => set({ docSort: sort }),
  setDocFilter: (filter) => set({ docFilter: filter }),

  // Refetch trigger actions (P5S4bT2)
  triggerFolderRefetch: () =>
    set((state) => ({ folderRefetchTrigger: state.folderRefetchTrigger + 1 })),
  triggerPromptRefetch: () =>
    set((state) => ({ promptRefetchTrigger: state.promptRefetchTrigger + 1 })),

  // Prompts management actions
  setPrompts: (prompts) => set({ prompts }),

  // Workspace preload actions
  setWorkspacePreloading: (loading) => set({ workspacePreloading: loading }),
  setWorkspaceLoadedAt: (loadedAt) => set({ workspaceLoadedAt: loadedAt }),
  updatePromptTitle: (promptId, newTitle) =>
    set((state) => ({
      prompts: state.prompts.map((prompt) =>
        prompt.id === promptId ? { ...prompt, title: newTitle } : prompt
      ),
    })),
  // P5S5T3: Optimistic update for document creation (avoids full folder refetch)
  addPrompt: (prompt) =>
    set((state) => ({
      prompts: [...state.prompts, prompt],
    })),
  // P5S5T3: Optimistic update for document deletion (avoids full folder refetch)
  removePrompt: (promptId) =>
    set((state) => ({
      prompts: state.prompts.filter((prompt) => prompt.id !== promptId),
    })),
}))
