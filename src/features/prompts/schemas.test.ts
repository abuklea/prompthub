import { describe, it, expect } from 'vitest'
import {
  createPromptSchema,
  searchPromptsSchema,
  createTagSchema,
  assignPromptTagsSchema,
  titleValidationSchema,
  isPlaceholderTitle,
} from './schemas'

const UUID = '11111111-1111-1111-1111-111111111111'

describe('createPromptSchema', () => {
  it('accepts a valid folder UUID with optional title', () => {
    expect(createPromptSchema.safeParse({ folderId: UUID }).success).toBe(true)
    expect(
      createPromptSchema.safeParse({ folderId: UUID, title: 'A title' }).success,
    ).toBe(true)
  })

  it('rejects a non-UUID folderId', () => {
    expect(createPromptSchema.safeParse({ folderId: 'nope' }).success).toBe(false)
  })

  it('rejects an over-long title (> 200 chars)', () => {
    const title = 'x'.repeat(201)
    expect(createPromptSchema.safeParse({ folderId: UUID, title }).success).toBe(false)
  })
})

describe('searchPromptsSchema', () => {
  it('requires a non-empty query and defaults tagIds to []', () => {
    const parsed = searchPromptsSchema.safeParse({ query: 'hello' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.tagIds).toEqual([])
  })

  it('rejects an empty query', () => {
    expect(searchPromptsSchema.safeParse({ query: '   ' }).success).toBe(false)
  })

  it('rejects more than 20 tag ids', () => {
    const tagIds = Array.from({ length: 21 }, () => UUID)
    expect(searchPromptsSchema.safeParse({ query: 'x', tagIds }).success).toBe(false)
  })
})

describe('tag schemas', () => {
  it('createTagSchema trims and bounds the name', () => {
    expect(createTagSchema.safeParse({ name: 'work' }).success).toBe(true)
    expect(createTagSchema.safeParse({ name: '' }).success).toBe(false)
    expect(createTagSchema.safeParse({ name: 'y'.repeat(51) }).success).toBe(false)
  })

  it('assignPromptTagsSchema validates prompt and tag UUIDs', () => {
    expect(
      assignPromptTagsSchema.safeParse({ promptId: UUID, tagIds: [UUID] }).success,
    ).toBe(true)
    expect(
      assignPromptTagsSchema.safeParse({ promptId: 'bad', tagIds: [] }).success,
    ).toBe(false)
  })
})

describe('title validation', () => {
  it('flags placeholder titles', () => {
    expect(isPlaceholderTitle('[Untitled Doc]')).toBe(true)
    expect(isPlaceholderTitle('[Untitled Doc 2]')).toBe(true)
    expect(isPlaceholderTitle('My Prompt')).toBe(false)
  })

  it('rejects placeholder and empty titles via schema', () => {
    expect(titleValidationSchema.safeParse('[Untitled Doc]').success).toBe(false)
    expect(titleValidationSchema.safeParse('').success).toBe(false)
    expect(titleValidationSchema.safeParse('Real Title').success).toBe(true)
  })
})
