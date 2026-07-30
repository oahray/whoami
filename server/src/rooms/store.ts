import type { Entity } from '../db/entities.js'
import { coerceAvatarId, type AvatarId } from '../game/avatars.js'
import { ROUND_START_DELAY_MS } from '../game/config.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'
/** Encoded selection: `any` or comma-separated tiers (`hard,nightmare`). */
type DifficultyMode = 'any' | Difficulty | (string & {})
type RoomStatus = 'waiting' | 'in_progress' | 'finished'
type RoundPhase = 'starting' | 'active' | 'clue_revealed' | 'ended'

export interface Player {
  id: string
  nickname: string
  avatarId: AvatarId
  isHost: boolean
  isConnected: boolean
  disconnectedAt: number | null
  guessCount: number
  lastGuessAt: number | null
  isLocked: boolean
}

export interface RoomSettings {
  roundDuration: number
  roundStartDelayMs: number
  clueRevealTime: number
  totalRounds: number
  difficultyMode: DifficultyMode
  strictMode: boolean
  transparencyMode: 'full' | 'minimal'
  maxGuessesPerRound: number
  /**
   * Dataset that the room draws entities from. `null` until the host picks one
   * (or the lobby picks the default-enabled dataset on their behalf when only
   * one is enabled). Validated again at game start.
   */
  datasetId: string | null
  /** Which entity types are drawn into the game pool. Default: characters only. */
  entityType: 'character' | 'place' | 'all'
}

export interface RoundState {
  roundNumber: number
  entity: Entity
  clues: Array<{ id: string; order: number; text: string; citations: string | null }>
  phase: RoundPhase
  /**
   * Wall-clock ms when the round was created (pre-countdown). Used by clients
   * to align the local pre-round countdown.
   */
  serverStartTime: number
  /**
   * Wall-clock ms when the round transitioned to `active` (i.e. guessing
   * opened). Used by the server for scoring, round-end scheduling, and the
   * clue reveal timer so the 3-second pre-round countdown never eats into the
   * configured `roundDuration`. `null` until `activateRound` runs.
   */
  activeStartTime: number | null
  /**
   * How many of `clues` have been revealed to clients so far. Starts at 1
   * (the first clue is revealed when ROUND_STARTED fires). Bumped by
   * `revealClue` each time a CLUE_REVEALED event is scheduled to be emitted.
   */
  revealedClueCount: number
  correctGuesses: Array<{
    playerId: string
    nickname: string
    timeElapsedMs: number
    clueIndex: number
    position: number
    pointsEarned: number
  }>
  timers: {
    clueReveal: NodeJS.Timeout | null
    roundEnd: NodeJS.Timeout | null
  }
}

export interface RoomState {
  code: string
  hostId: string
  players: Map<string, Player>
  settings: RoomSettings
  status: RoomStatus
  currentRound: RoundState | null
  roundHistory: any[]
  entityPool: Entity[]
  usedEntityIds: Set<string>
  scores: Map<string, number>
  finalScoreboard?: Array<{ playerId: string; nickname: string; score: number }>
  kickedPlayers: Map<string, number>
}

const rooms = new Map<string, RoomState>()

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  if (rooms.has(code)) {
    return generateRoomCode()
  }

  return code
}

export function createRoom(hostId: string, hostNickname: string, avatarId?: unknown): RoomState {
  const code = generateRoomCode()

  const room: RoomState = {
    code,
    hostId,
    players: new Map(),
    settings: {
      roundDuration: 30000,
      roundStartDelayMs: ROUND_START_DELAY_MS,
      clueRevealTime: 10000,
      totalRounds: 5,
      difficultyMode: 'any',
      strictMode: false,
      transparencyMode: 'full',
      maxGuessesPerRound: 10,
      datasetId: null,
      entityType: 'character'
    },
    status: 'waiting',
    currentRound: null,
    roundHistory: [],
    entityPool: [],
    usedEntityIds: new Set(),
    scores: new Map(),
    kickedPlayers: new Map()
  }

  room.players.set(hostId, {
    id: hostId,
    nickname: hostNickname,
    avatarId: coerceAvatarId(avatarId),
    isHost: true,
    isConnected: true,
    disconnectedAt: null,
    guessCount: 0,
    lastGuessAt: null,
    isLocked: false
  })

  rooms.set(code, room)
  return room
}

export function getRoom(code: string): RoomState | null {
  return rooms.get(code) || null
}

export function getRoomBySocket(socketId: string): RoomState | null {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) {
      return room
    }
  }
  return null
}

export function deleteRoom(code: string): void {
  rooms.delete(code)
}

export function getAllRooms(): Map<string, RoomState> {
  return rooms
}
