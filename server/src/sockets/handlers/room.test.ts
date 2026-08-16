import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../rooms/store.js', async () => {
  const actual = await vi.importActual<typeof import('../../rooms/store.js')>('../../rooms/store.js')
  return {
    ...actual,
    getRoom: vi.fn(),
    getRoomBySocket: vi.fn(),
    createRoom: vi.fn(),
    deleteRoom: vi.fn()
  }
})

vi.mock('./utils.js', async () => {
  const actual = await vi.importActual<typeof import('./utils.js')>('./utils.js')
  return {
    ...actual,
    findReturningPlayer: vi.fn(),
    transferHost: vi.fn(),
    buildReconnectPayload: vi.fn()
  }
})

vi.mock('../../game/nicknameFilter.js', () => ({
  nicknameIsBlocked: vi.fn((nickname: string) => nickname === '__blocked__')
}))

const actualStore = await vi.importActual<typeof import('../../rooms/store.js')>('../../rooms/store.js')

import { createRoom as createRoomInStore, deleteRoom, getRoom, getRoomBySocket } from '../../rooms/store.js'
import { buildReconnectPayload, findReturningPlayer, transferHost, GRACE_PERIOD_MS } from './utils.js'
import {
  handleCreateRoom,
  handleDisconnect,
  handleJoinRoom,
  handleLeaveRoom
} from './room.js'

