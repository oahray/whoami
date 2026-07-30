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
import { enableAndStartMenuMusic, stopMenuMusic } from '../lib/menuMusic'
import {
  isMusicPlaybackAllowed,
  isSfxPlaybackAllowed,
  prefersReducedMotion,
  readMusicEnabled,
  readSfxEnabled,
  readTheme,
  resolveTheme,
  writeMusicEnabled,
  writeSfxEnabled,
  writeTheme,
  type ResolvedTheme,
  type ThemeMode
} from '../lib/preferences'

type PreferencesContextValue = {
  /** User wants sound effects when the system allows them. */
  sfxEnabled: boolean
  setSfxEnabled: (enabled: boolean) => void
  /** User wants menu theme music when the system allows it. */
  musicEnabled: boolean
  setMusicEnabled: (enabled: boolean) => void
  /** System prefers reduced motion; SFX and music stay off even if enabled. */
  reducedMotion: boolean
  /** Effective gate for SFX playback. */
  sfxAllowed: boolean
  /** Effective gate for menu music playback. */
  musicAllowed: boolean
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  resolvedTheme: ResolvedTheme
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [sfxEnabled, setSfxEnabledState] = useState(readSfxEnabled)
  const [musicEnabled, setMusicEnabledState] = useState(readMusicEnabled)
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

  const setMusicEnabled = useCallback((enabled: boolean) => {
    setMusicEnabledState(enabled)
    writeMusicEnabled(enabled)
    if (enabled) {
      enableAndStartMenuMusic()
    } else {
      stopMenuMusic()
    }
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
      musicEnabled,
      setMusicEnabled,
      reducedMotion,
      sfxAllowed: isSfxPlaybackAllowed(sfxEnabled),
      musicAllowed: isMusicPlaybackAllowed(musicEnabled),
      theme,
      setTheme,
      resolvedTheme
    }),
    [
      sfxEnabled,
      setSfxEnabled,
      musicEnabled,
      setMusicEnabled,
      reducedMotion,
      theme,
      setTheme,
      resolvedTheme
    ]
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
