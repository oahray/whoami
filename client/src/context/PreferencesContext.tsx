import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import {
  isSfxPlaybackAllowed,
  prefersReducedMotion,
  readSfxEnabled,
  writeSfxEnabled
} from '../lib/preferences'

type PreferencesContextValue = {
  /** User wants sound effects when the system allows them. */
  sfxEnabled: boolean
  setSfxEnabled: (enabled: boolean) => void
  /** System prefers reduced motion — SFX stay off even if sfxEnabled is true. */
  reducedMotion: boolean
  /** Effective gate for playback (phase 2+). */
  sfxAllowed: boolean
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [sfxEnabled, setSfxEnabledState] = useState(readSfxEnabled)
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setSfxEnabled = useCallback((enabled: boolean) => {
    setSfxEnabledState(enabled)
    writeSfxEnabled(enabled)
  }, [])

  const value = useMemo(
    () => ({
      sfxEnabled,
      setSfxEnabled,
      reducedMotion,
      sfxAllowed: isSfxPlaybackAllowed(sfxEnabled)
    }),
    [sfxEnabled, setSfxEnabled, reducedMotion]
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
