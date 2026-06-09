import { afterEach, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { stubMatchMedia } from './matchMedia'

expect.extend(matchers)

stubMatchMedia()

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
})
