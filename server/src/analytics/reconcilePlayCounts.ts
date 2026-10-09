import { logger } from '../utils/logger.js'
import { upsertPlayCountDay } from './playCountDays.js'
import {
  expireRedisPlayCountDay,
  forgetMemoryPlayCountDay,
  listMemoryPlayCountDays,
  listRedisPlayCountDays,
  utcPlayCountDate
} from './playCounts.js'

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

/**
 * Copy every closed UTC day into the database. Today is left open.
 * Writing the same day again replaces the row.
 */
export async function reconcileClosedPlayCounts(now = new Date()): Promise<number> {
  const today = utcPlayCountDate(now)
  const saved = new Set<string>()

  for (const row of await listRedisPlayCountDays()) {
    if (row.day >= today || saved.has(row.day)) continue
    try {
      await upsertPlayCountDay(row.day, row.counts)
      try {
        await expireRedisPlayCountDay(row.day, RETAIN_REDIS_SECONDS)
      } catch (error) {
        logger.error('Failed to expire copied play totals', error, { day: row.day })
      }
      forgetMemoryPlayCountDay(row.day)
      saved.add(row.day)
    } catch (error) {
      logger.error('Failed to store closed play totals', error, { day: row.day })
    }
  }

  for (const row of listMemoryPlayCountDays()) {
    if (row.day >= today || saved.has(row.day)) continue
    try {
      await upsertPlayCountDay(row.day, row.counts)
      forgetMemoryPlayCountDay(row.day)
      saved.add(row.day)
    } catch (error) {
      logger.error('Failed to store closed play totals', error, { day: row.day })
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
