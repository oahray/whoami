import {
  coerceDailyProgress,
  combineDailyProgress,
  computeDailyStreaks,
  dailyDateKey,
  DAILY_PROGRESS_KEY,
  loadDailyProgress,
  settleDailyProgress,
  storeDailyProgress,
  type DailyProgress
} from './dailySolo'
import { mergeDeviceArchives, type StoredArchiveRecord } from './deviceArchiveMerge'
import { readStoredArchives, writeStoredArchives } from './deviceArchiveIdb'
import { isSignedHistoryArchive } from './historyArchivePayload'
import { DEVICE_ARCHIVE_MAX } from './multiplayerDefaults'
import { base64ToBytes, bytesToBase64, canCompress, gunzip, gzip, sha256Hex } from './progressBackupEncoding'
import {
  coerceMasteryEntities,
  combineMasteryEntities,
  loadMasteryEntities,
  MASTERY_KEY,
  storeMasteryEntities,
  type EntityMastery
} from './soloMastery'
import {
  coerceSoloRecords,
  combineSoloRecords,
  listAllSoloRecords,
  RECORDS_KEY,
  storeSoloRecords,
  type SoloRecord
} from './soloSession'
import {
  coerceTrendDays,
  combineTrendDays,
  loadTrendStoreDays,
  storeTrendDays,
  TRENDS_KEY,
  type TrendDay
} from './soloTrends'

export const BACKUP_FORMAT = 'whoami-progress'
export const BACKUP_VERSION = 1
export const LAST_BACKUP_KEY = 'whoami_last_backup_at'

export type ProgressSnapshot = {
  daily: DailyProgress
  records: SoloRecord[]
  mastery: Record<string, EntityMastery>
  trends: Record<string, TrendDay>
  history: StoredArchiveRecord[]
}

type BackupEnvelope = {
  format: typeof BACKUP_FORMAT
  version: number
  createdAt: string
  compression: 'gzip' | 'none'
  checksum: string
  data: string
}

export type BackupErrorCode = 'not-backup' | 'newer-version' | 'damaged'

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(code)
  }
}

export type RestoreMode = 'combine' | 'replace'

export type BackupContents = {
  snapshot: ProgressSnapshot
  createdAt: string
}

export type ProgressTotals = {
  dailyDays: number
  cardsMet: number
  runs: number
  games: number
}

export type RestorePreview = ProgressTotals & {
  createdAt: string
  /** Streak the backup had on the day it was made. */
  streakInBackup: number
  /** Streak the player will have today after restoring. */
  streakAfter: number
  lastDailyInBackup: string | null
}

// The header is part of the checksum, so a file can't be passed off as another version or date.
function checksumFor(envelope: Omit<BackupEnvelope, 'checksum'>): Promise<string> {
  return sha256Hex(
    [envelope.format, envelope.version, envelope.createdAt, envelope.compression, envelope.data].join('|')
  )
}

function coerceHistory(raw: unknown): StoredArchiveRecord[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isSignedHistoryArchive)
    .map((archive) => ({
      id: archive.payload.id,
      endedAt: archive.payload.endedAt,
      payload: archive.payload,
      signature: archive.signature
    }))
    .sort((a, b) => a.endedAt - b.endedAt)
    .slice(-DEVICE_ARCHIVE_MAX)
}

export async function readLocalSnapshot(): Promise<ProgressSnapshot> {
  return {
    daily: loadDailyProgress(),
    records: listAllSoloRecords(),
    mastery: loadMasteryEntities(),
    trends: loadTrendStoreDays(),
    history: await readStoredArchives()
  }
}

export function snapshotTotals(snapshot: ProgressSnapshot): ProgressTotals {
  return {
    dailyDays: Object.keys(snapshot.daily.summaries).length,
    cardsMet: Object.keys(snapshot.mastery).length,
    runs: Object.values(snapshot.trends).reduce((sum, day) => sum + day.runs, 0),
    games: snapshot.history.length
  }
}

export function hasProgress(snapshot: ProgressSnapshot): boolean {
  const totals = snapshotTotals(snapshot)
  return (
    totals.dailyDays + totals.cardsMet + totals.runs + totals.games > 0 ||
    snapshot.records.length > 0
  )
}

