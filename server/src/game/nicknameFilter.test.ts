import { describe, expect, it } from 'vitest'
import { nicknameIsBlocked } from './nicknameFilter.js'

describe('nicknameIsBlocked', () => {
  it('allows normal nicknames', () => {
    expect(nicknameIsBlocked('Paul')).toBe(false)
    expect(nicknameIsBlocked('Moses')).toBe(false)
    expect(nicknameIsBlocked('Samuel')).toBe(false)
  })
})
