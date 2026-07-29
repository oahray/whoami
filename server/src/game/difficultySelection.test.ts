import { describe, expect, it } from 'vitest'
import {
  countCluesForSelection,
  encodeDifficultySelection,
  normalizeDifficultySelection,
  parseDifficultySelection
} from './difficultySelection.js'

describe('difficultySelection', () => {
  it('treats any / empty / all four tiers as any', () => {
    expect(parseDifficultySelection('any')).toEqual([])
    expect(parseDifficultySelection('')).toEqual([])
    expect(parseDifficultySelection(['easy', 'medium', 'hard', 'nightmare'])).toEqual([])
    expect(encodeDifficultySelection([])).toBe('any')
  })

  it('parses and sorts multi-select tiers', () => {
    expect(parseDifficultySelection('nightmare,hard')).toEqual(['hard', 'nightmare'])
    expect(parseDifficultySelection(['nightmare', 'easy'])).toEqual(['easy', 'nightmare'])
    expect(normalizeDifficultySelection(['hard', 'hard', 'easy'])).toEqual(['easy', 'hard'])
  })

  it('rejects unknown tiers', () => {
    expect(parseDifficultySelection('legendary')).toBeNull()
    expect(parseDifficultySelection('easy,nope')).toBeNull()
  })

  it('counts clues across selected tiers', () => {
    const counts = { any: 10, easy: 4, medium: 3, hard: 2, nightmare: 1 }
    expect(countCluesForSelection(counts, [])).toBe(10)
    expect(countCluesForSelection(counts, ['hard', 'nightmare'])).toBe(3)
  })
})
