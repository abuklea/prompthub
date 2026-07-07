import { describe, it, expect } from 'vitest'
import { getDisplayTitle } from './utils'

describe('getDisplayTitle', () => {
  it('returns the placeholder for null / undefined', () => {
    expect(getDisplayTitle(null)).toEqual('[Untitled Doc]')
    expect(getDisplayTitle(undefined)).toEqual('[Untitled Doc]')
  })

  it('returns the placeholder for empty / whitespace-only titles', () => {
    expect(getDisplayTitle('')).toEqual('[Untitled Doc]')
    expect(getDisplayTitle('   ')).toEqual('[Untitled Doc]')
  })

  it('returns the trimmed title when present', () => {
    expect(getDisplayTitle('  My Prompt  ')).toEqual('My Prompt')
    expect(getDisplayTitle('Prompt')).toEqual('Prompt')
  })
})
