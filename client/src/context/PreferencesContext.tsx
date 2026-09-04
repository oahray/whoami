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
  applyMenuMusicVolume,
  enableAndStartMenuMusic,
  stopMenuMusic
} from '../lib/menuMusic'
import {
  clampVolume,
  isMusicPlaybackAllowed,
  isSfxPlaybackAllowed,
  prefersReducedMotion,
  readMusicVolume,
  readMusicVolumeLast,
  readSfxVolume,
  readSfxVolumeLast,
  readTheme,
  resolveTheme,
  writeMusicVolume,
  writeSfxVolume,
  writeTheme,
  type ResolvedTheme,
  type ThemeMode
} from '../lib/preferences'

type PreferencesContextValue = {
  /** Sound effects volume 0–1 (0 = muted). */
  sfxVolume: number
  setSfxVolume: (volume: number) => void
  /** Menu theme music volume 0–1 (0 = muted). */
  musicVolume: number
  setMusicVolume: (volume: number) => void
  /** Convenience: sfxVolume > 0. */
  sfxEnabled: boolean
  /** Mute / restore last non-zero SFX volume. */
  setSfxEnabled: (enabled: boolean) => void
  /** Convenience: musicVolume > 0. */
  musicEnabled: boolean
  /** Mute / restore last non-zero music volume. */
  setMusicEnabled: (enabled: boolean) => void
  /** System prefers reduced motion; SFX and music stay off even if volume > 0. */
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
  const [sfxVolume, setSfxVolumeState] = useState(readSfxVolume)
  const [musicVolume, setMusicVolumeState] = useState(readMusicVolume)
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

  const setSfxVolume = useCallback((volume: number) => {
    const next = clampVolume(volume)
    setSfxVolumeState(next)
    writeSfxVolume(next)
  }, [])

  const setMusicVolume = useCallback((volume: number) => {
    const previous = readMusicVolume()
    const next = clampVolume(volume)
    setMusicVolumeState(next)
    writeMusicVolume(next)
    if (next > 0) {
      if (previous <= 0) {
        enableAndStartMenuMusic()
      } else {
        applyMenuMusicVolume()
      }
    } else {
      stopMenuMusic()
    }
  }, [])

  const setSfxEnabled = useCallback((enabled: boolean) => {
    setSfxVolume(enabled ? readSfxVolumeLast() : 0)
  }, [setSfxVolume])

  const setMusicEnabled = useCallback(
    (enabled: boolean) => {
      setMusicVolume(enabled ? readMusicVolumeLast() : 0)
    },
    [setMusicVolume]
  )

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    writeTheme(mode)
    applyThemeMode(mode)
    setResolvedTheme(resolveTheme(mode))
  }, [])

  const value = useMemo(
    () => ({
      sfxVolume,
      setSfxVolume,
      musicVolume,
      setMusicVolume,
      sfxEnabled: sfxVolume > 0,
      setSfxEnabled,
      musicEnabled: musicVolume > 0,
      setMusicEnabled,
      reducedMotion,
      sfxAllowed: isSfxPlaybackAllowed(sfxVolume),
      musicAllowed: isMusicPlaybackAllowed(musicVolume),
      theme,
      setTheme,
      resolvedTheme
    }),
    [
      sfxVolume,
      setSfxVolume,
      musicVolume,
      setMusicVolume,
      setSfxEnabled,
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
