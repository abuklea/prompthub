import type { Prompt } from "@prisma/client"

export type PromptTag = {
  id: string
  name: string
}

// Reason: content is optional because workspace preload excludes it for performance.
// On-demand fetches (getPromptsByFolder) return full Prompt objects with content.
export type PromptListItem = Omit<Prompt, 'content' | 'content_tsv'> & {
  content?: string
  tags?: PromptTag[]
}

export type PromptVersionHistoryItem = {
  id: number
  created_at: Date
  title_snapshot: string | null
  content_snapshot: string
}
