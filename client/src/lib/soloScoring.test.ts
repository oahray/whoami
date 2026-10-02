import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scoreSoloRound } from './soloScoring'

describe('scoreSoloRound', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('requests the canonical server score', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 630,
        basePoints: 1000,
        cluePenalty: 150,
        timePenalty: 120,
        incorrectGuessPenalty: 100,
        bonusPoints: 0
      })
    } as Response)

    const result = await scoreSoloRound({
      correct: true,
      elapsedMs: 12_900,
      revealedClueCount: 2,
      incorrectGuessCount: 1
    })

    expect(result.score).toBe(630)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/cards/score'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          correct: true,
          elapsedMs: 12_900,
          revealedClueCount: 2,
          incorrectGuessCount: 1
        })
      })
    )
  })
})
