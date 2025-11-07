import { create } from 'zustand'

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

  // Selection actions
  toggleFolder: (folderId: string) => void
  selectFolder: (folderId: string | null) => void
  selectPrompt: (promptId: string | null) => void

  // Sort and filter actions
  setFolderSort: (sort: FolderSort) => void
  setFolderFilter: (filter: string) => void
  setDocSort: (sort: DocSort) => void
  setDocFilter: (filter: string) => void
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
}))
