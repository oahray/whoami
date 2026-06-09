export const STORAGE_KEY_ADMIN_THEME = 'whoami_admin_theme'

export type AdminThemeMode = 'system' | 'light' | 'dark'
export type ResolvedAdminTheme = 'light' | 'dark'

const DEFAULT_THEME: AdminThemeMode = 'system'
const THEME_MODES: AdminThemeMode[] = ['system', 'light', 'dark']

export function readAdminTheme(): AdminThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ADMIN_THEME)
    if (raw && THEME_MODES.includes(raw as AdminThemeMode)) {
      return raw as AdminThemeMode
    }
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function writeAdminTheme(mode: AdminThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_ADMIN_THEME, mode)
  } catch {
    // private mode / quota
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveAdminTheme(mode: AdminThemeMode): ResolvedAdminTheme {
  if (mode === 'dark') return 'dark'
  if (mode === 'light') return 'light'
  return systemPrefersDark() ? 'dark' : 'light'
}
