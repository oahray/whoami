import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { applyAdminThemeMode } from '../lib/applyTheme'
import {
  readAdminTheme,
  resolveAdminTheme,
  writeAdminTheme,
  type AdminThemeMode,
  type ResolvedAdminTheme
} from '../lib/theme'

type ThemeContextValue = {
  theme: AdminThemeMode
  setTheme: (mode: AdminThemeMode) => void
  resolvedTheme: ResolvedAdminTheme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AdminThemeMode>(readAdminTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedAdminTheme>(() =>
    resolveAdminTheme(readAdminTheme())
  )

  useEffect(() => {
    applyAdminThemeMode(theme)
    setResolvedTheme(resolveAdminTheme(theme))

    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      applyAdminThemeMode('system')
      setResolvedTheme(resolveAdminTheme('system'))
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((mode: AdminThemeMode) => {
    setThemeState(mode)
    writeAdminTheme(mode)
    applyAdminThemeMode(mode)
    setResolvedTheme(resolveAdminTheme(mode))
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
