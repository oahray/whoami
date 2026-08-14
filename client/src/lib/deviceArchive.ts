import { appendStoredArchive, readStoredArchives } from './deviceArchiveIdb'
import { isSignedHistoryArchive, type SignedHistoryArchive } from './historyArchivePayload'
import { verifySignedHistoryArchive } from './deviceArchiveVerify'
import type { GameHistoryEntry } from './gameHistory'

export async function saveSignedArchiveIfPresent(value: unknown): Promise<void> {
  if (!isSignedHistoryArchive(value)) return
  const ok = await verifySignedHistoryArchive(value)
  if (!ok) return
  try {
    await appendStoredArchive(value)
  } catch {
    // Storage full or private mode — ignore; completeness is not guaranteed.
  }
}

export async function listVerifiedDeviceArchives(): Promise<GameHistoryEntry[]> {
  const rows = await readStoredArchives()
  const verified: GameHistoryEntry[] = []
  for (const row of rows) {
    const archive: SignedHistoryArchive = { payload: row.payload, signature: row.signature }
    if (!(await verifySignedHistoryArchive(archive))) continue
    const payload = row.payload
    verified.push({
      id: payload.id,
      gameNumber: payload.gameNumber,
      endedAt: payload.endedAt,
      totalRounds: payload.totalRounds,
      difficultyMode: payload.difficultyMode,
      roundDurationMs: payload.roundDurationMs,
      clueRevealTimeMs: payload.clueRevealTimeMs,
      roomCode: payload.roomCode,
      viewerPlayerId: payload.viewerPlayerId,
      scoreboard: payload.scoreboard
    })
  }
  return verified.sort((a, b) => a.endedAt - b.endedAt)
}
