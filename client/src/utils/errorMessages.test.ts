import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getErrorMessage, isFatalError } from './errorMessages'

describe('getErrorMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the mapped friendly message for known codes', () => {
    expect(getErrorMessage('ROOM_NOT_FOUND')).toMatch(/no longer exists/i)
    expect(getErrorMessage('PLAYER_LOCKED')).toMatch(/already guessed correctly/i)
    expect(getErrorMessage('NICKNAME_TAKEN')).toMatch(/already taken/i)
  })

  it('returns mapped messages for the new dataset codes', () => {
    expect(getErrorMessage('NO_DATASET')).toMatch(/no content set/i)
    expect(getErrorMessage('DATASET_DISABLED')).toMatch(/disabled/i)
    expect(getErrorMessage('NO_ENTITIES')).toMatch(/no playable entities/i)
  })

  it('ignores the server message for non-category codes (avoids leaking dev strings)', () => {
    const msg = getErrorMessage('PLAYER_LOCKED', 'raw debug: locked at line 47')
    expect(msg).not.toMatch(/raw debug/)
    expect(msg).toMatch(/already guessed correctly/i)
  })

  it('prefers the server message for INVALID_SETTINGS (more specific)', () => {
    expect(
      getErrorMessage('INVALID_SETTINGS', 'Round duration must be between 10s and 60s')
    ).toBe('Round duration must be between 10s and 60s')
  })

  it('prefers the server message for INVALID_PAYLOAD when present', () => {
    expect(
      getErrorMessage('INVALID_PAYLOAD', 'Nickname is too long (maximum 20 characters)')
    ).toBe('Nickname is too long (maximum 20 characters)')
  })

  it('falls back to the friendly INVALID_SETTINGS copy when no server message', () => {
    expect(getErrorMessage('INVALID_SETTINGS')).toMatch(/invalid/i)
    expect(getErrorMessage('INVALID_SETTINGS', '')).toMatch(/invalid/i)
    expect(getErrorMessage('INVALID_SETTINGS', '   ')).toMatch(/invalid/i)
    expect(getErrorMessage('INVALID_SETTINGS', undefined)).toMatch(/invalid/i)
  })

  it('falls back to a generic friendly message for unknown codes (never the raw server text)', () => {
    const msg = getErrorMessage('SOMETHING_TOTALLY_NEW', 'internal stack trace at line 123')
    expect(msg).not.toMatch(/stack trace/)
    expect(msg).toMatch(/something went wrong/i)
  })

  it('logs unknown codes for developer visibility', () => {
    const warn = vi.mocked(console.warn)
    getErrorMessage('SOMETHING_TOTALLY_NEW', 'leaky message')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/Unknown ROOM_ERROR code/)
  })

  it('handles non-string server messages safely', () => {
    expect(getErrorMessage('INVALID_SETTINGS', 42 as unknown as string)).toMatch(/invalid/i)
    expect(getErrorMessage('INVALID_SETTINGS', null as unknown as string)).toMatch(/invalid/i)
    expect(getErrorMessage('INVALID_SETTINGS', { foo: 1 } as unknown as string)).toMatch(/invalid/i)
  })
})

describe('isFatalError', () => {
  it('marks irrecoverable codes as fatal', () => {
    expect(isFatalError('ROOM_NOT_FOUND')).toBe(true)
    expect(isFatalError('GAME_IN_PROGRESS')).toBe(true)
    expect(isFatalError('PLAYER_BANNED')).toBe(true)
    expect(isFatalError('RECONNECTION_FAILED')).toBe(true)
  })

  it('does not mark recoverable codes as fatal', () => {
    expect(isFatalError('NICKNAME_TAKEN')).toBe(false)
    expect(isFatalError('PLAYER_LOCKED')).toBe(false)
    expect(isFatalError('GUESS_RATE_LIMITED')).toBe(false)
    expect(isFatalError('CONNECTION_LOST')).toBe(false)
    expect(isFatalError('INVALID_SETTINGS')).toBe(false)
    expect(isFatalError('NO_DATASET')).toBe(false)
    expect(isFatalError('SOMETHING_NEW')).toBe(false)
  })
})
