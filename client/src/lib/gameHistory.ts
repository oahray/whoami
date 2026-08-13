import { coerceDifficultySelection, formatDifficultySelection } from './difficultySelection'

export type GameHistoryScoreEntry = {
  playerId: string
  nickname: string
  avatarId?: string
  score: number
}

export type GameHistoryEntry = {
  id: string
  gameNumber: number
  endedAt: number
  totalRounds: number
  difficultyMode?: string
  roundDurationMs?: number
  clueRevealTimeMs?: number
  scoreboard: GameHistoryScoreEntry[]
}

export function formatGameEndedAtFull(endedAt: number): string {
  return new Date(endedAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatRoundDurationMs(ms: number | undefined): string {
  if (!ms || ms <= 0) return '—'
  const sec = ms / 1000
  return Number.isInteger(sec) ? `${sec}s` : `${sec.toFixed(1)}s`
}

export function formatGameHistorySettings(entry: GameHistoryEntry): {
  difficulty: string
  roundTime: string
  clueInterval: string
} {
  const difficulty = formatDifficultySelection(
    coerceDifficultySelection(entry.difficultyMode ?? 'any')
  )
  const roundTime = formatRoundDurationMs(entry.roundDurationMs)
  const clueInterval = formatRoundDurationMs(entry.clueRevealTimeMs)
  return { difficulty, roundTime, clueInterval }
}

export function formatGameEndedAt(endedAt: number, now = Date.now()): string {
  const deltaSec = Math.max(0, Math.floor((now - endedAt) / 1000))
  if (deltaSec < 60) return 'Just now'
  const mins = Math.floor(deltaSec / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(endedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function winnerLabel(scoreboard: GameHistoryScoreEntry[]): string {
  if (scoreboard.length === 0) return 'No scores'
  const top = scoreboard[0]!
  if (top.score <= 0) return 'No points scored'
  const tied = scoreboard.filter((row) => row.score === top.score)
  if (tied.length > 1) return `Tied: ${tied.map((row) => row.nickname).join(', ')}`
  return top.nickname
}
