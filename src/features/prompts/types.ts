import type { Prompt } from "@prisma/client"

export type PromptTag = {
  id: string
  name: string
}

export type PromptListItem = Prompt & {
  tags?: PromptTag[]
}

export type PromptVersionHistoryItem = {
  id: number
  created_at: Date
  title_snapshot: string | null
  content_snapshot: string
}
