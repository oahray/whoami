import { describe, expect, it } from 'vitest'
import { scoreSoloRound } from './soloScoring'

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
