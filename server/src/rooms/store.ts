import type { Entity } from '../db/entities.js'
import { ROUND_START_DELAY_MS } from '../game/config.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'
type DifficultyMode = Difficulty | 'any'
type RoomStatus = 'waiting' | 'in_progress' | 'finished'
type RoundPhase = 'starting' | 'active' | 'clue_revealed' | 'ended'

export interface Player {
  id: string
  nickname: string
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
}

export interface RoundState {
  roundNumber: number
  entity: Entity
  clues: Array<{ id: string; order: number; text: string; citations: string | null }>
  phase: RoundPhase
  serverStartTime: number
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

export function createRoom(hostId: string, hostNickname: string): RoomState {
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
      maxGuessesPerRound: 10
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
