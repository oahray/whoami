export const STORAGE_KEY_SFX_ENABLED = 'whoami_sfx_enabled'
export const STORAGE_KEY_MUSIC_ENABLED = 'whoami_music_enabled'
export const STORAGE_KEY_THEME = 'whoami_theme'

const DEFAULT_SFX_ENABLED = true
const DEFAULT_MUSIC_ENABLED = true

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const DEFAULT_THEME: ThemeMode = 'system'
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']

export function readSfxEnabled(): boolean {
  if (typeof window === 'undefined') return DEFAULT_SFX_ENABLED
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SFX_ENABLED)
    if (raw === null) return DEFAULT_SFX_ENABLED
    return raw === 'true'
  } catch {
    return DEFAULT_SFX_ENABLED
  }
}

export function writeSfxEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SFX_ENABLED, String(enabled))
  } catch {
    // private mode / quota
  }
}

export function readMusicEnabled(): boolean {
  if (typeof window === 'undefined') return DEFAULT_MUSIC_ENABLED
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MUSIC_ENABLED)
    if (raw === null) return DEFAULT_MUSIC_ENABLED
    return raw === 'true'
  } catch {
    return DEFAULT_MUSIC_ENABLED
  }
}

export function writeMusicEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_MUSIC_ENABLED, String(enabled))
  } catch {
    // private mode / quota
  }
}

export function readTheme(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = localStorage.getItem(STORAGE_KEY_THEME)
    if (raw && THEME_MODES.includes(raw as ThemeMode)) {
      return raw as ThemeMode
    }
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function writeTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, mode)
  } catch {
    // private mode / quota
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  return systemPrefersDark() ? 'dark' : 'light'
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Whether sound effects may play (user pref + system reduced motion). */
export function isSfxPlaybackAllowed(sfxEnabled: boolean): boolean {
  return sfxEnabled && !prefersReducedMotion()
}

/** Whether menu theme music may play (user pref + system reduced motion). */
export function isMusicPlaybackAllowed(musicEnabled: boolean): boolean {
  return musicEnabled && !prefersReducedMotion()
}
