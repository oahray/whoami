import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyPlayCounts, recordPlayCount, resetPlayCountsForTests } from './playCounts.js'
import { getPlayCountsForRange, playCountSpan, utcWeekStart } from './playCountRange.js'

const stored = vi.hoisted(() => ({
  rows: [] as Array<{ day: string; counts: ReturnType<typeof emptyPlayCounts> }>
}))

vi.mock('../redis/client.js', () => ({
  isRedisConfigured: () => false,
  getRedis: async () => null
}))

vi.mock('./playCountDays.js', () => ({
  listPlayCountDays: async () => stored.rows
}))

const thursday = new Date('2026-10-08T15:00:00.000Z')

describe('play count ranges', () => {
  afterEach(() => {
    resetPlayCountsForTests()
    stored.rows = []
  })

  it('uses UTC days, with Monday as the start of the week', () => {
    expect(utcWeekStart('2026-10-08')).toBe('2026-10-05')
    expect(utcWeekStart('2026-10-11')).toBe('2026-10-05')
    expect(playCountSpan('today', thursday)).toEqual({
      from: '2026-10-08',
      to: '2026-10-08',
      includesToday: true
    })
    expect(playCountSpan('yesterday', thursday)).toEqual({
      from: '2026-10-07',
      to: '2026-10-07',
      includesToday: false
    })
    expect(playCountSpan('week', thursday).from).toBe('2026-10-05')
    expect(playCountSpan('month', thursday).from).toBe('2026-10-01')
    expect(playCountSpan('all', thursday)).toEqual({
      from: null,
      to: '2026-10-08',
      includesToday: true
    })
  })

  it('reads today live and does not add a stored copy of the open day', async () => {
    recordPlayCount('multiplayerRoomsCreated', thursday)
    const open = emptyPlayCounts()
    open.multiplayerRoomsCreated = 50
    stored.rows = [{ day: '2026-10-08', counts: open }]

    const { counts } = await getPlayCountsForRange('today', thursday)
    expect(counts.multiplayerRoomsCreated).toBe(1)
  })

  it('sums closed stored days with today, and prefers the stored day over memory', async () => {
    recordPlayCount('multiplayerRoomsCreated', thursday)
    recordPlayCount('soloClassicStarted', new Date('2026-10-07T12:00:00.000Z'))
    const yesterday = emptyPlayCounts()
    yesterday.multiplayerGamesCompleted = 3
    yesterday.soloClassicStarted = 9
    const older = emptyPlayCounts()
    older.multiplayerRoomsCreated = 4
    const beforeWeek = emptyPlayCounts()
    beforeWeek.multiplayerRoomsCreated = 100
    stored.rows = [
      { day: '2026-10-04', counts: beforeWeek },
      { day: '2026-10-06', counts: older },
      { day: '2026-10-07', counts: yesterday }
    ]

    const week = await getPlayCountsForRange('week', thursday)
    expect(week.counts.multiplayerRoomsCreated).toBe(5)
    expect(week.counts.multiplayerGamesCompleted).toBe(3)
    expect(week.counts.soloClassicStarted).toBe(9)

    const yesterdayOnly = await getPlayCountsForRange('yesterday', thursday)
    expect(yesterdayOnly.counts.soloClassicStarted).toBe(9)
    expect(yesterdayOnly.counts.multiplayerGamesCompleted).toBe(3)
  })

  it('uses memory for a closed day the database does not have yet', async () => {
    recordPlayCount('soloDailyCompleted', new Date('2026-10-07T12:00:00.000Z'))
    const { counts } = await getPlayCountsForRange('yesterday', thursday)
    expect(counts.soloDailyCompleted).toBe(1)
  })
})
