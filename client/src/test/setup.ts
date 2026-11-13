import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { stubMatchMedia } from './matchMedia'

stubMatchMedia()

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.documentElement.classList.remove('dark')
  document.documentElement.removeAttribute('data-palette')
})
