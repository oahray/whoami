import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { applyThemeMode } from '../lib/applyTheme'
import {
  isSfxPlaybackAllowed,
  prefersReducedMotion,
  readSfxEnabled,
  readTheme,
  resolveTheme,
  writeSfxEnabled,
  writeTheme,
  type ResolvedTheme,
  type ThemeMode
} from '../lib/preferences'

type PreferencesContextValue = {
  /** User wants sound effects when the system allows them. */
  sfxEnabled: boolean
  setSfxEnabled: (enabled: boolean) => void
  /** System prefers reduced motion; SFX stay off even if sfxEnabled is true. */
  reducedMotion: boolean
  /** Effective gate for playback (phase 2+). */
  sfxAllowed: boolean
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  resolvedTheme: ResolvedTheme
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [sfxEnabled, setSfxEnabledState] = useState(readSfxEnabled)
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const [theme, setThemeState] = useState<ThemeMode>(readTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readTheme()))

  useEffect(() => {
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => setReducedMotion(mqMotion.matches)
    onMotionChange()
    mqMotion.addEventListener('change', onMotionChange)
    return () => mqMotion.removeEventListener('change', onMotionChange)
  }, [])

  useEffect(() => {
    applyThemeMode(theme)
    setResolvedTheme(resolveTheme(theme))

    if (theme !== 'system') return

    const mqColor = window.matchMedia('(prefers-color-scheme: dark)')
    const onColorChange = () => {
      applyThemeMode('system')
      setResolvedTheme(resolveTheme('system'))
    }
    mqColor.addEventListener('change', onColorChange)
    return () => mqColor.removeEventListener('change', onColorChange)
  }, [theme])

  const setSfxEnabled = useCallback((enabled: boolean) => {
    setSfxEnabledState(enabled)
    writeSfxEnabled(enabled)
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    writeTheme(mode)
    applyThemeMode(mode)
    setResolvedTheme(resolveTheme(mode))
  }, [])

  const value = useMemo(
    () => ({
      sfxEnabled,
      setSfxEnabled,
      reducedMotion,
      sfxAllowed: isSfxPlaybackAllowed(sfxEnabled),
      theme,
      setTheme,
      resolvedTheme
    }),
    [sfxEnabled, setSfxEnabled, reducedMotion, theme, setTheme, resolvedTheme]
  )

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider')
  }
  return ctx
}
