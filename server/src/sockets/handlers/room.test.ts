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
      newHost: 'Paul'
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
      newHost: 'Paul'
    })
  })

  it('creates a room and emits ROOM_JOINED for the host', () => {
    const room = actualStore.createRoom('host-1', 'Host')
    const socket = {
      id: 'host-1',
      join: vi.fn(),
      emit: vi.fn()
    } as any

    vi.mocked(createRoomInStore).mockReturnValue(room)

    handleCreateRoom({} as any, socket, { nickname: 'Host' })

    expect(socket.join).toHaveBeenCalledWith(room.code)
    expect(socket.emit).toHaveBeenCalledWith('ROOM_JOINED', expect.objectContaining({
      playerId: 'host-1',
      isHost: true,
      roomCode: room.code
    }))
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
