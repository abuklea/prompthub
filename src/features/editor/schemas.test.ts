import { describe, it, expect } from 'vitest'
import { saveNewVersionSchema, autoSaveSchema, MAX_CONTENT_LENGTH } from './schemas'

const UUID = '11111111-1111-1111-1111-111111111111'

describe('saveNewVersionSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = saveNewVersionSchema.safeParse({
      promptId: UUID,
      newTitle: 'Title',
      newContent: 'body',
    })
    expect(parsed.success).toBe(true)
  })

  it('requires a non-empty title', () => {
    expect(
      saveNewVersionSchema.safeParse({ promptId: UUID, newTitle: '', newContent: 'x' })
        .success,
    ).toBe(false)
  })

  it('rejects content over the max length cap', () => {
    const newContent = 'x'.repeat(MAX_CONTENT_LENGTH + 1)
    expect(
      saveNewVersionSchema.safeParse({ promptId: UUID, newTitle: 'T', newContent })
        .success,
    ).toBe(false)
  })

  it('accepts content exactly at the max length cap', () => {
    const newContent = 'x'.repeat(MAX_CONTENT_LENGTH)
    expect(
      saveNewVersionSchema.safeParse({ promptId: UUID, newTitle: 'T', newContent })
        .success,
    ).toBe(true)
  })
})

describe('autoSaveSchema', () => {
  it('allows a null title', () => {
    expect(
      autoSaveSchema.safeParse({ promptId: UUID, title: null, content: '' }).success,
    ).toBe(true)
  })

  it('enforces the content length cap', () => {
    const content = 'x'.repeat(MAX_CONTENT_LENGTH + 1)
    expect(
      autoSaveSchema.safeParse({ promptId: UUID, title: 'T', content }).success,
    ).toBe(false)
  })
})
