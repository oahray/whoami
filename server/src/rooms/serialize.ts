import type { Entity } from '../db/entities.js'
import { coerceAvatarId } from '../game/avatars.js'
import type {
  GameHistoryEntry,
  Player,
  RoomSettings,
  RoomState,
  RoundState
} from './store.js'

/** Redis key for a room snapshot. */
export function roomRedisKey(code: string): string {
  return `whoami:room:${code}`
}

export const ROOM_REDIS_KEY_PATTERN = 'whoami:room:*'

/** Refresh TTL on every write so active lobbies do not expire mid-session. */
export const ROOM_REDIS_TTL_SECONDS = 24 * 60 * 60

type SerializedPlayer = Player

type SerializedRound = Omit<RoundState, 'timers'> & {
  timers?: undefined
}

export type SerializedRoom = {
  code: string
  hostId: string
  players: SerializedPlayer[]
  settings: RoomSettings
  status: RoomState['status']
  currentRound: SerializedRound | null
  roundHistory: unknown[]
  entityPool: Entity[]
  usedEntityIds: string[]
  scores: Array<[string, number]>
  finalScoreboard?: RoomState['finalScoreboard']
  gameHistory: GameHistoryEntry[]
  kickedPlayers: Array<[string, number]>
}

export function serializeRoom(room: RoomState): SerializedRoom {
  const currentRound = room.currentRound
    ? {
        roundNumber: room.currentRound.roundNumber,
        entity: room.currentRound.entity,
        clues: room.currentRound.clues,
        phase: room.currentRound.phase,
        serverStartTime: room.currentRound.serverStartTime,
        activeStartTime: room.currentRound.activeStartTime,
        revealedClueCount: room.currentRound.revealedClueCount,
        correctGuesses: room.currentRound.correctGuesses
      }
    : null

  return {
    code: room.code,
    hostId: room.hostId,
    players: Array.from(room.players.values()).map((player) => ({
      ...player,
      avatarId: coerceAvatarId(player.avatarId)
    })),
    settings: { ...room.settings },
    status: room.status,
    currentRound,
    roundHistory: room.roundHistory,
    entityPool: room.entityPool,
    usedEntityIds: Array.from(room.usedEntityIds),
    scores: Array.from(room.scores.entries()),
    finalScoreboard: room.finalScoreboard,
    gameHistory: room.gameHistory,
    kickedPlayers: Array.from(room.kickedPlayers.entries())
  }
}

export function deserializeRoom(raw: SerializedRoom): RoomState {
  const players = new Map<string, Player>()
  for (const player of raw.players ?? []) {
    players.set(player.id, {
      ...player,
      avatarId: coerceAvatarId(player.avatarId),
      disconnectedAt: player.disconnectedAt ?? null,
      lastGuessAt: player.lastGuessAt ?? null
    })
  }

  const currentRound: RoundState | null = raw.currentRound
    ? {
        ...raw.currentRound,
        timers: {
          clueReveal: null,
          roundEnd: null
        }
      }
    : null

  return {
    code: raw.code,
    hostId: raw.hostId,
    players,
    settings: raw.settings,
    status: raw.status,
    currentRound,
    roundHistory: Array.isArray(raw.roundHistory) ? raw.roundHistory : [],
    entityPool: Array.isArray(raw.entityPool) ? raw.entityPool : [],
    usedEntityIds: new Set(raw.usedEntityIds ?? []),
    scores: new Map(raw.scores ?? []),
    finalScoreboard: raw.finalScoreboard,
    gameHistory: Array.isArray(raw.gameHistory) ? raw.gameHistory : [],
    kickedPlayers: new Map(raw.kickedPlayers ?? [])
  }
}

/**
 * Phase 1 hydrate: waiting/finished rooms restore as-is (players marked
 * disconnected by the caller). In-progress rooms cannot re-arm timers yet,
 * so demote to a joinable lobby and clear the live round.
 */
export function prepareRoomForHydrate(room: RoomState, now = Date.now()): RoomState {
  for (const player of room.players.values()) {
    player.isConnected = false
    if (player.disconnectedAt == null) {
      player.disconnectedAt = now
    }
  }

  if (room.status === 'in_progress') {
    room.status = 'waiting'
    room.currentRound = null
    room.roundHistory = []
    room.entityPool = []
    room.usedEntityIds = new Set()
    room.scores = new Map()
    room.finalScoreboard = undefined
    for (const player of room.players.values()) {
      player.guessCount = 0
      player.lastGuessAt = null
      player.isLocked = false
    }
  }

  return room
}
