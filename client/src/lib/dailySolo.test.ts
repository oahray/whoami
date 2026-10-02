import { beforeEach, describe, expect, it } from 'vitest'
import { loadDailyProgress, saveDailyResult } from './dailySolo'
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
  beforeEach(() => localStorage.clear())

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
      record: { ...record(), achievedAt: '2026-10-02T12:00:00Z' }
    })
    const duplicate = saveDailyResult({
      challengeId: '2026-10-02-v1',
      dateKey: '2026-10-02',
      completedAt: '2026-10-02T13:00:00Z',
      record: record()
    })

    expect(second.currentStreak).toBe(2)
    expect(duplicate.currentStreak).toBe(2)
    expect(Object.keys(loadDailyProgress().results)).toHaveLength(2)
  })
})
