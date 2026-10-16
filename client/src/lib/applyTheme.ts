import { resolveTheme, type ColorPalette, type ThemeMode } from './preferences'

const THEME_COLOR_DARK = '#101322'

/** Browser chrome color for each palette in light mode. Dark mode keeps the app background. */
export const PALETTE_THEME_COLOR: Record<ColorPalette, string> = {
  blue: '#2b4bee',
  green: '#0e6b45',
  wine: '#7a2a3a',
  purple: '#4c2a9e'
}

function currentPalette(): ColorPalette {
  const raw = document.documentElement.dataset.palette
  if (raw === 'green' || raw === 'wine' || raw === 'purple' || raw === 'blue') return raw
  return 'blue'
}

function syncThemeColor(palette: ColorPalette): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  const dark = document.documentElement.classList.contains('dark')
  meta.setAttribute('content', dark ? THEME_COLOR_DARK : PALETTE_THEME_COLOR[palette])
}

export function applyPalette(palette: ColorPalette): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.palette = palette
  syncThemeColor(palette)
}

export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', resolved === 'dark')
  syncThemeColor(currentPalette())
}

export function applyThemeMode(mode: ThemeMode): void {
  applyResolvedTheme(resolveTheme(mode))
}