describe('room socket handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconnects a returning player in an active game with RECONNECT_SUCCESS', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const oldPlayer = {
      id: 'old-socket',
      nickname: 'Paul',
      avatarId: 'avatar-01',
      isHost: false,
      isConnected: false,
      disconnectedAt: Date.now() - 1000,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    }
    const socket = {
      id: 'new-socket',
      emit: vi.fn(),
      join: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() }))
    } as any

    room.status = 'in_progress'
    room.players.set('old-socket', oldPlayer)
    room.scores.set('old-socket', 320)
    room.currentRound = {
      roundNumber: 1,
      phase: 'active',
      serverStartTime: Date.now(),
      activeStartTime: Date.now(),
      clues: [],
      revealedClueCount: 1,
      correctGuesses: [
        {
          playerId: 'old-socket',
          nickname: 'Paul',
          timeElapsedMs: 1200,
          clueIndex: 0,
          position: 1,
          pointsEarned: 320
        }
      ],
      timers: {
        clueReveal: null,
        roundEnd: null
      }
    } as any
    room.roundHistory = [
      {
        scoreboard: [
          {
            playerId: 'old-socket',
            nickname: 'Paul',
            totalScore: 320
          }
        ],
        correctGuesses: [
          {
            playerId: 'old-socket',
            nickname: 'Paul',
            pointsEarned: 320
          }
        ]
      }
    ]
    room.finalScoreboard = [
      {
        playerId: 'old-socket',
        nickname: 'Paul',
        score: 320
      }
    ]
    vi.mocked(getRoom).mockReturnValue(room)
    vi.mocked(findReturningPlayer).mockReturnValue(oldPlayer as any)
    vi.mocked(buildReconnectPayload).mockReturnValue({ ok: true } as any)

    handleJoinRoom({} as any, socket, {
      roomCode: room.code,
      nickname: 'Paul'
    })

    expect(room.players.has('old-socket')).toBe(false)
    expect(room.players.get('new-socket')?.isConnected).toBe(true)
    expect(room.players.get('new-socket')?.disconnectedAt).toBeNull()
    expect(room.scores.has('old-socket')).toBe(false)
    expect(room.scores.get('new-socket')).toBe(320)
    expect(room.currentRound?.correctGuesses[0]?.playerId).toBe('new-socket')
    expect(room.roundHistory[0].scoreboard[0].playerId).toBe('new-socket')
    expect(room.roundHistory[0].correctGuesses[0].playerId).toBe('new-socket')
    expect(room.finalScoreboard?.[0].playerId).toBe('new-socket')
    expect(socket.join).toHaveBeenCalledWith(room.code)
    expect(socket.emit).toHaveBeenCalledWith('RECONNECT_SUCCESS', { ok: true })
  })

  it('rejects a banned player from rejoining', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const socket = {
      id: 'socket-2',
      emit: vi.fn()
    } as any

    room.kickedPlayers.set('paul', 2)
    vi.mocked(getRoom).mockReturnValue(room)

    handleJoinRoom({} as any, socket, {
      roomCode: room.code,
      nickname: 'Paul'
    })

    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'PLAYER_BANNED',
      message: 'You have been removed from this room and cannot rejoin'
    })
  })

  it('rejects joining with a nickname already used by a connected player', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const socket = {
      id: 'socket-2',
      emit: vi.fn()
    } as any

    room.players.set('player-1', {
      id: 'player-1',
      nickname: 'Paul',
      avatarId: 'avatar-01',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })
    vi.mocked(getRoom).mockReturnValue(room)
    vi.mocked(findReturningPlayer).mockReturnValue(null)

    handleJoinRoom({} as any, socket, {
      roomCode: room.code,
      nickname: 'Paul'
    })

    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'NICKNAME_TAKEN',
      message: 'Nickname already taken'
    })
  })

  it('transfers host when the current host leaves', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const roomEmit = vi.fn()
    const socket = {
      id: 'host-1',
      leave: vi.fn()
    } as any
    const io = {
      to: vi.fn(() => ({ emit: roomEmit }))
    } as any

    room.players.set('p2', {
      id: 'p2',
      nickname: 'Paul',
      avatarId: 'avatar-01',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })
    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(transferHost).mockReturnValue('p2')
    room.players.get('p2')!.isHost = true

    handleLeaveRoom(io, socket)

    expect(socket.leave).toHaveBeenCalledWith(room.code)
    expect(roomEmit).toHaveBeenCalledWith('PLAYER_LEFT', {
      id: 'host-1',
      nickname: 'Host',
      newHost: 'Paul',
      reason: 'left'
    })
  })

  it('removes a disconnected player after the grace period and emits PLAYER_LEFT', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const roomEmit = vi.fn()
    const socket = {
      id: 'host-1',
      to: vi.fn(() => ({ emit: vi.fn() }))
    } as any
    const io = {
      to: vi.fn(() => ({ emit: roomEmit }))
    } as any

    room.players.set('p2', {
      id: 'p2',
      nickname: 'Paul',
      avatarId: 'avatar-01',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })
    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(transferHost).mockReturnValue('p2')
    room.players.get('p2')!.isHost = true

    handleDisconnect(io, socket)

    expect(room.players.get('host-1')?.isConnected).toBe(false)
    expect(room.players.get('host-1')?.disconnectedAt).not.toBeNull()

    vi.advanceTimersByTime(GRACE_PERIOD_MS + 1)

    expect(room.players.has('host-1')).toBe(false)
    expect(roomEmit).toHaveBeenCalledWith('PLAYER_LEFT', {
      id: 'host-1',
      nickname: 'Host',
      newHost: 'Paul',
      reason: 'left'
    })
  })

  it('creates a room and emits ROOM_JOINED for the host', () => {
    const room = actualStore.createRoom('host-1', 'Host', 'avatar-03')
    const socket = {
      id: 'host-1',
      join: vi.fn(),
      emit: vi.fn()
    } as any

    vi.mocked(createRoomInStore).mockReturnValue(room)

    handleCreateRoom({} as any, socket, { nickname: 'Host', avatarId: 'avatar-03' })

    expect(createRoomInStore).toHaveBeenCalledWith('host-1', 'Host', 'avatar-03')
    expect(socket.join).toHaveBeenCalledWith(room.code)
    expect(socket.emit).toHaveBeenCalledWith('ROOM_JOINED', expect.objectContaining({
      playerId: 'host-1',
      isHost: true,
      roomCode: room.code,
      players: expect.arrayContaining([
        expect.objectContaining({ id: 'host-1', nickname: 'Host', avatarId: 'avatar-03' })
      ])
    }))
  })

  it('rejects create and join when the nickname is blocked', () => {
    const createSocket = { id: 'host-1', join: vi.fn(), emit: vi.fn() } as any
    handleCreateRoom({} as any, createSocket, { nickname: '__blocked__', avatarId: 'avatar-01' })
    expect(createRoomInStore).not.toHaveBeenCalled()
    expect(createSocket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'INVALID_NICKNAME',
      message: 'Choose a different nickname'
    })

    const room = actualStore.createRoom('host-1', 'Host')
    vi.mocked(getRoom).mockReturnValue(room)
    vi.mocked(findReturningPlayer).mockReturnValue(null)
    const joinSocket = {
      id: 'player-2',
      emit: vi.fn(),
      join: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() }))
    } as any
    handleJoinRoom({} as any, joinSocket, {
      roomCode: room.code,
      nickname: '__blocked__',
      avatarId: 'avatar-02'
    })
    expect(joinSocket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'INVALID_NICKNAME',
      message: 'Choose a different nickname'
    })
    expect(room.players.has('player-2')).toBe(false)
  })

  it('assigns a join avatar and broadcasts PLAYER_JOINED with avatarId', () => {
    const room = actualStore.createRoom('host-1', 'Host', 'avatar-01')
    const roomEmit = vi.fn()
    const socket = {
      id: 'player-2',
      emit: vi.fn(),
      join: vi.fn(),
      to: vi.fn(() => ({ emit: roomEmit }))
    } as any

    vi.mocked(getRoom).mockReturnValue(room)
    vi.mocked(findReturningPlayer).mockReturnValue(null)

    handleJoinRoom({} as any, socket, {
      roomCode: room.code,
      nickname: 'Paul',
      avatarId: 'avatar-07'
    })

    expect(room.players.get('player-2')?.avatarId).toBe('avatar-07')
    expect(socket.emit).toHaveBeenCalledWith('ROOM_JOINED', expect.objectContaining({
      players: expect.arrayContaining([
        expect.objectContaining({ id: 'player-2', nickname: 'Paul', avatarId: 'avatar-07' })
      ])
    }))
    expect(socket.to).toHaveBeenCalledWith(room.code)
    expect(roomEmit).toHaveBeenCalledWith('PLAYER_JOINED', {
      id: 'player-2',
      nickname: 'Paul',
      avatarId: 'avatar-07'
    })
  })

  it('deletes the room when the last player disconnects past grace period', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const socket = {
      id: 'host-1',
      to: vi.fn(() => ({ emit: vi.fn() }))
    } as any
    const io = {
      to: vi.fn(() => ({ emit: vi.fn() }))
    } as any

    vi.mocked(getRoomBySocket).mockReturnValue(room)

    handleDisconnect(io, socket)
    vi.advanceTimersByTime(GRACE_PERIOD_MS + 1)

    expect(deleteRoom).toHaveBeenCalledWith(room.code)
  })
})
