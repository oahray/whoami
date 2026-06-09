import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSfxPlaybackAllowed,
  readSfxEnabled,
  STORAGE_KEY_SFX_ENABLED,
  writeSfxEnabled
} from './preferences'

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults sound effects to on', () => {
    expect(readSfxEnabled()).toBe(true)
  })

  it('persists sound effects preference', () => {
    writeSfxEnabled(false)
    expect(localStorage.getItem(STORAGE_KEY_SFX_ENABLED)).toBe('false')
    expect(readSfxEnabled()).toBe(false)
  })

  it('blocks playback when reduced motion is preferred', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
    expect(isSfxPlaybackAllowed(true)).toBe(false)
    expect(isSfxPlaybackAllowed(false)).toBe(false)
  })

  it('allows playback when enabled and motion is not reduced', () => {
    expect(isSfxPlaybackAllowed(true)).toBe(true)
    expect(isSfxPlaybackAllowed(false)).toBe(false)
  })
})
