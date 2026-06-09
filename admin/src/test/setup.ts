import { afterEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: query.includes('prefers-color-scheme: dark'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
)

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
})
