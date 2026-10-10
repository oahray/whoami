import { logger } from '../utils/logger.js'
import { upsertPlayCountDay } from './playCountDays.js'
import {
  PLAY_COUNT_METRICS,
  expireRedisPlayCountDay,
  forgetMemoryPlayCountDay,
  hasPlayCounts,
  higherPlayCounts,
  listMemoryPlayCountDays,
  listRedisPlayCountDays,
  readRedisPlayCountDay,
  utcPlayCountDate,
  type PlayCounts
} from './playCounts.js'

function metricsAheadOfRedis(redisCounts: PlayCounts, merged: PlayCounts): string[] {
  return PLAY_COUNT_METRICS.filter((metric) => merged[metric] > redisCounts[metric])
}

/** Keep the Redis key briefly after a successful copy so a missed read can retry. */
const RETAIN_REDIS_SECONDS = 48 * 60 * 60

/** Five seconds after UTC midnight, so the open day has already rolled. */
const RECONCILE_AFTER_MIDNIGHT_MS = 5_000

let scheduleActive = false
let timer: ReturnType<typeof setTimeout> | null = null

export function msUntilNextUtcReconcile(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    RECONCILE_AFTER_MIDNIGHT_MS / 1000
  )
  return Math.max(1000, next - now.getTime())
}

function previousUtcDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Copy every closed UTC day into the database. Today is left open.
 * Each day is read by its exact Redis key, then merged with this process.
 * Writing the same day again replaces the row.
 */
export async function reconcileClosedPlayCounts(now = new Date()): Promise<number> {
  const today = utcPlayCountDate(now)
  const saved = new Set<string>()
  const memoryByDay = new Map(listMemoryPlayCountDays().map((row) => [row.day, row.counts]))
  const days = new Set<string>(memoryByDay.keys())
  for (const row of await listRedisPlayCountDays()) days.add(row.day)
  days.add(previousUtcDay(today))

  for (const day of [...days].sort()) {
    if (day >= today || saved.has(day)) continue
    const fromRedis = await readRedisPlayCountDay(day)
    const inMemory = memoryByDay.get(day)
    if (!fromRedis) {
      if (inMemory && hasPlayCounts(inMemory)) {
        logger.warn('Skipped closed play totals because Redis could not be read', { day })
      }
      continue
    }
    const counts = inMemory ? higherPlayCounts(fromRedis, inMemory) : fromRedis
    if (!hasPlayCounts(counts)) continue
    const missedByRedis = metricsAheadOfRedis(fromRedis, counts)
    if (missedByRedis.length > 0) {
      logger.warn('Redis play totals were behind this process', { day, metrics: missedByRedis })
    }
    try {
      await upsertPlayCountDay(day, counts)
      if (hasPlayCounts(fromRedis)) {
        try {
          await expireRedisPlayCountDay(day, RETAIN_REDIS_SECONDS)
        } catch (error) {
          logger.error('Failed to expire copied play totals', error, { day })
        }
      }
      forgetMemoryPlayCountDay(day)
      saved.add(day)
    } catch (error) {
      logger.error('Failed to store closed play totals', error, { day })
    }
  }

  return saved.size
}

async function runAndSchedule(): Promise<void> {
  try {
    const days = await reconcileClosedPlayCounts()
    if (days > 0) logger.info('Stored closed play totals', { days })
  } catch (error) {
    logger.error('Failed to store closed play totals', error)
  }
  if (!scheduleActive) return
  timer = setTimeout(() => {
    void runAndSchedule()
  }, msUntilNextUtcReconcile())
  timer.unref()
}

/** Catch up now, then once just after each UTC midnight. One timer, not a poll. */
export function startPlayCountReconcileSchedule(): void {
  if (scheduleActive) return
  scheduleActive = true
  void runAndSchedule()
}

export function stopPlayCountReconcileSchedule(): void {
  scheduleActive = false
  if (timer) clearTimeout(timer)
  timer = null
}
