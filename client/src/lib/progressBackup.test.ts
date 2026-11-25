import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyProgress, DailySummary } from './dailySolo'
import type { StoredArchiveRecord } from './deviceArchiveMerge'
import type { EntityMastery } from './soloMastery'
import type { SoloRecord } from './soloSession'
import type { TrendDay } from './soloTrends'
import {
  BackupError,
  combineSnapshots,
  createBackupFile,
  hasProgress,
  previewRestore,
  readBackupFile,
  readLocalSnapshot,
  restoredSnapshot,
  writeSnapshot,
  type ProgressSnapshot
} from './progressBackup'

let storedArchives: StoredArchiveRecord[] = []

vi.mock('./deviceArchiveIdb', () => ({
  readStoredArchives: vi.fn(async () => storedArchives),
  writeStoredArchives: vi.fn(async (rows: StoredArchiveRecord[]) => {
    storedArchives = rows
  })
}))

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + (n - 1) * 86_400_000).toISOString().slice(0, 10)

function summary(n: number, score = 500): DailySummary {
  return {
    challengeId: `${day(n)}-v1`,
    dateKey: day(n),
    completedAt: `${day(n)}T10:00:00.000Z`,
    tzOffsetMin: 60,
    scoringVersion: 1,
    score,
    cardCount: 10,
    correctCount: 8,
    solvedOnClue: [2, 3, 3],
    wrongGuesses: 1,
    timeMs: 60_000,
    fastestSolveMs: 2_000,
    byType: { character: [8, 10], place: [0, 0] }
  } as DailySummary
}

function daily(...days: number[]): DailyProgress {
  return {
    currentStreak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    results: {},
    summaries: Object.fromEntries(days.map((n) => [`${day(n)}-v1`, summary(n)]))
  }
}

function mastery(entityId: string, encounters: number): EntityMastery {
  return {
    datasetId: 'bible',
    entityId,
    entityName: entityId,
    encounters,
    correctCount: encounters,
    firstClueCorrectCount: 0,
    missCount: 0,
    lastCorrect: true,
    lastEncounteredAt: '2026-01-10T10:00:00.000Z',
    state: encounters >= 3 ? 'familiar' : 'learning'
  }
}

function record(score: number, achievedAt: string): SoloRecord {
  return {
    datasetId: 'bible',
    difficulty: [],
    entityType: 'character',
    variation: 'challenge',
    roundDurationMs: 30_000,
    clueRevealIntervalMs: 5_000,
    correctCount: 8,
    activeElapsedMs: 60_000,
    achievedAt,
    score
  } as SoloRecord
}

function trend(dateKey: string, runs: number): TrendDay {
  return {
    v: 1,
    variation: 'challenge',
    dateKey,
    runs,
    totalScore: runs * 1000,
    bestScore: 1000,
    cards: runs * 10,
    correct: runs * 8,
    solvedOnClue: [],
    wrongGuesses: 0,
    timeMs: 1000,
    fastestSolveMs: null,
    longestRun: 8,
    byType: { character: [0, 0], place: [0, 0] },
    timesOfDay: {}
  }
}

function archive(id: string, endedAt: number): StoredArchiveRecord {
  return {
    id,
    endedAt,
    signature: 'sig',
    payload: {
      v: 1,
      kid: 'v1',
      roomCode: 'ABC123',
      viewerPlayerId: 'me',
      id,
      gameNumber: 1,
      endedAt,
      totalRounds: 5,
      difficultyMode: 'any',
      roundDurationMs: 30_000,
      clueRevealTimeMs: 5_000,
      scoreboard: [{ playerId: 'me', nickname: 'Ray', avatarId: 'a1', score: 900 }]
    }
  }
}

function snapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    daily: daily(1, 2, 3),
    records: [record(4000, '2026-01-02T10:00:00.000Z')],
    mastery: { 'bible:moses': mastery('moses', 4) },
    trends: { [`challenge:${day(2)}`]: trend(day(2), 2) },
    history: [archive('g1', 1)],
    ...overrides
  }
}

async function roundTrip(input: ProgressSnapshot) {
  const { blob } = await createBackupFile(input, new Date(`${day(3)}T12:00:00.000Z`))
  return readBackupFile(blob)
}

