import { resolveTheme, type ThemeMode } from './preferences'

const THEME_COLOR_LIGHT = '#2b4bee'
const THEME_COLOR_DARK = '#101322'

export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', resolved === 'dark')

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
  }
}

export function applyThemeMode(mode: ThemeMode): void {
  applyResolvedTheme(resolveTheme(mode))
}
