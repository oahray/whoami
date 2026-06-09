import { resolveAdminTheme, type AdminThemeMode } from './theme'

const THEME_COLOR_LIGHT = '#18181b'
const THEME_COLOR_DARK = '#09090b'

export function applyResolvedAdminTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', resolved === 'dark')

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
  }
}

export function applyAdminThemeMode(mode: AdminThemeMode): void {
  applyResolvedAdminTheme(resolveAdminTheme(mode))
}
