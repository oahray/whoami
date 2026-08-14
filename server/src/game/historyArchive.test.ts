import { generateKeyPairSync } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildHistoryArchivePayload,
  resetHistorySigningKeysForTests,
  signHistoryArchive,
  verifyHistoryArchiveSignature
} from './historyArchive.js'
import { serializeHistoryArchivePayload } from './historyArchivePayload.js'
import type { GameHistoryEntry } from '../rooms/store.js'

const sampleEntry: GameHistoryEntry = {
  id: 'ABC123-1-1',
  gameNumber: 1,
  endedAt: 1_700_000_000_000,
  totalRounds: 5,
  difficultyMode: 'any',
  roundDurationMs: 30_000,
  clueRevealTimeMs: 5_000,
  scoreboard: [
    { playerId: 'p1', nickname: 'Paul', avatarId: 'avatar-01', score: 200 },
    { playerId: 'p2', nickname: 'Host', avatarId: 'avatar-02', score: 100 }
  ]
}

describe('historyArchive', () => {
  afterEach(() => {
    resetHistorySigningKeysForTests()
    delete process.env.HISTORY_SIGNING_PRIVATE_KEY
    delete process.env.HISTORY_SIGNING_PUBLIC_KEY
  })

  it('serializes payloads in a stable field order', () => {
    const payload = buildHistoryArchivePayload(sampleEntry, 'ABC123', 'p1')
    const first = serializeHistoryArchivePayload(payload)
    const second = serializeHistoryArchivePayload({ ...payload, scoreboard: [...payload.scoreboard] })
    expect(first).toBe(second)
    expect(first).toContain('"roomCode":"ABC123"')
    expect(first).toContain('"viewerPlayerId":"p1"')
  })

  it('signs and verifies a snapshot', () => {
    resetHistorySigningKeysForTests('generate')
    const signed = signHistoryArchive(sampleEntry, 'ABC123', 'p1')
    expect(signed).not.toBeNull()
    expect(verifyHistoryArchiveSignature(signed!)).toBe(true)
  })

  it('fails verification when a score is tampered', () => {
    resetHistorySigningKeysForTests('generate')
    const signed = signHistoryArchive(sampleEntry, 'ABC123', 'p1')
    expect(signed).not.toBeNull()
    const tampered = {
      ...signed!,
      payload: {
        ...signed!.payload,
        scoreboard: signed!.payload.scoreboard.map((row, index) =>
          index === 0 ? { ...row, score: 9999 } : row
        )
      }
    }
    expect(verifyHistoryArchiveSignature(tampered)).toBe(false)
  })

  it('fails verification with a different key', () => {
    resetHistorySigningKeysForTests('generate')
    const signed = signHistoryArchive(sampleEntry, 'ABC123', 'p1')
    const other = generateKeyPairSync('ed25519')
    expect(verifyHistoryArchiveSignature(signed!, other.publicKey)).toBe(false)
  })
})
