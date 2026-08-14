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
  roomCode?: string
  viewerPlayerId?: string
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

function ordinal(n: number): string {
  const rounded = Math.floor(n)
  const mod100 = rounded % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`
  switch (rounded % 10) {
    case 1:
      return `${rounded}st`
    case 2:
      return `${rounded}nd`
    case 3:
      return `${rounded}rd`
    default:
      return `${rounded}th`
  }
}

/** Place and score for the signed viewer, e.g. `2nd · 180 pts`. */
export function viewerStandingLabel(
  scoreboard: GameHistoryScoreEntry[],
  viewerPlayerId?: string
): string | null {
  if (!viewerPlayerId) return null
  const sorted = [...scoreboard].sort((a, b) => b.score - a.score)
  let rank = 0
  let lastScore: number | undefined
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i]!
    if (row.score !== lastScore) {
      rank = i + 1
      lastScore = row.score
    }
    if (row.playerId === viewerPlayerId) {
      return `${ordinal(rank)} · ${row.score} pts`
    }
  }
  return null
}
