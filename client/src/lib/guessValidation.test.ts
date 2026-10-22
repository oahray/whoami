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

  it('accepts qualifiers without brackets, in any order, only when they are right', () => {
    expect(validateGuess('Simon the Zealot', 'Simon (the Zealot)')).toBe(true)
    expect(validateGuess('Zealot Simon', 'Simon (the Zealot)')).toBe(true)
    expect(validateGuess('Joseph of Arimathea', 'Joseph (of Arimathea)')).toBe(true)
    expect(validateGuess('Simon the Zealot', 'Simon (the Zealot)', [], true)).toBe(true)
    expect(validateGuess('Simon Zealot', 'Simon (the Zealot)', [], true)).toBe(false)
    expect(validateGuess('Simon the Zelot', 'Simon (the Zealot)')).toBe(true)
    expect(validateGuess('John the Baptist', 'John (the apostle)')).toBe(false)
    expect(validateGuess('Herod Antipas', 'Herod (the Great)', ['Antipas'], false)).toBe(false)
    expect(validateGuess('Herod Antipas', 'Herod (Antipas)')).toBe(true)
  })

  it('accepts titles in front of a name', () => {
    expect(validateGuess('King David', 'David')).toBe(true)
    expect(validateGuess('King David', 'David', [], true)).toBe(true)
    expect(validateGuess('Prophet Elijah', 'Elijah')).toBe(true)
    expect(validateGuess('St. Peter', 'Peter')).toBe(true)
    expect(validateGuess('Saint Peter', 'Peter')).toBe(true)
    expect(validateGuess('High Priest Eli', 'Eli')).toBe(true)
    expect(validateGuess('Apostle John', 'John (the apostle)')).toBe(true)
    expect(validateGuess('Prophet Nathan', 'Nathan (the prophet)')).toBe(true)
    expect(validateGuess('King Saul', 'David')).toBe(false)
    expect(validateGuess('King', 'David')).toBe(false)
    expect(validateGuess('Pharaoh', 'Pharaoh (the plagues)')).toBe(true)
  })

  it('ignores accents', () => {
    expect(validateGuess('Élijah', 'Elijah')).toBe(true)
    expect(validateGuess('Élijah', 'Elijah', [], true)).toBe(true)
  })

  it('treats a comma like brackets', () => {
    expect(validateGuess('Abimelech, king of Gerar', 'Abimelech (king of Gerar)')).toBe(true)
    expect(validateGuess('Abimelech, son of Gideon', 'Abimelech (king of Gerar)')).toBe(false)
  })

  it('keeps strict mode for spelling only (no articles or typos)', () => {
    expect(validateGuess('the Moses', 'Moses', [], true)).toBe(false)
    expect(validateGuess('Pharoah', 'Pharaoh', [], true)).toBe(false)
    expect(validateGuess('John Baptist', 'John the Baptist', [], true)).toBe(false)
  })
})

describe('guessCloseness', () => {
  it('ignores titles and commas like validateGuess does', () => {
    expect(guessCloseness('King Davd', 'David')).toBe('close')
    expect(guessCloseness('King Davd', 'David', [], true)).toBe('close')
    expect(guessCloseness('Simon, the Zelot', 'Simon (the Zealot)', [], true)).toBe('spelling')
  })

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
