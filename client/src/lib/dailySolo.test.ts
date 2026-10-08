import { beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveDailyStreak,
  getDailyBestScore,
  hydrateDailyCardCache,
  loadDailyProgress,
  saveDailyResult,
  type DailyChallenge
} from './dailySolo'
import {
  peekCachedDailyCard,
  resetInPersonCardCacheForTests
} from './inPersonCardFetch'
import type { SoloRecord } from './soloSession'

function record(): SoloRecord {
  return {
    datasetId: 'ds-1',
    difficulty: [],
    entityType: 'all',
    variation: 'daily',
    roundDurationMs: 30_000,
    clueRevealIntervalMs: 5_000,
    correctCount: 8,
    activeElapsedMs: 100_000,
    score: 6400,
    achievedAt: '2026-10-01T12:00:00Z'
  }
}

describe('dailySolo', () => {
  beforeEach(() => {
    localStorage.clear()
    resetInPersonCardCacheForTests()
  })

  it('increments consecutive daily completions exactly once', () => {
    saveDailyResult({
      challengeId: '2026-10-01-v1',
      dateKey: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      record: record()
    })
    const second = saveDailyResult({
      challengeId: '2026-10-02-v1',
      dateKey: '2026-10-02',
      completedAt: '2026-10-02T12:00:00Z',
      record: record()
    })
    expect(second.currentStreak).toBe(2)
    expect(loadDailyProgress().bestStreak).toBe(2)
  })

  it('returns the highest completed Daily score', () => {
    expect(getDailyBestScore(loadDailyProgress())).toBeNull()
    saveDailyResult({
      challengeId: '2026-10-01-v1',
      dateKey: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      record: { ...record(), score: 6400 }
    })
    const progress = saveDailyResult({
      challengeId: '2026-10-02-v1',
      dateKey: '2026-10-02',
      completedAt: '2026-10-02T12:00:00Z',
      record: { ...record(), score: 7200 }
    })

    expect(getDailyBestScore(progress)).toBe(7200)
  })

  it('keeps yesterday’s streak alive and clears a missed day', () => {
    const progress = saveDailyResult({
      challengeId: '2026-10-01-v1',
      dateKey: '2026-10-01',
      completedAt: '2026-10-01T12:00:00Z',
      record: record()
    })

    expect(getActiveDailyStreak(progress, '2026-10-01')).toBe(1)
    expect(getActiveDailyStreak(progress, '2026-10-02')).toBe(1)
    expect(getActiveDailyStreak(progress, '2026-10-03')).toBe(0)
    expect(progress.bestStreak).toBe(1)
  })

  it('hydrates the Daily card cache from the challenge snapshot', () => {
    const challenge: DailyChallenge = {
      challengeId: '2026-10-02-v1',
      challengeVersion: 1,
      dateKey: '2026-10-02',
      datasetId: 'ds-1',
      datasetName: 'Bible',
      difficulty: 'any',
      entityType: 'all',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 5_000,
      entityIds: ['ent-1'],
      cards: {
        'ent-1': {
          entity: { id: 'ent-1', name: 'Moses', type: 'character', aliases: [] },
          clues: [{ order: 1, text: 'Frozen clue', citations: null }]
        }
      },
      scoringVersion: 1,
      scoringRules: {
        basePoints: 1000,
        additionalCluePenalty: 150,
        elapsedSecondPenalty: 10,
        incorrectGuessPenalty: 100,
        minimumCorrectScore: 100
      }
    }

    hydrateDailyCardCache(challenge)

    expect(peekCachedDailyCard('2026-10-02-v1', 'ent-1')?.clues[0]?.text).toBe('Frozen clue')
  })
})
