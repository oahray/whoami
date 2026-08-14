import { describe, expect, it } from 'vitest'
import { DEVICE_ARCHIVE_MAX } from './multiplayerDefaults'
import { mergeDeviceArchives } from './deviceArchiveMerge'
import type { SignedHistoryArchive } from './historyArchivePayload'

function archive(id: string, endedAt: number): SignedHistoryArchive {
  return {
    signature: 'sig',
    payload: {
      v: 1,
      kid: 'v1',
      roomCode: 'ABC123',
      viewerPlayerId: 'p1',
      id,
      gameNumber: 1,
      endedAt,
      totalRounds: 5,
      difficultyMode: 'any',
      roundDurationMs: 30_000,
      clueRevealTimeMs: 5_000,
      scoreboard: []
    }
  }
}

describe('mergeDeviceArchives', () => {
  it('dedupes by id and keeps the incoming snapshot', () => {
    const first = archive('game-1', 10)
    const updated = archive('game-1', 10)
    updated.signature = 'new-sig'
    const merged = mergeDeviceArchives(
      [{ id: 'game-1', endedAt: 10, payload: first.payload, signature: first.signature }],
      updated
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.signature).toBe('new-sig')
  })

  it('drops the oldest entries when over the cap', () => {
    const existing = Array.from({ length: DEVICE_ARCHIVE_MAX }, (_, i) => {
      const row = archive(`game-${i}`, i)
      return { id: row.payload.id, endedAt: i, payload: row.payload, signature: row.signature }
    })
    const incoming = archive('game-new', DEVICE_ARCHIVE_MAX + 5)
    const merged = mergeDeviceArchives(existing, incoming)
    expect(merged).toHaveLength(DEVICE_ARCHIVE_MAX)
    expect(merged[0]?.id).toBe('game-1')
    expect(merged[merged.length - 1]?.id).toBe('game-new')
  })
})
