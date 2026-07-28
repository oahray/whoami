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

  it('ignores parenthetical clarifications on the answer', () => {
    expect(validateGuess('Jude', "Jude (Jesus' brother)")).toBe(true)
    expect(validateGuess("Jude (Jesus' brother)", "Jude (Jesus' brother)")).toBe(true)
  })

  it('accepts hyphenated names with the dash omitted or replaced by a space', () => {
    expect(validateGuess('Mary Magdalene', 'Mary-Magdalene')).toBe(true)
    expect(validateGuess('MaryMagdalene', 'Mary-Magdalene')).toBe(true)
  })

  it('keeps strict matching available', () => {
    expect(validateGuess('the Moses', 'Moses', [], true)).toBe(false)
    expect(validateGuess('Jude', "Jude (Jesus' brother)", [], true)).toBe(false)
  })
})
