import { afterEach, beforeEach, expect } from 'vitest'
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
  document.documentElement.classList.remove('dark')
})
