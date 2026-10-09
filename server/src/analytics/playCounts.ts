import { getRedis, isRedisConfigured } from '../redis/client.js'
import { logger } from '../utils/logger.js'

/** Daily play totals. One field is one column on that UTC day's row. */
export const PLAY_COUNT_METRICS = [
  'multiplayerRoomsCreated',
  'multiplayerGamesStarted',
  'multiplayerGamesCompleted',
  'multiplayerAbandonedBeforeStart',
  'multiplayerPlayerConnections',
  'soloClassicStarted',
  'soloClassicCompleted',
  'soloDailyStarted',
  'soloDailyCompleted',
  'soloEnduranceStarted',
  'soloEnduranceCompleted',
  'soloReviewStarted',
  'soloReviewCompleted'
] as const

export type PlayCountMetric = (typeof PLAY_COUNT_METRICS)[number]

export type PlayCounts = Record<PlayCountMetric, number>

const memory = new Map<string, PlayCounts>()

export function utcPlayCountDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function redisKey(day: string): string {
  return `whoami:play-totals:${day}`
}

export function emptyPlayCounts(): PlayCounts {
  return {
    multiplayerRoomsCreated: 0,
    multiplayerGamesStarted: 0,
    multiplayerGamesCompleted: 0,
    multiplayerAbandonedBeforeStart: 0,
    multiplayerPlayerConnections: 0,
    soloClassicStarted: 0,
    soloClassicCompleted: 0,
    soloDailyStarted: 0,
    soloDailyCompleted: 0,
    soloEnduranceStarted: 0,
    soloEnduranceCompleted: 0,
    soloReviewStarted: 0,
    soloReviewCompleted: 0
  }
}

function countsFor(raw: Record<string, string | number | undefined>): PlayCounts {
  const counts = emptyPlayCounts()
  for (const metric of PLAY_COUNT_METRICS) {
    const value = Number(raw[metric] ?? 0)
    counts[metric] = Number.isFinite(value) ? value : 0
  }
  return counts
}

/** Keep the larger total when Redis and this process both have a copy. */
export function higherPlayCounts(left: PlayCounts, right: PlayCounts): PlayCounts {
  const merged = emptyPlayCounts()
  for (const metric of PLAY_COUNT_METRICS) {
    merged[metric] = Math.max(left[metric] || 0, right[metric] || 0)
  }
  return merged
}

/** Increment today's total. Gameplay must continue if Redis is down. */
export function recordPlayCount(metric: PlayCountMetric, now = new Date()): void {
  const day = utcPlayCountDate(now)
  const current = memory.get(day) ?? emptyPlayCounts()
  current[metric] += 1
  memory.set(day, current)
  void incrementRedis(day, metric)
}

async function incrementRedis(day: string, metric: PlayCountMetric): Promise<void> {
  if (!isRedisConfigured()) return
  try {
    const redis = await getRedis()
    if (!redis) return
    await redis.hincrby(redisKey(day), metric, 1)
  } catch (error) {
    logger.error('Failed to increment play total', error, { day, metric })
  }
}

/**
 * Today's totals. Redis and this process both count the same events.
 * A partial Redis hash must not hide a total that only this process has.
 */
export async function getPlayCountsForDay(day = utcPlayCountDate()): Promise<PlayCounts> {
  const fromMemory = { ...(memory.get(day) ?? emptyPlayCounts()) }
  if (!isRedisConfigured()) return fromMemory
  try {
    const redis = await getRedis()
    if (!redis) return fromMemory
    const raw = await redis.hgetall(redisKey(day))
    if (!raw || Object.keys(raw).length === 0) return fromMemory
    return higherPlayCounts(fromMemory, countsFor(raw))
  } catch (error) {
    logger.error('Failed to read play totals', error, { day })
    return fromMemory
  }
}

export function listMemoryPlayCountDays(): Array<{ day: string; counts: PlayCounts }> {
  return [...memory.entries()].map(([day, counts]) => ({ day, counts: { ...counts } }))
}

export function forgetMemoryPlayCountDay(day: string): void {
  memory.delete(day)
}

/** Closed and open days currently held in Redis. Empty when Redis is off. */
export async function listRedisPlayCountDays(): Promise<Array<{ day: string; counts: PlayCounts }>> {
  if (!isRedisConfigured()) return []
  try {
    const redis = await getRedis()
    if (!redis) return []
    const keys = await scanPlayCountKeys(redis)
    const days: Array<{ day: string; counts: PlayCounts }> = []
    for (const key of keys) {
      const day = key.slice(redisKey('').length)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      const raw = await redis.hgetall(key)
      days.push({ day, counts: countsFor(raw) })
    }
    return days
  } catch (error) {
    logger.error('Failed to list play totals', error)
    return []
  }
}

export async function expireRedisPlayCountDay(day: string, seconds: number): Promise<void> {
  if (!isRedisConfigured()) return
  const redis = await getRedis()
  if (!redis) return
  await redis.expire(redisKey(day), seconds)
}

async function scanPlayCountKeys(
  redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>
): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'
  const scan = redis.scan as unknown as (
    cursor: string,
    ...args: Array<string | number>
  ) => Promise<[string, string[]]>
  do {
    const [next, batch] = await scan(cursor, 'MATCH', `${redisKey('')}*`, 'COUNT', 100)
    cursor = String(next)
    keys.push(...batch)
  } while (cursor !== '0')
  return keys
}

export function resetPlayCountsForTests(): void {
  memory.clear()
}
