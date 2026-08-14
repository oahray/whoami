import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject
} from 'node:crypto'
import { logger } from '../utils/logger.js'
import type { GameHistoryEntry } from '../rooms/store.js'
import {
  HISTORY_ARCHIVE_ALG,
  HISTORY_ARCHIVE_KID,
  HISTORY_ARCHIVE_VERSION,
  serializeHistoryArchivePayload,
  type HistoryArchivePayload
} from './historyArchivePayload.js'

export type SignedHistoryArchive = {
  payload: HistoryArchivePayload
  signature: string
}

let privateKey: KeyObject | null = null
let publicKey: KeyObject | null = null
let usedEphemeralKey = false

function decodeDerKey(value: string): Buffer {
  const trimmed = value.trim()
  if (trimmed.includes('BEGIN')) {
    return Buffer.from(trimmed)
  }
  return Buffer.from(trimmed, 'base64')
}

function loadConfiguredKeys(): { privateKey: KeyObject; publicKey: KeyObject } | null {
  const rawPrivate = process.env.HISTORY_SIGNING_PRIVATE_KEY
  if (!rawPrivate?.trim()) return null
  try {
    const keyBuf = decodeDerKey(rawPrivate)
    const priv = trimmedLooksPem(rawPrivate)
      ? createPrivateKey(rawPrivate)
      : createPrivateKey({ key: keyBuf, format: 'der', type: 'pkcs8' })
    const rawPublic = process.env.HISTORY_SIGNING_PUBLIC_KEY
    const pub = rawPublic?.trim()
      ? trimmedLooksPem(rawPublic)
        ? createPublicKey(rawPublic)
        : createPublicKey({ key: decodeDerKey(rawPublic), format: 'der', type: 'spki' })
      : createPublicKey(priv)
    return { privateKey: priv, publicKey: pub }
  } catch (error) {
    logger.error('Invalid HISTORY_SIGNING_PRIVATE_KEY; refusing to sign archives', error)
    return null
  }
}

function trimmedLooksPem(value: string): boolean {
  return value.trim().includes('BEGIN')
}

function ensureKeys(): { privateKey: KeyObject; publicKey: KeyObject } | null {
  if (privateKey && publicKey) {
    return { privateKey, publicKey }
  }
  const configured = loadConfiguredKeys()
  if (configured) {
    privateKey = configured.privateKey
    publicKey = configured.publicKey
    usedEphemeralKey = false
    return configured
  }
  const generated = generateKeyPairSync('ed25519')
  privateKey = generated.privateKey
  publicKey = generated.publicKey
  usedEphemeralKey = true
  logger.warn(
    'HISTORY_SIGNING_PRIVATE_KEY is unset; using an ephemeral Ed25519 key. Device archives will not verify after a server restart.'
  )
  return { privateKey, publicKey }
}

/** Test helper: inject or clear signing keys. */
export function resetHistorySigningKeysForTests(
  keys?: { privateKey: KeyObject; publicKey: KeyObject } | 'generate'
): void {
  if (!keys) {
    privateKey = null
    publicKey = null
    usedEphemeralKey = false
    return
  }
  if (keys === 'generate') {
    const generated = generateKeyPairSync('ed25519')
    privateKey = generated.privateKey
    publicKey = generated.publicKey
    usedEphemeralKey = true
    return
  }
  privateKey = keys.privateKey
  publicKey = keys.publicKey
  usedEphemeralKey = false
}

export function getHistoryPublicKeyResponse(): {
  alg: string
  kid: string
  publicKey: string
  ephemeral: boolean
} | null {
  const keys = ensureKeys()
  if (!keys) return null
  return {
    alg: HISTORY_ARCHIVE_ALG,
    kid: HISTORY_ARCHIVE_KID,
    publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    ephemeral: usedEphemeralKey
  }
}

export function buildHistoryArchivePayload(
  entry: GameHistoryEntry,
  roomCode: string,
  viewerPlayerId: string
): HistoryArchivePayload {
  return {
    v: HISTORY_ARCHIVE_VERSION,
    kid: HISTORY_ARCHIVE_KID,
    roomCode,
    viewerPlayerId,
    id: entry.id,
    gameNumber: entry.gameNumber,
    endedAt: entry.endedAt,
    totalRounds: entry.totalRounds,
    difficultyMode: entry.difficultyMode,
    roundDurationMs: entry.roundDurationMs,
    clueRevealTimeMs: entry.clueRevealTimeMs,
    scoreboard: entry.scoreboard.map((row) => ({
      playerId: row.playerId,
      nickname: row.nickname,
      avatarId: row.avatarId,
      score: row.score
    }))
  }
}

export function signHistoryArchive(
  entry: GameHistoryEntry,
  roomCode: string,
  viewerPlayerId: string
): SignedHistoryArchive | null {
  const keys = ensureKeys()
  if (!keys) return null
  const payload = buildHistoryArchivePayload(entry, roomCode, viewerPlayerId)
  const bytes = Buffer.from(serializeHistoryArchivePayload(payload), 'utf8')
  const signature = sign(null, bytes, keys.privateKey).toString('base64')
  return { payload, signature }
}

export function verifyHistoryArchiveSignature(
  archive: SignedHistoryArchive,
  key?: KeyObject
): boolean {
  const publicKeyToUse = key ?? ensureKeys()?.publicKey
  if (!publicKeyToUse) return false
  const bytes = Buffer.from(serializeHistoryArchivePayload(archive.payload), 'utf8')
  const sig = Buffer.from(archive.signature, 'base64')
  return verify(null, bytes, publicKeyToUse, sig)
}
