import { supabase } from '../db/supabase.js'
import { PLAY_COUNT_METRICS, emptyPlayCounts, type PlayCountMetric, type PlayCounts } from './playCounts.js'

const COLUMNS: Record<PlayCountMetric, string> = {
  multiplayerRoomsCreated: 'multiplayer_rooms_created',
  multiplayerGamesStarted: 'multiplayer_games_started',
  multiplayerGamesCompleted: 'multiplayer_games_completed',
  multiplayerAbandonedBeforeStart: 'multiplayer_abandoned_before_start',
  multiplayerPlayerConnections: 'multiplayer_player_connections',
  soloClassicStarted: 'solo_classic_started',
  soloClassicCompleted: 'solo_classic_completed',
  soloDailyStarted: 'solo_daily_started',
  soloDailyCompleted: 'solo_daily_completed',
  soloEnduranceStarted: 'solo_endurance_started',
  soloEnduranceCompleted: 'solo_endurance_completed',
  soloReviewStarted: 'solo_review_started',
  soloReviewCompleted: 'solo_review_completed'
}

export interface StoredPlayCountDay {
  day: string
  counts: PlayCounts
}

function rowFromCounts(day: string, counts: PlayCounts): Record<string, string | number> {
  const row: Record<string, string | number> = { day }
  for (const metric of PLAY_COUNT_METRICS) row[COLUMNS[metric]] = counts[metric]
  return row
}

function countsFromRow(row: Record<string, unknown>): StoredPlayCountDay {
  const counts = emptyPlayCounts()
  for (const metric of PLAY_COUNT_METRICS) {
    const value = Number(row[COLUMNS[metric]] ?? 0)
    counts[metric] = Number.isFinite(value) ? value : 0
  }
  return { day: String(row.day).slice(0, 10), counts }
}

/** Replace that day's row. A repeated copy does not add the totals again. */
export async function upsertPlayCountDay(day: string, counts: PlayCounts): Promise<void> {
  const { error } = await supabase.from('play_count_days').upsert(rowFromCounts(day, counts), { onConflict: 'day' })
  if (error) throw new Error(error.message)
}

/** Closed days in the span. `from` null means every stored day through `to`. */
export async function listPlayCountDays(from: string | null, to: string): Promise<StoredPlayCountDay[]> {
  let query = supabase.from('play_count_days').select('*').lte('day', to)
  if (from) query = query.gte('day', from)
  const { data, error } = await query.order('day', { ascending: true }).limit(20000)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => countsFromRow(row as Record<string, unknown>))
}
