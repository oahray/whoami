import { logger } from '../utils/logger.js'
import { listPlayCountDays } from './playCountDays.js'
import {
  PLAY_COUNT_METRICS,
  emptyPlayCounts,
  getPlayCountsForDay,
  higherPlayCounts,
  listMemoryPlayCountDays,
  listRedisPlayCountDays,
  utcPlayCountDate,
  type PlayCounts
} from './playCounts.js'

export const PLAY_COUNT_RANGES = ['today', 'yesterday', 'week', 'month', 'all'] as const

export type PlayCountRangeName = (typeof PLAY_COUNT_RANGES)[number]

export interface PlayCountSpan {
  from: string | null
  to: string
  includesToday: boolean
}

export function parsePlayCountRange(raw: string): PlayCountRangeName | null {
  return PLAY_COUNT_RANGES.includes(raw as PlayCountRangeName) ? (raw as PlayCountRangeName) : null
}

function shiftUtcDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/** Monday of the UTC week that contains `day`. */
export function utcWeekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  const delta = weekday === 0 ? 6 : weekday - 1
  return shiftUtcDay(day, -delta)
}

export function playCountSpan(range: PlayCountRangeName, now = new Date()): PlayCountSpan {
  const today = utcPlayCountDate(now)
  if (range === 'today') return { from: today, to: today, includesToday: true }
  if (range === 'yesterday') {
    const yesterday = shiftUtcDay(today, -1)
    return { from: yesterday, to: yesterday, includesToday: false }
  }
  if (range === 'week') return { from: utcWeekStart(today), to: today, includesToday: true }
  if (range === 'month') return { from: `${today.slice(0, 8)}01`, to: today, includesToday: true }
  return { from: null, to: today, includesToday: true }
}

function addCounts(into: PlayCounts, extra: PlayCounts): void {
  for (const metric of PLAY_COUNT_METRICS) into[metric] += extra[metric]
}

function inClosedSpan(day: string, span: PlayCountSpan, today: string): boolean {
  if (day >= today || day > span.to) return false
  if (span.from && day < span.from) return false
  return true
}

/**
 * Closed days come from the database. A closed day still only in Redis or
 * memory is included until the copy succeeds. Today is always the live total.
 */
export async function getPlayCountsForRange(
  range: PlayCountRangeName,
  now = new Date()
): Promise<{ span: PlayCountSpan; counts: PlayCounts }> {
  const span = playCountSpan(range, now)
  const today = utcPlayCountDate(now)
  const counts = emptyPlayCounts()

  if (!(span.from === today && span.includesToday)) {
    const seen = new Set<string>()
    try {
      const stored = await listPlayCountDays(span.from, span.to)
      for (const row of stored) {
        if (!inClosedSpan(row.day, span, today) || seen.has(row.day)) continue
        seen.add(row.day)
        addCounts(counts, row.counts)
      }
    } catch (error) {
      logger.error('Failed to read stored play totals', error)
    }

    const memoryByDay = new Map(listMemoryPlayCountDays().map((row) => [row.day, row.counts]))
    for (const row of await listRedisPlayCountDays()) {
      if (!inClosedSpan(row.day, span, today) || seen.has(row.day)) continue
      seen.add(row.day)
      const inMemory = memoryByDay.get(row.day)
      addCounts(counts, inMemory ? higherPlayCounts(row.counts, inMemory) : row.counts)
    }
    for (const [day, dayCounts] of memoryByDay) {
      if (!inClosedSpan(day, span, today) || seen.has(day)) continue
      seen.add(day)
      addCounts(counts, dayCounts)
    }
  }

  if (span.includesToday) addCounts(counts, await getPlayCountsForDay(today))
  return { span, counts }
}
