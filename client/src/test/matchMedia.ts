import { vi } from 'vitest'

type MatchMediaOptions = {
  reducedMotion?: boolean
  prefersDark?: boolean
}

/** Stub matchMedia for tests that need reduced-motion and/or color-scheme queries. */
export function stubMatchMedia(options: MatchMediaOptions = {}): void {
  const { reducedMotion = false, prefersDark = false } = options

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion')
        ? reducedMotion
        : query.includes('prefers-color-scheme: dark')
          ? prefersDark
          : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  )
}