export async function createBackupFile(
  snapshot: ProgressSnapshot,
  now = new Date()
): Promise<{ blob: Blob; fileName: string }> {
  const compression = canCompress() ? 'gzip' : 'none'
  const createdAt = now.toISOString()
  const head = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, compression } as const
  const json = new TextEncoder().encode(JSON.stringify(snapshot))
  const body = { ...head, data: bytesToBase64(compression === 'gzip' ? await gzip(json) : json) }
  const envelope: BackupEnvelope = { ...body, checksum: await checksumFor(body) }
  return {
    blob: new Blob([JSON.stringify(envelope)], { type: 'application/octet-stream' }),
    fileName: `whoami-progress-${dailyDateKey(now)}.wai`
  }
}

export async function readBackupFile(file: Blob): Promise<BackupContents> {
  let envelope: BackupEnvelope
  try {
    envelope = JSON.parse(await file.text()) as BackupEnvelope
  } catch {
    throw new BackupError('not-backup')
  }
  if (!envelope || envelope.format !== BACKUP_FORMAT) throw new BackupError('not-backup')
  if (typeof envelope.version !== 'number' || envelope.version > BACKUP_VERSION) {
    throw new BackupError('newer-version')
  }

  let raw: Record<string, unknown>
  try {
    const { checksum, ...body } = envelope
    if (typeof body.data !== 'string' || checksum !== (await checksumFor(body))) {
      throw new BackupError('damaged')
    }
    const bytes = base64ToBytes(body.data)
    const json = body.compression === 'gzip' ? await gunzip(bytes) : bytes
    raw = JSON.parse(new TextDecoder().decode(json)) as Record<string, unknown>
  } catch {
    throw new BackupError('damaged')
  }

  try {
    return {
      createdAt: envelope.createdAt,
      snapshot: {
        daily: coerceDailyProgress(raw.daily),
        records: coerceSoloRecords(raw.records),
        mastery: coerceMasteryEntities(raw.mastery),
        trends: coerceTrendDays(raw.trends),
        history: coerceHistory(raw.history)
      }
    }
  } catch {
    throw new BackupError('damaged')
  }
}

export function combineSnapshots(local: ProgressSnapshot, incoming: ProgressSnapshot): ProgressSnapshot {
  return {
    daily: combineDailyProgress(local.daily, incoming.daily),
    records: combineSoloRecords(local.records, incoming.records),
    mastery: combineMasteryEntities(local.mastery, incoming.mastery),
    trends: combineTrendDays(local.trends, incoming.trends),
    history: incoming.history.reduce(mergeDeviceArchives, local.history)
  }
}

export function restoredSnapshot(
  local: ProgressSnapshot,
  incoming: ProgressSnapshot,
  mode: RestoreMode
): ProgressSnapshot {
  if (mode === 'combine') return combineSnapshots(local, incoming)
  return { ...incoming, daily: settleDailyProgress(incoming.daily) }
}

function dailyKeys(snapshot: ProgressSnapshot): string[] {
  return Object.values(snapshot.daily.summaries).map((summary) => summary.dateKey)
}

export function previewRestore(
  contents: BackupContents,
  result: ProgressSnapshot,
  todayKey = dailyDateKey()
): RestorePreview {
  const keys = dailyKeys(contents.snapshot)
  const backupDay = dailyDateKey(new Date(contents.createdAt))
  return {
    ...snapshotTotals(result),
    createdAt: contents.createdAt,
    streakInBackup: computeDailyStreaks(keys, backupDay).current,
    streakAfter: computeDailyStreaks(dailyKeys(result), todayKey).current,
    lastDailyInBackup: keys.length > 0 ? keys.reduce((a, b) => (a > b ? a : b)) : null
  }
}

const STORAGE_KEYS = [DAILY_PROGRESS_KEY, RECORDS_KEY, MASTERY_KEY, TRENDS_KEY]

/** Writes everything or nothing: a failed write puts the previous values back. */
export async function writeSnapshot(snapshot: ProgressSnapshot): Promise<void> {
  const previous = STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)] as const)
  try {
    storeDailyProgress(snapshot.daily)
    storeSoloRecords(snapshot.records)
    storeMasteryEntities(snapshot.mastery)
    storeTrendDays(snapshot.trends)
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value == null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch {
        /* nothing more to do */
      }
    }
    throw error
  }
  // History lives in IndexedDB and is the least important part, so a failure there
  // doesn't undo the rest.
  try {
    await writeStoredArchives(snapshot.history)
  } catch {
    /* private mode or no IndexedDB */
  }
}

export function markBackedUp(now = new Date()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, now.toISOString())
  } catch {
    /* ignore */
  }
}

export function lastBackedUpAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}
