import { beforeEach, describe, expect, it } from 'vitest'
import { describeSoloSetup, listTrendDays, parseSetupKey, recordTrendRun, setupKey, timeOfDay } from './soloTrends'
import type { SoloRecord, SoloRoundPerformance } from './soloSession'

const round = (over: Partial<SoloRoundPerformance> = {}): SoloRoundPerformance => ({
  entityId: 'x',
  entityType: 'character',
  correct: true,
  revealedClueCount: 1,
  incorrectGuessCount: 0,
  elapsedMs: 8_000,
  score: 900,
  breakdown: { score: 900, basePoints: 1000, cluePenalty: 0, timePenalty: 100, incorrectGuessPenalty: 0, bonusPoints: 0 },
  ...over
})

const record = (variation: SoloRecord['variation'], rounds: SoloRoundPerformance[], score: number): SoloRecord => ({
  datasetId: 'ds-1',
  difficulty: [],
  entityType: 'all',
  variation,
  roundDurationMs: 30_000,
  clueRevealIntervalMs: 5_000,
  correctCount: rounds.filter((r) => r.correct).length,
  activeElapsedMs: 60_000,
  score,
  rounds,
  achievedAt: '2026-10-21T10:00:00Z'
})

describe('recordTrendRun', () => {
  beforeEach(() => localStorage.clear())

  it('adds runs on the same local day together', () => {
    const morning = new Date(2026, 9, 21, 9, 0)
    const evening = new Date(2026, 9, 21, 19, 0)
    recordTrendRun(record('endurance', [round(), round({ revealedClueCount: 2, incorrectGuessCount: 1 }), round({ correct: false })], 1800), morning)
    recordTrendRun(record('endurance', [round({ elapsedMs: 3_000 }), round({ correct: false })], 900), evening)

    expect(listTrendDays('endurance')).toEqual([
      {
        v: 1,
        variation: 'endurance',
        dateKey: '2026-10-21',
        runs: 2,
        totalScore: 2700,
        bestScore: 1800,
        cards: 5,
        correct: 3,
        solvedOnClue: [2, 1],
        wrongGuesses: 1,
        timeMs: 120_000,
        fastestSolveMs: 3_000,
        longestRun: 2,
        byType: { character: [3, 5], place: [0, 0] },
        timesOfDay: { morning: 1, evening: 1 },
        setups: { 'any|all|30000|5000': 2 }
      }
    ])
    expect(listTrendDays('challenge')).toEqual([])
  })

  it('ignores Review and Daily runs', () => {
    recordTrendRun(record('review', [round()], 900))
    recordTrendRun(record('daily', [round()], 900))
    expect(listTrendDays('challenge')).toEqual([])
    expect(listTrendDays('endurance')).toEqual([])
  })

  it('buckets the time of day', () => {
    expect(timeOfDay(4)).toBe('night')
    expect(timeOfDay(5)).toBe('morning')
    expect(timeOfDay(12)).toBe('afternoon')
    expect(timeOfDay(17)).toBe('evening')
    expect(timeOfDay(21)).toBe('night')
  })
})

describe('Solo setups', () => {
  const setup = {
    difficulty: ['easy', 'medium'] as Array<'easy' | 'medium'>,
    entityType: 'character' as const,
    roundDurationMs: 30_000,
    clueRevealIntervalMs: 5_000
  }

  it('reads the same way as the Start button', () => {
    expect(describeSoloSetup(setup)).toEqual({
      what: 'Characters, Easy + Medium',
      timing: '30s per card, new clue every 5s'
    })
    expect(describeSoloSetup({ ...setup, difficulty: [] }).what).toBe('Characters, All difficulties')
  })

  it('round-trips through its key', () => {
    expect(setupKey(setup)).toBe('easy,medium|character|30000|5000')
    expect(parseSetupKey(setupKey(setup))).toEqual(setup)
    expect(parseSetupKey('nonsense')).toBeNull()
  })
})
