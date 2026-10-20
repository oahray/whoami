import { describe, expect, it } from 'vitest'
import { closenessMessage, guessCloseness, validateGuess } from './guessValidation'

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

  it('ignores parentheticals only when the guess omits them', () => {
    expect(validateGuess('Jude', "Jude (Jesus' brother)")).toBe(true)
    expect(validateGuess("Jude (Jesus' brother)", "Jude (Jesus' brother)")).toBe(true)
    expect(validateGuess('Jude (wrong person)', "Jude (Jesus' brother)")).toBe(false)
    expect(validateGuess('Jude', "Jude (Jesus' brother)", [], true)).toBe(true)
    expect(validateGuess('Pharaoh', 'Pharaoh (Egypt)', [], true)).toBe(true)
    expect(validateGuess('Pharaoh (Nubia)', 'Pharaoh (Egypt)', [], true)).toBe(false)
  })

  it('accepts a single typo on longer names, including letter swaps', () => {
    expect(validateGuess('Pharoah', 'Pharaoh')).toBe(true)
    expect(validateGuess('Pharoah', 'Pharaoh (Egypt)')).toBe(true)
    // Short names stay exact to avoid Mark/Mary style collisions.
    expect(validateGuess('Mary', 'Mark')).toBe(false)
    expect(validateGuess('Mose', 'Moses')).toBe(false)
  })

  it('accepts hyphenated names with the dash omitted or replaced by a space', () => {
    expect(validateGuess('Mary Magdalene', 'Mary-Magdalene')).toBe(true)
    expect(validateGuess('MaryMagdalene', 'Mary-Magdalene')).toBe(true)
    expect(validateGuess('Mary Magdalene', 'Mary-Magdalene', [], true)).toBe(true)
  })

  it('keeps strict mode for spelling only (no articles or typos)', () => {
    expect(validateGuess('the Moses', 'Moses', [], true)).toBe(false)
    expect(validateGuess('Pharoah', 'Pharaoh', [], true)).toBe(false)
    expect(validateGuess('John Baptist', 'John the Baptist', [], true)).toBe(false)
  })
})

describe('guessCloseness', () => {
  it('matches the server rules', () => {
    expect(guessCloseness('Pharoah', 'Pharaoh', [], true)).toBe('spelling')
    expect(guessCloseness('Mark', 'Mary')).toBe('close')
    expect(guessCloseness('Nebuchadnezer', 'Nebuchadnezzar')).toBe('close')
    expect(guessCloseness('Simun Petr', 'Peter', ['Simon Peter'])).toBe('close')
    expect(guessCloseness('Lop', 'Lot')).toBeNull()
    expect(guessCloseness('Goliath', 'Moses')).toBeNull()
  })

  it('has player-facing messages', () => {
    expect(closenessMessage('spelling')).toBe('Right person, check the spelling.')
    expect(closenessMessage('close')).toBe('So close. Keep trying.')
    expect(closenessMessage(null)).toBeNull()
  })
})
