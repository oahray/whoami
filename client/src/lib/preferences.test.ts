import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../test/matchMedia'
import {
  isSfxPlaybackAllowed,
  readSfxEnabled,
  readTheme,
  resolveTheme,
  STORAGE_KEY_SFX_ENABLED,
  STORAGE_KEY_THEME,
  writeSfxEnabled,
  writeTheme
} from './preferences'

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    stubMatchMedia()
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
    stubMatchMedia({ reducedMotion: true })
    expect(isSfxPlaybackAllowed(true)).toBe(false)
    expect(isSfxPlaybackAllowed(false)).toBe(false)
  })

  it('allows playback when enabled and motion is not reduced', () => {
    expect(isSfxPlaybackAllowed(true)).toBe(true)
    expect(isSfxPlaybackAllowed(false)).toBe(false)
  })

  it('defaults theme to system', () => {
    expect(readTheme()).toBe('system')
  })

  it('persists theme preference', () => {
    writeTheme('dark')
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe('dark')
    expect(readTheme()).toBe('dark')
  })

  it('resolves explicit light and dark themes', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('resolves system theme from prefers-color-scheme', () => {
    stubMatchMedia({ prefersDark: true })
    expect(resolveTheme('system')).toBe('dark')
    stubMatchMedia({ prefersDark: false })
    expect(resolveTheme('system')).toBe('light')
  })
})
