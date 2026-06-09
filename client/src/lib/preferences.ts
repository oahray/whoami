export const STORAGE_KEY_SFX_ENABLED = 'whoami_sfx_enabled'

const DEFAULT_SFX_ENABLED = true

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

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Whether sound effects may play (user pref + system reduced motion). */
export function isSfxPlaybackAllowed(sfxEnabled: boolean): boolean {
  return sfxEnabled && !prefersReducedMotion()
}
