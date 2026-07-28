import { describe, expect, it } from 'vitest'
import { validateGuess } from './guessValidation'

describe('validateGuess', () => {
  it('matches names case-insensitively', () => {
    expect(validateGuess('  mOsEs ', 'Moses')).toBe(true)
  })

  it('matches aliases', () => {
    expect(validateGuess('Moshe', 'Moses', ['Moshe'])).toBe(true)
  })

  it('uses lenient article and punctuation matching by default', () => {
    expect(validateGuess("the lion's den", 'Lion-s Den')).toBe(true)
  })

  it('keeps strict matching available', () => {
    expect(validateGuess('the Moses', 'Moses', [], true)).toBe(false)
  })
})
