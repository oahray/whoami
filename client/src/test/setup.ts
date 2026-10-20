import { afterEach, beforeEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { stubMatchMedia } from './matchMedia'

expect.extend(matchers)

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
