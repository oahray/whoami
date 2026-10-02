import { describe, expect, it } from 'vitest'
import { estimateLegacySoloScore, scoreSoloRound } from './soloScoring'

describe('scoreSoloRound', () => {
  it('calculates a score locally from the supplied server rules', () => {
    const result = scoreSoloRound({
      correct: true,
      elapsedMs: 12_900,
      revealedClueCount: 2,
      incorrectGuessCount: 1
    })

    expect(result.score).toBe(630)
    expect(result).toMatchObject({
      cluePenalty: 150,
      timePenalty: 120,
      incorrectGuessPenalty: 100
    })
  })

  it('accepts versioned rule values delivered by the server', () => {
    expect(
      scoreSoloRound(
        {
          correct: true,
          elapsedMs: 1_000,
          revealedClueCount: 2,
          incorrectGuessCount: 1
        },
        {
          basePoints: 500,
          additionalCluePenalty: 50,
          elapsedSecondPenalty: 5,
          incorrectGuessPenalty: 25,
          minimumCorrectScore: 50
        }
      ).score
    ).toBe(420)
  })
})

describe('estimateLegacySoloScore', () => {
  it('returns 0 when nothing was correct', () => {
    expect(
      estimateLegacySoloScore({
        correctCount: 0,
        activeElapsedMs: 40_000,
        clueRevealIntervalMs: 10_000
      })
    ).toBe(0)
  })

  it('estimates from average time per correct and zero wrong guesses', () => {
    // 2 correct over 20s → 10s each → 1 + floor(10000/10000) = 2 clues
    // score = 1000 - 150 - 100 = 750 per correct → 1500 total
    expect(
      estimateLegacySoloScore({
        correctCount: 2,
        activeElapsedMs: 20_000,
        clueRevealIntervalMs: 10_000
      })
    ).toBe(1500)
  })
})
