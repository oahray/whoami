export const STORAGE_KEY_SFX_ENABLED = 'whoami_sfx_enabled'
export const STORAGE_KEY_MUSIC_ENABLED = 'whoami_music_enabled'
export const STORAGE_KEY_SFX_VOLUME = 'whoami_sfx_volume'
export const STORAGE_KEY_MUSIC_VOLUME = 'whoami_music_volume'
export const STORAGE_KEY_SFX_VOLUME_LAST = 'whoami_sfx_volume_last'
export const STORAGE_KEY_MUSIC_VOLUME_LAST = 'whoami_music_volume_last'
export const STORAGE_KEY_THEME = 'whoami_theme'

/** Soft default — audible without jump-scare. */
export const DEFAULT_SFX_VOLUME = 0.45
/** Soft loop default; music is on for new visitors at this level. */
export const DEFAULT_MUSIC_VOLUME = 0.15
/** Used when migrating legacy `music_enabled=true`. */
export const LEGACY_MUSIC_ON_VOLUME = 0.2

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const DEFAULT_THEME: ThemeMode = 'system'
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function parseStoredVolume(raw: string | null): number | null {
  if (raw === null) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return clampVolume(parsed)
}

function readLegacyEnabled(key: string): boolean | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

export function readSfxVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_SFX_VOLUME
  try {
    const stored = parseStoredVolume(localStorage.getItem(STORAGE_KEY_SFX_VOLUME))
    if (stored !== null) return stored
    const legacy = readLegacyEnabled(STORAGE_KEY_SFX_ENABLED)
    if (legacy === false) return 0
    return DEFAULT_SFX_VOLUME
  } catch {
    return DEFAULT_SFX_VOLUME
  }
}

export function writeSfxVolume(volume: number): void {
  try {
    const next = clampVolume(volume)
    localStorage.setItem(STORAGE_KEY_SFX_VOLUME, String(next))
    if (next > 0) {
      localStorage.setItem(STORAGE_KEY_SFX_VOLUME_LAST, String(next))
    }
  } catch {
    // private mode / quota
  }
}

export function readSfxVolumeLast(): number {
  if (typeof window === 'undefined') return DEFAULT_SFX_VOLUME
  try {
    const stored = parseStoredVolume(localStorage.getItem(STORAGE_KEY_SFX_VOLUME_LAST))
    if (stored !== null && stored > 0) return stored
  } catch {
    // ignore
  }
  return DEFAULT_SFX_VOLUME
}

export function readMusicVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_MUSIC_VOLUME
  try {
    const stored = parseStoredVolume(localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME))
    if (stored !== null) return stored
    const legacy = readLegacyEnabled(STORAGE_KEY_MUSIC_ENABLED)
    if (legacy === false) return 0
    if (legacy === true) return LEGACY_MUSIC_ON_VOLUME
    return DEFAULT_MUSIC_VOLUME
  } catch {
    return DEFAULT_MUSIC_VOLUME
  }
}

export function writeMusicVolume(volume: number): void {
  try {
    const next = clampVolume(volume)
    localStorage.setItem(STORAGE_KEY_MUSIC_VOLUME, String(next))
    if (next > 0) {
      localStorage.setItem(STORAGE_KEY_MUSIC_VOLUME_LAST, String(next))
    }
  } catch {
    // private mode / quota
  }
}

export function readMusicVolumeLast(): number {
  if (typeof window === 'undefined') return DEFAULT_MUSIC_VOLUME
  try {
    const stored = parseStoredVolume(localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME_LAST))
    if (stored !== null && stored > 0) return stored
  } catch {
    // ignore
  }
  return DEFAULT_MUSIC_VOLUME
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

/** Whether sound effects may play (volume > 0 + system reduced motion). */
export function isSfxPlaybackAllowed(sfxVolumeOrEnabled: number | boolean): boolean {
  const on =
    typeof sfxVolumeOrEnabled === 'boolean' ? sfxVolumeOrEnabled : sfxVolumeOrEnabled > 0
  return on && !prefersReducedMotion()
}

/** Whether menu theme music may play (volume > 0 + system reduced motion). */
export function isMusicPlaybackAllowed(musicVolumeOrEnabled: number | boolean): boolean {
  const on =
    typeof musicVolumeOrEnabled === 'boolean' ? musicVolumeOrEnabled : musicVolumeOrEnabled > 0
  return on && !prefersReducedMotion()
}