describe('progress backup', () => {
  beforeEach(() => {
    localStorage.clear()
    storedArchives = []
  })

  it('round-trips every store through a compressed file', async () => {
    const input = snapshot()
    const { blob, fileName } = await createBackupFile(input, new Date(`${day(3)}T12:00:00.000Z`))
    expect(fileName).toBe(`whoami-progress-${day(3)}.wai`)
    const text = await blob.text()
    expect(text).not.toContain('moses')

    const contents = await readBackupFile(blob)
    expect(contents.snapshot.mastery).toEqual(input.mastery)
    expect(Object.keys(contents.snapshot.daily.summaries)).toHaveLength(3)
    expect(contents.snapshot.records).toHaveLength(1)
    expect(contents.snapshot.trends).toEqual(input.trends)
    expect(contents.snapshot.history.map((row) => row.id)).toEqual(['g1'])
  })

  it('refuses files that are not backups', async () => {
    await expect(readBackupFile(new Blob(['hello']))).rejects.toMatchObject({ code: 'not-backup' })
    await expect(readBackupFile(new Blob(['{"format":"other"}']))).rejects.toMatchObject({
      code: 'not-backup'
    })
    await expect(readBackupFile(new Blob(['']))).rejects.toBeInstanceOf(BackupError)
  })

  it('refuses a backup from a newer version', async () => {
    const { blob } = await createBackupFile(snapshot())
    const envelope = JSON.parse(await blob.text())
    envelope.version = 99
    await expect(readBackupFile(new Blob([JSON.stringify(envelope)]))).rejects.toMatchObject({
      code: 'newer-version'
    })
  })

  it('refuses an edited or damaged file', async () => {
    const { blob } = await createBackupFile(snapshot())
    const envelope = JSON.parse(await blob.text())
    const flipped = { ...envelope, data: envelope.data.slice(0, 10) + (envelope.data[10] === 'A' ? 'B' : 'A') + envelope.data.slice(11) }
    await expect(readBackupFile(new Blob([JSON.stringify(flipped)]))).rejects.toMatchObject({ code: 'damaged' })
    const redated = { ...envelope, createdAt: '2020-01-01T00:00:00.000Z' }
    await expect(readBackupFile(new Blob([JSON.stringify(redated)]))).rejects.toMatchObject({ code: 'damaged' })
  })

  it('combining a backup with the device it came from changes nothing', async () => {
    const local = snapshot()
    const { snapshot: incoming } = await roundTrip(local)
    const merged = combineSnapshots(local, incoming)
    expect(merged.mastery).toEqual(local.mastery)
    expect(merged.trends).toEqual(local.trends)
    expect(merged.records).toHaveLength(1)
    expect(merged.history).toHaveLength(1)
    expect(Object.keys(merged.daily.summaries)).toHaveLength(3)
  })

  it('combines progress from two devices', () => {
    const local = snapshot({
      daily: daily(4, 5),
      records: [record(5000, '2026-01-05T10:00:00.000Z')],
      mastery: { 'bible:moses': mastery('moses', 2), 'bible:ruth': mastery('ruth', 1) },
      trends: { [`challenge:${day(2)}`]: trend(day(2), 1) },
      history: [archive('g2', 2)]
    })
    const merged = combineSnapshots(local, snapshot())
    expect(Object.keys(merged.daily.summaries)).toHaveLength(5)
    expect(merged.daily.currentStreak).toBe(5)
    expect(merged.records.map((r) => r.score)).toEqual([5000, 4000])
    expect(merged.mastery['bible:moses'].encounters).toBe(4)
    expect(merged.mastery['bible:ruth']).toBeDefined()
    expect(merged.trends[`challenge:${day(2)}`].runs).toBe(2)
    expect(merged.history.map((row) => row.id)).toEqual(['g1', 'g2'])
  })

  it('replace takes the backup as it is', () => {
    const local = snapshot({ mastery: { 'bible:ruth': mastery('ruth', 9) } })
    const result = restoredSnapshot(local, snapshot(), 'replace')
    expect(Object.keys(result.mastery)).toEqual(['bible:moses'])
  })

  it('previews the streak after restoring, including a stale backup', async () => {
    const contents = await roundTrip(snapshot())
    const fresh = restoredSnapshot(snapshot({ daily: daily(), records: [], mastery: {}, trends: {}, history: [] }), contents.snapshot, 'combine')
    expect(previewRestore(contents, fresh, day(4))).toMatchObject({
      streakInBackup: 3,
      streakAfter: 3,
      lastDailyInBackup: day(3),
      dailyDays: 3
    })
    // Three days later with nothing played since: the rest day can't cover two misses.
    expect(previewRestore(contents, fresh, day(6)).streakAfter).toBe(0)
  })

  it('writes every store and reads it back', async () => {
    const input = snapshot()
    await writeSnapshot(input)
    const local = await readLocalSnapshot()
    expect(local.mastery).toEqual(input.mastery)
    expect(local.trends).toEqual(input.trends)
    expect(local.records).toHaveLength(1)
    expect(Object.keys(local.daily.summaries)).toHaveLength(3)
    expect(local.history.map((row) => row.id)).toEqual(['g1'])
    expect(hasProgress(local)).toBe(true)
  })

  it('puts the old values back when a write fails', async () => {
    localStorage.setItem('whoami-solo-records', '[]')
    const original = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'whoami-solo-trends-v1') throw new Error('QuotaExceededError')
      return original.call(this, key, value)
    })
    await expect(writeSnapshot(snapshot())).rejects.toThrow()
    spy.mockRestore()
    expect(localStorage.getItem('whoami-solo-records')).toBe('[]')
    expect(localStorage.getItem('whoami-solo-daily-progress')).toBeNull()
  })

  it('knows an empty device has no progress', async () => {
    expect(hasProgress(await readLocalSnapshot())).toBe(false)
  })
})
