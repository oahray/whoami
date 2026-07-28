import { beforeEach, describe, expect, it } from 'vitest'
import {
  SOLO_CHALLENGE_ROUNDS,
  createSoloSession,
  getSoloRecord,
  isBetterRecord,
  saveSoloRecord,
  saveSoloSession,
  loadSoloSession,
  type SoloConfig
} from './soloSession'

const config: SoloConfig = {
  datasetId: 'ds-1',
  difficulty: 'any',
  entityType: 'character',
  variation: 'challenge',
  roundDurationMs: 30_000,
  clueRevealIntervalMs: 10_000
}

describe('soloSession', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('limits challenge sessions to ten shuffled entities', () => {
    const session = createSoloSession(
      config,
      Array.from({ length: 15 }, (_, index) => `entity-${index}`)
    )
    expect(session.entityIds).toHaveLength(SOLO_CHALLENGE_ROUNDS)
  })

  it('keeps all entities for endurance', () => {
    const session = createSoloSession({ ...config, variation: 'endurance' }, ['a', 'b', 'c'])
    expect(session.entityIds).toEqual(['a', 'b', 'c'])
  })

  it('persists an active session', () => {
    const session = createSoloSession(config, ['a'])
    saveSoloSession(session)
    expect(loadSoloSession()).toEqual(session)
  })

  it('orders records by correct count then active time', () => {
    expect(isBetterRecord({ correctCount: 8, activeElapsedMs: 1000 }, { correctCount: 7, activeElapsedMs: 1 })).toBe(true)
    expect(isBetterRecord({ correctCount: 8, activeElapsedMs: 900 }, { correctCount: 8, activeElapsedMs: 1000 })).toBe(true)
    expect(isBetterRecord({ correctCount: 8, activeElapsedMs: 1100 }, { correctCount: 8, activeElapsedMs: 1000 })).toBe(false)
  })

  it('keeps the best record only within the same configuration', () => {
    const first = { ...config, correctCount: 7, activeElapsedMs: 40_000, achievedAt: '2026-01-01T00:00:00.000Z' }
    const better = { ...first, correctCount: 8, activeElapsedMs: 42_000, achievedAt: '2026-01-02T00:00:00.000Z' }
    saveSoloRecord(first)
    const saved = saveSoloRecord(better)
    expect(saved.isPersonalBest).toBe(true)
    expect(getSoloRecord(config)).toEqual(better)
    expect(getSoloRecord({ ...config, roundDurationMs: 45_000 })).toBeNull()
  })
})
