import { DEVICE_ARCHIVE_MAX } from './multiplayerDefaults'
import type { SignedHistoryArchive } from './historyArchivePayload'

export type StoredArchiveRecord = SignedHistoryArchive & {
  id: string
  endedAt: number
}

export function mergeDeviceArchives(
  existing: StoredArchiveRecord[],
  incoming: SignedHistoryArchive
): StoredArchiveRecord[] {
  const record: StoredArchiveRecord = {
    id: incoming.payload.id,
    endedAt: incoming.payload.endedAt,
    payload: incoming.payload,
    signature: incoming.signature
  }
  const byId = new Map(existing.map((row) => [row.id, row]))
  byId.set(record.id, record)
  return [...byId.values()]
    .sort((a, b) => a.endedAt - b.endedAt)
    .slice(-DEVICE_ARCHIVE_MAX)
}
