import { describe, it, expect } from 'vitest'
import { validateGuess } from './validation.js'

describe('validateGuess', () => {
  const answer = 'Moses'

  describe('exact matches', () => {
    it('should match exact string', () => {
      expect(validateGuess('Moses', answer, false)).toBe(true)
      expect(validateGuess('Moses', answer, true)).toBe(true)
    })

    it('should match case-insensitively', () => {
      expect(validateGuess('moses', answer, false)).toBe(true)
      expect(validateGuess('MOSES', answer, false)).toBe(true)
      expect(validateGuess('MoSeS', answer, false)).toBe(true)
      expect(validateGuess('moses', answer, true)).toBe(true)
      expect(validateGuess('MOSES', answer, true)).toBe(true)
    })

    it('should match with leading/trailing whitespace', () => {
      expect(validateGuess('  Moses  ', answer, false)).toBe(true)
      expect(validateGuess(' Moses', answer, false)).toBe(true)
      expect(validateGuess('Moses ', answer, false)).toBe(true)
      expect(validateGuess('  Moses  ', answer, true)).toBe(true)
    })

    it('should normalize multiple spaces', () => {
      expect(validateGuess('Moses   ', answer, false)).toBe(true)
      expect(validateGuess('  Moses', answer, false)).toBe(true)
      expect(validateGuess('Moses   ', answer, true)).toBe(true)
    })
  })

  describe('non-matches', () => {
    it('should reject incorrect guesses', () => {
      expect(validateGuess('David', answer, false)).toBe(false)
      expect(validateGuess('Abraham', answer, false)).toBe(false)
      expect(validateGuess('David', answer, true)).toBe(false)
    })

    it('should reject partial matches', () => {
      expect(validateGuess('Mose', answer, false)).toBe(false)
      expect(validateGuess('oses', answer, false)).toBe(false)
      expect(validateGuess('Mose', answer, true)).toBe(false)
    })

    it('should reject guesses with extra characters', () => {
      expect(validateGuess('Moses1', answer, false)).toBe(false)
      expect(validateGuess('Moses!', answer, false)).toBe(false)
      expect(validateGuess('Moses the prophet', answer, false)).toBe(false)
      expect(validateGuess('Moses1', answer, true)).toBe(false)
      expect(validateGuess('Moses!', answer, true)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(validateGuess('', answer, false)).toBe(false)
      expect(validateGuess('', answer, true)).toBe(false)
      expect(validateGuess('Moses', '', false)).toBe(false)
      expect(validateGuess('Moses', '', true)).toBe(false)
      expect(validateGuess('', '', false)).toBe(false)
    })

    it('should handle whitespace-only strings', () => {
      expect(validateGuess('   ', answer, false)).toBe(false)
      expect(validateGuess('   ', answer, true)).toBe(false)
    })

    it('should handle null/undefined-like inputs', () => {
      expect(validateGuess(null as any, answer, false)).toBe(false)
      expect(validateGuess(undefined as any, answer, false)).toBe(false)
      expect(validateGuess(null as any, answer, true)).toBe(false)
      expect(validateGuess(undefined as any, answer, true)).toBe(false)
    })
  })

  describe('multi-word answers', () => {
    const multiWordAnswer = 'John the Baptist'

    it('should match multi-word answers exactly', () => {
      expect(validateGuess('John the Baptist', multiWordAnswer, false)).toBe(true)
      expect(validateGuess('john the baptist', multiWordAnswer, false)).toBe(true)
      expect(validateGuess('JOHN THE BAPTIST', multiWordAnswer, false)).toBe(true)
      expect(validateGuess('John the Baptist', multiWordAnswer, true)).toBe(true)
    })

    it('should normalize multiple spaces in multi-word', () => {
      expect(validateGuess('John   the   Baptist', multiWordAnswer, false)).toBe(true)
      expect(validateGuess('  John the Baptist  ', multiWordAnswer, false)).toBe(true)
      expect(validateGuess('John   the   Baptist', multiWordAnswer, true)).toBe(true)
    })

    it('should reject incorrect multi-word guesses', () => {
      expect(validateGuess('John Baptist', multiWordAnswer, false)).toBe(true)
      expect(validateGuess('John the', multiWordAnswer, false)).toBe(false)
      expect(validateGuess('the Baptist', multiWordAnswer, false)).toBe(false)
      expect(validateGuess('John Baptist', multiWordAnswer, true)).toBe(false)
    })
  })

  describe('special characters', () => {
    it('should handle answers with apostrophes in strict mode', () => {
      const answerWithApostrophe = "O'Brien"
      expect(validateGuess("O'Brien", answerWithApostrophe, true)).toBe(true)
      expect(validateGuess("o'brien", answerWithApostrophe, true)).toBe(true)
      expect(validateGuess("O'BRIEN", answerWithApostrophe, true)).toBe(true)
    })

    it('should handle answers with hyphens in strict mode', () => {
      const answerWithHyphen = 'Mary-Magdalene'
      expect(validateGuess('Mary-Magdalene', answerWithHyphen, true)).toBe(true)
      expect(validateGuess('mary-magdalene', answerWithHyphen, true)).toBe(true)
    })

    it('should allow punctuation variations in non-strict mode', () => {
      const answerWithApostrophe = "O'Brien"
      expect(validateGuess("O'Brien", answerWithApostrophe, false)).toBe(true)
      expect(validateGuess("O Brien", answerWithApostrophe, false)).toBe(true)

      const answerWithHyphen = 'Mary-Magdalene'
      expect(validateGuess('Mary-Magdalene', answerWithHyphen, false)).toBe(true)
      expect(validateGuess('Mary Magdalene', answerWithHyphen, false)).toBe(true)
      expect(validateGuess('MaryMagdalene', answerWithHyphen, false)).toBe(true)
    })

    it('should ignore parenthetical clarifications in non-strict mode', () => {
      expect(validateGuess('Jude', "Jude (Jesus' brother)", false)).toBe(true)
      expect(validateGuess("Jude (Jesus' brother)", "Jude (Jesus' brother)", false)).toBe(true)
      expect(validateGuess('Jude', "Jude (Jesus' brother)", true)).toBe(false)
    })
  })

  describe('strict mode vs non-strict mode', () => {
    it('should match exact strings in both modes', () => {
      const testCases = [
        ['Moses', 'Moses'],
        ['moses', 'Moses'],
        ['  Moses  ', 'Moses'],
        ['John the Baptist', 'John the Baptist']
      ]

      testCases.forEach(([guess, ans]) => {
        expect(validateGuess(guess, ans, false)).toBe(true)
        expect(validateGuess(guess, ans, true)).toBe(true)
      })
    })

    it('should reject incorrect guesses in both modes', () => {
      const testCases = [
        ['David', 'Moses'],
        ['Mose', 'Moses'],
        ['Moses1', 'Moses']
      ]

      testCases.forEach(([guess, ans]) => {
        expect(validateGuess(guess, ans, false)).toBe(false)
        expect(validateGuess(guess, ans, true)).toBe(false)
      })
    })

    it('should allow punctuation variations in non-strict mode', () => {
      expect(validateGuess('Mary-Magdalene', 'Mary Magdalene', false)).toBe(true)
      expect(validateGuess('Mary Magdalene', 'Mary-Magdalene', false)).toBe(true)
      expect(validateGuess("O'Brien", "O Brien", false)).toBe(true)
      expect(validateGuess("O Brien", "O'Brien", false)).toBe(true)
    })

    it('should require exact punctuation in strict mode', () => {
      expect(validateGuess('Mary-Magdalene', 'Mary Magdalene', true)).toBe(false)
      expect(validateGuess('Mary Magdalene', 'Mary-Magdalene', true)).toBe(false)
      expect(validateGuess("O'Brien", "O Brien", true)).toBe(false)
      expect(validateGuess("O Brien", "O'Brien", true)).toBe(false)
    })

    it('should ignore articles (the, a, an) in non-strict mode', () => {
      expect(validateGuess('John the Baptist', 'John Baptist', false)).toBe(true)
      expect(validateGuess('John Baptist', 'John the Baptist', false)).toBe(true)
      expect(validateGuess('A Prophet', 'Prophet', false)).toBe(true)
      expect(validateGuess('An Angel', 'Angel', false)).toBe(true)
    })

    it('should require articles in strict mode', () => {
      expect(validateGuess('John the Baptist', 'John Baptist', true)).toBe(false)
      expect(validateGuess('John Baptist', 'John the Baptist', true)).toBe(false)
    })
  })

  describe('aliases', () => {
    it('matches the canonical answer when aliases are present', () => {
      expect(validateGuess('Peter', 'Peter', false, ['Simon', 'Cephas'])).toBe(true)
      expect(validateGuess('peter', 'Peter', true, ['Simon'])).toBe(true)
    })

    it('matches against an alias (lenient)', () => {
      expect(validateGuess('Simon', 'Peter', false, ['Simon', 'Cephas'])).toBe(true)
      expect(validateGuess('cephas', 'Peter', false, ['Simon', 'Cephas'])).toBe(true)
    })

    it('matches against an alias (strict)', () => {
      expect(validateGuess('Simon', 'Peter', true, ['Simon'])).toBe(true)
      expect(validateGuess('SIMON', 'Peter', true, ['Simon'])).toBe(true)
    })

    it('applies normalization rules to aliases too', () => {
      expect(validateGuess('Mary Magdalene', 'Mary', false, ['Mary-Magdalene'])).toBe(true)
      expect(validateGuess('Mary Magdalene', 'Mary', true, ['Mary-Magdalene'])).toBe(false)
    })

    it('rejects guesses that do not match any alias', () => {
      expect(validateGuess('Andrew', 'Peter', false, ['Simon', 'Cephas'])).toBe(false)
      expect(validateGuess('Andrew', 'Peter', true, ['Simon'])).toBe(false)
    })

    it('ignores empty / whitespace aliases', () => {
      expect(validateGuess('', 'Peter', false, ['', '   '])).toBe(false)
      expect(validateGuess('   ', 'Peter', false, ['', '   '])).toBe(false)
    })

    it('defaults aliases to an empty array', () => {
      expect(validateGuess('Peter', 'Peter')).toBe(true)
      expect(validateGuess('Simon', 'Peter')).toBe(false)
    })
  })
})
