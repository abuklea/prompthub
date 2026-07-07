import { describe, it, expect } from 'vitest'
import { SignInSchema, SignUpSchema } from './schemas'

describe('SignInSchema', () => {
  it('accepts a valid email + password', () => {
    expect(
      SignInSchema.safeParse({ email: 'a@b.com', password: 'password1' }).success,
    ).toBe(true)
  })

  it('rejects an invalid email', () => {
    expect(
      SignInSchema.safeParse({ email: 'not-an-email', password: 'password1' }).success,
    ).toBe(false)
  })

  it('rejects a short password (< 8 chars)', () => {
    expect(SignInSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(
      false,
    )
  })
})

describe('SignUpSchema', () => {
  it('accepts matching passwords', () => {
    const parsed = SignUpSchema.safeParse({
      email: 'a@b.com',
      password: 'password1',
      confirmPassword: 'password1',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const parsed = SignUpSchema.safeParse({
      email: 'a@b.com',
      password: 'password1',
      confirmPassword: 'password2',
    })
    expect(parsed.success).toBe(false)
  })
})
