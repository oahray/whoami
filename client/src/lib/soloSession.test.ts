import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SOLO_CHALLENGE_ROUNDS,
  SOLO_RECORDS_PER_MODE,
  cardForCurrentSoloRound,
  continueEndurancePool,
  createSoloSession,
  formatSoloRecordAchievedAt,
  getSoloRecord,
  isBetterRecord,
  listSoloRecords,
  loadSoloSetupPreferences,
  saveSoloRecord,
  saveSoloSession,
  saveSoloSetupPreferences,
  loadSoloSession,
  type SoloConfig
} from './soloSession'

const config: SoloConfig = {
  datasetId: 'ds-1',
  difficulty: [],
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

  it('persists the current card so a reload keeps clue order', () => {
    const currentCard = {
      entity: { id: 'a', name: 'Moses', type: 'character' as const, aliases: [] },
      clues: [
        { order: 1, text: 'Shown first', citations: null },
        { order: 2, text: 'Shown second', citations: null }
      ]
    }
    const session = createSoloSession(config, ['a'])
    saveSoloSession({ ...session, currentCard })
    const loaded = loadSoloSession()
    expect(loaded?.currentCard).toEqual(currentCard)
    expect(cardForCurrentSoloRound(loaded!)).toEqual(currentCard)
  })

  it('ignores a stored card for a different entity', () => {
    const session = createSoloSession(config, ['a', 'b'])
    session.index = 1
    session.currentCard = {
      entity: { id: 'a', name: 'Moses', type: 'character', aliases: [] },
      clues: [{ order: 1, text: 'Old card', citations: null }]
    }
    expect(cardForCurrentSoloRound(session)).toBeNull()
  })

  it('clears a stored card when endurance reshuffles', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const continued = continueEndurancePool(
      {
        ...config,
        variation: 'endurance',
        entityIds: ['a', 'b', 'c'],
        index: 3,
        correctCount: 3,
        activeElapsedMs: 1000,
        currentCard: {
          entity: { id: 'c', name: 'Caleb', type: 'character', aliases: [] },
          clues: [{ order: 1, text: 'Old order', citations: null }]
        }
      },
      'a'
    )
    expect(continued.currentCard).toBeNull()
    expect(continued.entityIds[0]).not.toBe('a')
    vi.restoreAllMocks()
  })

  it('persists setup preferences for the next visit', () => {
    saveSoloSetupPreferences({
      ...config,
      roundDurationMs: 45_000,
      clueRevealIntervalMs: 5_000,
      variation: 'endurance'
    })
    expect(loadSoloSetupPreferences()).toMatchObject({
      datasetId: 'ds-1',
      variation: 'endurance',
      roundDurationMs: 45_000,
      clueRevealIntervalMs: 5_000
    })
  })

  it('orders records by correct count then active time', () => {
    expect(isBetterRecord({ correctCount: 8, activeElapsedMs: 1000 }, { correctCount: 7, activeElapsedMs: 1 })).toBe(true)
    expect(isBetterRecord({ correctCount: 8, activeElapsedMs: 900 }, { correctCount: 8, activeElapsedMs: 1000 })).toBe(true)
    expect(isBetterRecord({ correctCount: 8, activeElapsedMs: 1100 }, { correctCount: 8, activeElapsedMs: 1000 })).toBe(false)
  })

  it('keeps every attempt in the top list, including try-again scores', () => {
    const first = { ...config, correctCount: 7, activeElapsedMs: 40_000, achievedAt: '2026-01-01T00:00:00.000Z' }
    const retry = { ...first, correctCount: 4, activeElapsedMs: 35_000, achievedAt: '2026-01-02T00:00:00.000Z' }
    saveSoloRecord(first)
    saveSoloRecord(retry)
    expect(listSoloRecords('challenge', 'ds-1')).toHaveLength(2)
    expect(listSoloRecords('challenge', 'ds-1').map((r) => r.correctCount)).toEqual([7, 4])
  })

  it('caps each mode to the best five scores for a dataset', () => {
    for (let i = 0; i < SOLO_RECORDS_PER_MODE + 2; i += 1) {
      saveSoloRecord({
        ...config,
        correctCount: i + 1,
        activeElapsedMs: 50_000 - i * 1000,
        achievedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`
      })
    }
    const challenge = listSoloRecords('challenge', 'ds-1')
    expect(challenge).toHaveLength(SOLO_RECORDS_PER_MODE)
    expect(challenge.map((r) => r.correctCount)).toEqual([7, 6, 5, 4, 3])
  })

  it('scopes personal bests to the selected dataset', () => {
    saveSoloRecord({
      ...config,
      correctCount: 9,
      activeElapsedMs: 30_000,
      achievedAt: '2026-01-01T00:00:00.000Z'
    })
    saveSoloRecord({
      ...config,
      datasetId: 'ds-2',
      correctCount: 2,
      activeElapsedMs: 10_000,
      achievedAt: '2026-01-02T00:00:00.000Z'
    })
    expect(listSoloRecords('challenge', 'ds-1')).toHaveLength(1)
    expect(listSoloRecords('challenge', 'ds-2')[0]?.correctCount).toBe(2)
  })

  it('marks a new number-one score as a personal best', () => {
    saveSoloRecord({
      ...config,
      correctCount: 5,
      activeElapsedMs: 40_000,
      achievedAt: '2026-01-01T00:00:00.000Z'
    })
    const better = saveSoloRecord({
      ...config,
      correctCount: 8,
      activeElapsedMs: 42_000,
      achievedAt: '2026-01-02T00:00:00.000Z'
    })
    expect(better.isPersonalBest).toBe(true)
    expect(getSoloRecord(config)?.correctCount).toBe(8)
  })

  it('returns this attempt even when it is not a personal best', () => {
    const first = { ...config, correctCount: 8, activeElapsedMs: 40_000, achievedAt: '2026-01-01T00:00:00.000Z' }
    const worse = { ...first, correctCount: 3, activeElapsedMs: 50_000, achievedAt: '2026-01-02T00:00:00.000Z' }
    saveSoloRecord(first)
    const saved = saveSoloRecord(worse)
    expect(saved.isPersonalBest).toBe(false)
    expect(saved.record.correctCount).toBe(3)
    expect(getSoloRecord(config)?.correctCount).toBe(8)
  })

  it('lists personal records ranked by correct then time', () => {
    saveSoloRecord({
      ...config,
      variation: 'endurance',
      correctCount: 5,
      activeElapsedMs: 20_000,
      achievedAt: '2026-01-01T00:00:00.000Z'
    })
    saveSoloRecord({
      ...config,
      correctCount: 8,
      activeElapsedMs: 50_000,
      achievedAt: '2026-01-02T00:00:00.000Z'
    })
    saveSoloRecord({
      ...config,
      roundDurationMs: 45_000,
      correctCount: 8,
      activeElapsedMs: 40_000,
      achievedAt: '2026-01-03T00:00:00.000Z'
    })
    const listed = listSoloRecords()
    expect(listed.map((record) => [record.correctCount, record.activeElapsedMs])).toEqual([
      [8, 40_000],
      [8, 50_000],
      [5, 20_000]
    ])
    expect(listSoloRecords('challenge')).toHaveLength(2)
    expect(listSoloRecords('endurance')).toHaveLength(1)
  })

  it('reshuffles endurance pools without repeating the last card first', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const continued = continueEndurancePool(
      {
        ...config,
        variation: 'endurance',
        entityIds: ['a', 'b', 'c'],
        index: 3,
        correctCount: 3,
        activeElapsedMs: 1000
      },
      'a'
    )
    expect(continued.index).toBe(0)
    expect(continued.entityIds).toHaveLength(3)
    expect(continued.entityIds[0]).not.toBe('a')
    vi.restoreAllMocks()
  })

  it('formats personal-best timestamps as relative or calendar dates', () => {
    const now = Date.parse('2026-08-03T12:00:00.000Z')
    expect(formatSoloRecordAchievedAt('2026-08-03T11:59:30.000Z', now)).toBe('Just now')
    expect(formatSoloRecordAchievedAt('2026-08-03T10:00:00.000Z', now)).toBe('2h ago')
    expect(formatSoloRecordAchievedAt('2026-08-01T12:00:00.000Z', now)).toBe('2d ago')
    expect(formatSoloRecordAchievedAt('2026-01-15T12:00:00.000Z', now)).toMatch(/2026|Jan/)
  })
})
