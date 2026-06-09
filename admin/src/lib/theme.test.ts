import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readAdminTheme,
  resolveAdminTheme,
  STORAGE_KEY_ADMIN_THEME,
  writeAdminTheme
} from './theme'

describe('admin theme', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to system', () => {
    expect(readAdminTheme()).toBe('system')
  })

  it('persists theme preference separately from the player app key', () => {
    writeAdminTheme('dark')
    expect(localStorage.getItem(STORAGE_KEY_ADMIN_THEME)).toBe('dark')
    expect(localStorage.getItem('whoami_theme')).toBeNull()
  })

  it('resolves system from prefers-color-scheme', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-color-scheme: dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    )
    expect(resolveAdminTheme('system')).toBe('dark')
  })
})
