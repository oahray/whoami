import { describe, expect, it } from 'vitest'
import { AVATAR_IDS, coerceAvatarId, isAvatarId } from './avatars.js'

describe('avatars', () => {
  it('accepts known avatar ids', () => {
    expect(isAvatarId('avatar-01')).toBe(true)
    expect(isAvatarId('avatar-24')).toBe(true)
    expect(isAvatarId('avatar-99')).toBe(false)
    expect(isAvatarId(null)).toBe(false)
  })

  it('coerces unknown values to a random allowlisted id', () => {
    expect(AVATAR_IDS).toContain(coerceAvatarId('not-real'))
    expect(coerceAvatarId('avatar-05')).toBe('avatar-05')
  })
})
