import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { applyThemeMode } from '../lib/applyTheme'
import {
  applyMenuMusicVolume,
  stopMenuMusic
} from '../lib/menuMusic'
import {
  clampMusicVolume,
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

type MuteSnapshot = {
  sfx: number
  music: number
}

type PreferencesContextValue = {
  /** Sound effects volume 0–1 (0 = muted). */
  sfxVolume: number
  setSfxVolume: (volume: number) => void
  /** Menu theme music volume 0–MUSIC_VOLUME_MAX (0 = muted). */
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
  /**
   * Mute or unmute SFX + music together (in-game mute button).
   * Mute snapshots current levels; unmute restores that snapshot.
   */
  setSoundsEnabled: (enabled: boolean) => void
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
  const muteSnapshotRef = useRef<MuteSnapshot | null>(null)

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
    const next = clampMusicVolume(volume)
    setMusicVolumeState(next)
    writeMusicVolume(next)
    // Only update/stop the theme track here. Starting playback is owned by
    // `useMenuMusic` on lobby/setup screens — never force-start mid-game.
    if (next > 0) {
      applyMenuMusicVolume()
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

  const setSoundsEnabled = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        muteSnapshotRef.current = {
          sfx: readSfxVolume(),
          music: readMusicVolume()
        }
        setSfxVolume(0)
        setMusicVolume(0)
        return
      }

      const snapshot = muteSnapshotRef.current
      muteSnapshotRef.current = null
      if (snapshot) {
        setSfxVolume(snapshot.sfx)
        setMusicVolume(snapshot.music)
        return
      }

      setSfxVolume(readSfxVolumeLast())
      setMusicVolume(readMusicVolumeLast())
    },
    [setSfxVolume, setMusicVolume]
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
      setSoundsEnabled,
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
      setSoundsEnabled,
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
