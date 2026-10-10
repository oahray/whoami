import { describe, expect, it } from 'vitest'
import { dailyChallengeId, dailyChallengeRules, isNightmareFriday } from './dailyChallenge.js'

describe('daily challenge rules', () => {
  it('keeps an ordinary day at 30 seconds and any difficulty', () => {
    expect(isNightmareFriday('2026-10-10')).toBe(false)
    expect(dailyChallengeId('2026-10-10')).toBe('2026-10-10-v1')
    expect(dailyChallengeRules('2026-10-10')).toEqual({
      difficulty: 'any',
      difficultySelection: [],
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 5_000
    })
  })

  it('uses nightmare clues and 45 seconds on Friday', () => {
    expect(isNightmareFriday('2026-10-09')).toBe(true)
    expect(isNightmareFriday('2026-10-16')).toBe(true)
    expect(dailyChallengeId('2026-10-16')).toBe('2026-10-16-v1-nightmare')
    expect(dailyChallengeRules('2026-10-16')).toEqual({
      difficulty: 'nightmare',
      difficultySelection: ['nightmare'],
      roundDurationMs: 45_000,
      clueRevealIntervalMs: 5_000
    })
  })
})
