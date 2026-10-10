import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordPlayCount, resetPlayCountsForTests, listMemoryPlayCountDays } from './playCounts.js'
import { msUntilNextUtcReconcile, reconcileClosedPlayCounts } from './reconcilePlayCounts.js'

const redis = vi.hoisted(() => ({
  hashes: new Map<string, Record<string, string>>(),
  expires: [] as string[],
  failDay: '',
  failRead: '',
  scanMiss: false
}))

const upserts = vi.hoisted(() => ({
  rows: [] as Array<{
    day: string
    counts: {
      multiplayerRoomsCreated: number
      multiplayerPlayerConnections: number
      multiplayerGamesStarted: number
      soloClassicStarted: number
      soloDailyStarted: number
    }
  }>
}))

vi.mock('../redis/client.js', () => ({
  isRedisConfigured: () => true,
  getRedis: async () => ({
    scan: async (cursor: string) =>
      redis.scanMiss || cursor !== '0' ? ['0', []] : ['0', [...redis.hashes.keys()]],
    hgetall: async (key: string) => {
      if (redis.failRead && key.endsWith(redis.failRead)) throw new Error('redis read failed')
      return redis.hashes.get(key) ?? {}
    },
    hincrby: async () => 1,
    expire: async (key: string) => {
      redis.expires.push(key)
      return 1
    }
  })
}))

vi.mock('./playCountDays.js', () => ({
  upsertPlayCountDay: async (
    day: string,
    counts: {
      multiplayerRoomsCreated: number
      multiplayerPlayerConnections: number
      multiplayerGamesStarted: number
      soloClassicStarted: number
      soloDailyStarted: number
    }
  ) => {
    if (day === redis.failDay) throw new Error('database down')
    upserts.rows.push({ day, counts })
  }
}))

describe('reconcile closed play counts', () => {
  afterEach(() => {
    resetPlayCountsForTests()
    redis.hashes.clear()
    redis.expires = []
    redis.failDay = ''
    redis.failRead = ''
    redis.scanMiss = false
    upserts.rows = []
  })

  it('copies closed Redis and memory days, and leaves today open', async () => {
    redis.hashes.set('whoami:play-totals:2026-10-07', { multiplayerRoomsCreated: '4' })
    redis.hashes.set('whoami:play-totals:2026-10-08', { multiplayerRoomsCreated: '9' })
    recordPlayCount('multiplayerRoomsCreated', new Date('2026-10-06T12:00:00.000Z'))

    const saved = await reconcileClosedPlayCounts(new Date('2026-10-08T12:00:00.000Z'))

    expect(saved).toBe(2)
    expect(upserts.rows.map((row) => ({ day: row.day, rooms: row.counts.multiplayerRoomsCreated }))).toEqual([
      { day: '2026-10-06', rooms: 1 },
      { day: '2026-10-07', rooms: 4 }
    ])
    expect(redis.expires).toEqual(['whoami:play-totals:2026-10-07'])
    expect(listMemoryPlayCountDays().map((row) => row.day)).not.toContain('2026-10-06')
  })

  it('replaces a day instead of adding it when the copy runs twice', async () => {
    redis.hashes.set('whoami:play-totals:2026-10-07', { multiplayerRoomsCreated: '4' })
    const now = new Date('2026-10-08T12:00:00.000Z')
    await reconcileClosedPlayCounts(now)
    await reconcileClosedPlayCounts(now)
    expect(upserts.rows.map((row) => row.counts.multiplayerRoomsCreated)).toEqual([4, 4])
  })

  it('keeps multiplayer totals Redis missed when solo totals were stored', async () => {
    redis.hashes.set('whoami:play-totals:2026-10-07', { soloClassicStarted: '3' })
    const yesterday = new Date('2026-10-07T12:00:00.000Z')
    recordPlayCount('multiplayerRoomsCreated', yesterday)
    recordPlayCount('multiplayerGamesStarted', yesterday)

    await reconcileClosedPlayCounts(new Date('2026-10-08T12:00:00.000Z'))

    expect(upserts.rows).toEqual([
      {
        day: '2026-10-07',
        counts: expect.objectContaining({ multiplayerRoomsCreated: 1, soloClassicStarted: 3 })
      }
    ])
  })

  it('writes the Redis hash when this process only has a lower solo snapshot', async () => {
    redis.scanMiss = true
    redis.hashes.set('whoami:play-totals:2026-10-07', {
      multiplayerRoomsCreated: '1',
      multiplayerAbandonedBeforeStart: '2',
      multiplayerPlayerConnections: '6',
      soloDailyStarted: '3',
      soloDailyCompleted: '2'
    })
    const yesterday = new Date('2026-10-07T18:00:00.000Z')
    recordPlayCount('soloDailyStarted', yesterday)
    recordPlayCount('soloDailyStarted', yesterday)
    recordPlayCount('soloDailyCompleted', yesterday)

    await reconcileClosedPlayCounts(new Date('2026-10-08T12:00:00.000Z'))

    expect(upserts.rows).toEqual([
      {
        day: '2026-10-07',
        counts: expect.objectContaining({
          multiplayerRoomsCreated: 1,
          multiplayerPlayerConnections: 6,
          soloDailyStarted: 3
        })
      }
    ])
    expect(redis.expires).toEqual(['whoami:play-totals:2026-10-07'])
  })

  it('does not write this process memory when the Redis hash cannot be read', async () => {
    redis.failRead = '2026-10-07'
    recordPlayCount('soloDailyStarted', new Date('2026-10-07T18:00:00.000Z'))

    const saved = await reconcileClosedPlayCounts(new Date('2026-10-08T12:00:00.000Z'))

    expect(saved).toBe(0)
    expect(upserts.rows).toEqual([])
  })

  it('keeps the Redis key when the database write fails', async () => {
    redis.failDay = '2026-10-07'
    redis.hashes.set('whoami:play-totals:2026-10-07', { multiplayerRoomsCreated: '4' })
    const saved = await reconcileClosedPlayCounts(new Date('2026-10-08T12:00:00.000Z'))
    expect(saved).toBe(0)
    expect(redis.expires).toEqual([])
  })

  it('waits until five seconds after the next UTC midnight', () => {
    expect(msUntilNextUtcReconcile(new Date('2026-10-08T23:59:50.000Z'))).toBe(15_000)
    expect(msUntilNextUtcReconcile(new Date('2026-10-08T00:00:00.000Z'))).toBe(86_405_000)
  })
})
