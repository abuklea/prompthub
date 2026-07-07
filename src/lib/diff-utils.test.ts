import { describe, it, expect } from 'vitest'
import { createPatch, applyPatch } from './diff-utils'

describe('diff-utils', () => {
  it('round-trips a simple edit (patch then apply reconstructs the new content)', () => {
    const oldContent = 'Hello world'
    const newContent = 'Hello there world'
    const patch = createPatch(oldContent, newContent)
    expect(patch).not.toEqual('')
    expect(applyPatch(oldContent, patch)).toEqual(newContent)
  })

  it('produces an empty patch for identical content', () => {
    const patch = createPatch('same', 'same')
    expect(patch).toEqual('')
  })

  it('round-trips multi-line content', () => {
    const oldContent = 'line 1\nline 2\nline 3'
    const newContent = 'line 1\nline 2 edited\nline 3\nline 4'
    const patch = createPatch(oldContent, newContent)
    expect(applyPatch(oldContent, patch)).toEqual(newContent)
  })

  it('round-trips content that grows from empty', () => {
    const patch = createPatch('', 'first content')
    expect(applyPatch('', patch)).toEqual('first content')
  })

  it('applies an empty patch as a no-op', () => {
    // patch_apply on an empty patch set returns the base unchanged.
    expect(applyPatch('untouched', '')).toEqual('untouched')
  })
})
