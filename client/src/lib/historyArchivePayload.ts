export const HISTORY_ARCHIVE_VERSION = 1
export const HISTORY_ARCHIVE_KID = 'v1'
export const HISTORY_ARCHIVE_ALG = 'Ed25519'

export type HistoryArchiveScoreRow = {
  playerId: string
  nickname: string
  avatarId: string
  score: number
}

export type HistoryArchiveEfficiency = {
  roundsPlayed: number
  roundsSolved: number
  firstClueSolves: number
  avgCluesWhenSolved: number | null
}

export type HistoryArchivePayload = {
  v: number
  kid: string
  roomCode: string
  viewerPlayerId: string
  id: string
  gameNumber: number
  endedAt: number
  totalRounds: number
  difficultyMode: string
  roundDurationMs: number
  clueRevealTimeMs: number
  scoreboard: HistoryArchiveScoreRow[]
  /** Optional; omitted on legacy archives so their signatures stay valid. */
  efficiency?: HistoryArchiveEfficiency
}

export type SignedHistoryArchive = {
  payload: HistoryArchivePayload
  signature: string
}

export function serializeHistoryArchivePayload(payload: HistoryArchivePayload): string {
  return JSON.stringify({
    v: payload.v,
    kid: payload.kid,
    roomCode: payload.roomCode,
    viewerPlayerId: payload.viewerPlayerId,
    id: payload.id,
    gameNumber: payload.gameNumber,
    endedAt: payload.endedAt,
    totalRounds: payload.totalRounds,
    difficultyMode: payload.difficultyMode,
    roundDurationMs: payload.roundDurationMs,
    clueRevealTimeMs: payload.clueRevealTimeMs,
    scoreboard: payload.scoreboard.map((row) => ({
      playerId: row.playerId,
      nickname: row.nickname,
      avatarId: row.avatarId,
      score: row.score
    })),
    ...(payload.efficiency
      ? {
          efficiency: {
            roundsPlayed: payload.efficiency.roundsPlayed,
            roundsSolved: payload.efficiency.roundsSolved,
            firstClueSolves: payload.efficiency.firstClueSolves,
            avgCluesWhenSolved: payload.efficiency.avgCluesWhenSolved
          }
        }
      : {})
  })
}

export function isSignedHistoryArchive(value: unknown): value is SignedHistoryArchive {
  if (!value || typeof value !== 'object') return false
  const record = value as SignedHistoryArchive
  return Boolean(record.payload && typeof record.signature === 'string' && record.payload.id)
}
