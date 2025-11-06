import { create } from 'zustand'

interface UiState {
  expandedFolders: Set<string>
  selectedFolder: string | null
  selectedPrompt: string | null
  toggleFolder: (folderId: string) => void
  selectFolder: (folderId: string | null) => void
  selectPrompt: (promptId: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  expandedFolders: new Set(),
  selectedFolder: null,
  selectedPrompt: null,
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
}))
