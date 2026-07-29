import { describe, expect, it } from 'vitest'
import {
  coerceDifficultySelection,
  encodeDifficultySelection,
  parseDifficultySelection,
  toggleDifficultyTier
} from './difficultySelection'

describe('difficultySelection', () => {
  it('encodes any as any', () => {
    expect(encodeDifficultySelection([])).toBe('any')
    expect(parseDifficultySelection('hard,easy')).toEqual(['easy', 'hard'])
  })

  it('coerces legacy single-mode strings', () => {
    expect(coerceDifficultySelection('any')).toEqual([])
    expect(coerceDifficultySelection('nightmare')).toEqual(['nightmare'])
  })

  it('toggles from any into a subset and back', () => {
    expect(toggleDifficultyTier([], 'easy')).toEqual(['easy'])
    expect(toggleDifficultyTier(['hard'], 'nightmare')).toEqual(['hard', 'nightmare'])
    expect(toggleDifficultyTier(['easy'], 'easy')).toEqual([])
  })
})
