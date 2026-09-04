import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../test/matchMedia'
import {
  clampVolume,
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SFX_VOLUME,
  isMusicPlaybackAllowed,
  isSfxPlaybackAllowed,
  LEGACY_MUSIC_ON_VOLUME,
  readMusicVolume,
  readSfxVolume,
  readSfxVolumeLast,
  readTheme,
  resolveTheme,
  STORAGE_KEY_MUSIC_ENABLED,
  STORAGE_KEY_MUSIC_VOLUME,
  STORAGE_KEY_SFX_ENABLED,
  STORAGE_KEY_SFX_VOLUME,
  STORAGE_KEY_THEME,
  writeMusicVolume,
  writeSfxVolume,
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

  it('defaults sound effects to a soft non-zero volume', () => {
    expect(readSfxVolume()).toBe(DEFAULT_SFX_VOLUME)
    expect(DEFAULT_SFX_VOLUME).toBeGreaterThan(0)
  })

  it('persists sound effects volume', () => {
    writeSfxVolume(0.35)
    expect(localStorage.getItem(STORAGE_KEY_SFX_VOLUME)).toBe('0.35')
    expect(readSfxVolume()).toBe(0.35)
  })

  it('treats zero sound volume as muted', () => {
    writeSfxVolume(0)
    expect(readSfxVolume()).toBe(0)
    expect(isSfxPlaybackAllowed(0)).toBe(false)
  })

  it('migrates legacy sound-effects off to volume 0', () => {
    localStorage.setItem(STORAGE_KEY_SFX_ENABLED, 'false')
    expect(readSfxVolume()).toBe(0)
  })

  it('defaults music to a soft non-zero volume', () => {
    expect(readMusicVolume()).toBe(DEFAULT_MUSIC_VOLUME)
    expect(DEFAULT_MUSIC_VOLUME).toBeGreaterThan(0)
  })

  it('persists music volume', () => {
    writeMusicVolume(DEFAULT_MUSIC_VOLUME)
    expect(localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME)).toBe(String(DEFAULT_MUSIC_VOLUME))
    expect(readMusicVolume()).toBe(DEFAULT_MUSIC_VOLUME)
  })

  it('migrates legacy music off to volume 0', () => {
    localStorage.setItem(STORAGE_KEY_MUSIC_ENABLED, 'false')
    expect(readMusicVolume()).toBe(0)
  })

  it('migrates legacy music on to the soft legacy volume', () => {
    localStorage.setItem(STORAGE_KEY_MUSIC_ENABLED, 'true')
    expect(readMusicVolume()).toBe(LEGACY_MUSIC_ON_VOLUME)
  })

  it('restores last non-zero volume after mute', () => {
    writeSfxVolume(0.4)
    writeSfxVolume(0)
    expect(readSfxVolume()).toBe(0)
    expect(readSfxVolumeLast()).toBe(0.4)
    writeSfxVolume(readSfxVolumeLast())
    expect(readSfxVolume()).toBe(0.4)
  })

  it('clamps volume into 0–1', () => {
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(Number.NaN)).toBe(0)
  })

  it('blocks playback when reduced motion is preferred', () => {
    stubMatchMedia({ reducedMotion: true })
    expect(isSfxPlaybackAllowed(1)).toBe(false)
    expect(isSfxPlaybackAllowed(0)).toBe(false)
    expect(isMusicPlaybackAllowed(DEFAULT_MUSIC_VOLUME)).toBe(false)
  })

  it('allows playback when volume is positive and motion is not reduced', () => {
    expect(isSfxPlaybackAllowed(DEFAULT_SFX_VOLUME)).toBe(true)
    expect(isSfxPlaybackAllowed(0)).toBe(false)
    expect(isMusicPlaybackAllowed(DEFAULT_MUSIC_VOLUME)).toBe(true)
    expect(isMusicPlaybackAllowed(0)).toBe(false)
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
