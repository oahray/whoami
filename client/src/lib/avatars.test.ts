import { describe, expect, it } from 'vitest'
import { AVATAR_COUNT, AVATAR_IDS, avatarSrc, isAvatarId } from './avatars'

describe('avatars', () => {
  it('allowlists 60 file-backed ids', () => {
    expect(AVATAR_IDS).toHaveLength(AVATAR_COUNT)
    expect(isAvatarId('avatar-01')).toBe(true)
    expect(isAvatarId('avatar-48')).toBe(true)
    expect(isAvatarId('avatar-61')).toBe(false)
    expect(avatarSrc('avatar-07')).toBe('/avatars/avatar-07.svg')
  })
})
