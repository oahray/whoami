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

import { getPlayCountsForDay } from '../../analytics/playCounts.js'
import { createRoom as createRoomInStore, deleteRoom, getRoom, getRoomBySocket } from '../../rooms/store.js'
import { buildReconnectPayload, findReturningPlayer, transferHost, GRACE_PERIOD_MS } from './utils.js'
import {
  handleCreateRoom,
  handleDisconnect,
  handleJoinRoom,
  handleKickPlayer,
  handleLeaveRoom,
  handleLobbyReaction
} from './room.js'
import {
  LOBBY_REACTION_COOLDOWN_MS,
  resetLobbyReactionRateLimitsForTests
} from '../../game/lobbyReactions.js'
import { ROOM_LIMITS, resetRoomGuardsForTests } from '../../rooms/roomGuards.js'

describe('room socket handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    resetLobbyReactionRateLimitsForTests()
    resetRoomGuardsForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reconnects a returning player in an active game with RECONNECT_SUCCESS', async () => {
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
      roundEndedAt: null,
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
    const before = await getPlayCountsForDay()

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
    expect((await getPlayCountsForDay()).multiplayerPlayerConnections).toBe(before.multiplayerPlayerConnections)
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

    expect(createRoomInStore).toHaveBeenCalledWith('host-1', 'Host', 'avatar-03', null)
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

  describe('LOBBY_REACTION', () => {
    function setupWaitingRoom() {
      const room = actualStore.createRoom('host-1', 'Host')
      room.players.set('player-2', {
        id: 'player-2',
        nickname: 'Paul',
        avatarId: 'avatar-02',
        isHost: false,
        isConnected: true,
        disconnectedAt: null,
        guessCount: 0,
        lastGuessAt: null,
        isLocked: false
      })
      vi.mocked(getRoomBySocket).mockReturnValue(room)
      const roomEmit = vi.fn()
      const io = {
        to: vi.fn(() => ({ emit: roomEmit }))
      } as any
      const socket = { id: 'player-2' } as any
      return { room, io, socket, roomEmit }
    }

    it('broadcasts a known reaction to the room', () => {
      const { room, io, socket, roomEmit } = setupWaitingRoom()

      handleLobbyReaction(io, socket, { reactionId: 'ready' })

      expect(io.to).toHaveBeenCalledWith(room.code)
      expect(roomEmit).toHaveBeenCalledWith('LOBBY_REACTION', {
        playerId: 'player-2',
        reactionId: 'ready'
      })
    })

    it('ignores unknown reaction ids', () => {
      const { io, socket, roomEmit } = setupWaitingRoom()

      handleLobbyReaction(io, socket, { reactionId: 'custom' })

      expect(roomEmit).not.toHaveBeenCalled()
    })

    it('ignores reactions while the game is in progress', () => {
      const { room, io, socket, roomEmit } = setupWaitingRoom()
      room.status = 'in_progress'

      handleLobbyReaction(io, socket, { reactionId: 'go' })

      expect(roomEmit).not.toHaveBeenCalled()
    })

    it('rate-limits reactions within the cooldown window', () => {
      const { io, socket, roomEmit } = setupWaitingRoom()

      handleLobbyReaction(io, socket, { reactionId: 'ready' })
      handleLobbyReaction(io, socket, { reactionId: 'wait' })

      expect(roomEmit).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(LOBBY_REACTION_COOLDOWN_MS)
      handleLobbyReaction(io, socket, { reactionId: 'wait' })

      expect(roomEmit).toHaveBeenCalledTimes(2)
      expect(roomEmit).toHaveBeenLastCalledWith('LOBBY_REACTION', {
        playerId: 'player-2',
        reactionId: 'wait'
      })
    })
  })

  describe('KICK_PLAYER', () => {
    function setupLobbyWithGuest() {
      const room = actualStore.createRoom('host-1', 'Host')
      room.players.set('player-2', {
        id: 'player-2',
        nickname: 'Judas',
        avatarId: 'avatar-02',
        isHost: false,
        isConnected: true,
        disconnectedAt: null,
        guessCount: 0,
        lastGuessAt: null,
        isLocked: false
      })
      vi.mocked(getRoomBySocket).mockReturnValue(room)
      const emits: Array<{ to: string; event: string; payload: unknown }> = []
      const io = {
        to: vi.fn((to: string) => ({
          emit: (event: string, payload: unknown) => emits.push({ to, event, payload })
        }))
      } as any
      const hostSocket = { id: 'host-1', emit: vi.fn() } as any
      return { room, io, hostSocket, emits }
    }

    it('tells the room the player was kicked, not banned, on a first kick', () => {
      const { room, io, hostSocket, emits } = setupLobbyWithGuest()

      handleKickPlayer(io, hostSocket, { playerId: 'player-2' })

      expect(room.players.has('player-2')).toBe(false)
      expect(emits).toContainEqual({
        to: room.code,
        event: 'PLAYER_LEFT',
        payload: { id: 'player-2', nickname: 'Judas', newHost: null, reason: 'kicked', banned: false }
      })
      expect(emits).toContainEqual({
        to: 'player-2',
        event: 'KICKED',
        payload: { nickname: 'Judas', banned: false }
      })
    })

    it('marks the second kick of the same nickname as banned for the room', () => {
      const { room, io, hostSocket, emits } = setupLobbyWithGuest()
      room.kickedPlayers.set('judas', 1)

      handleKickPlayer(io, hostSocket, { playerId: 'player-2' })

      expect(emits).toContainEqual({
        to: room.code,
        event: 'PLAYER_LEFT',
        payload: { id: 'player-2', nickname: 'Judas', newHost: null, reason: 'kicked', banned: true }
      })
    })

    it('bans by device on the second kick even after a nickname change', () => {
      const { room, io, hostSocket, emits } = setupLobbyWithGuest()
      room.players.get('player-2')!.deviceId = 'device-judas-0001'

      handleKickPlayer(io, hostSocket, { playerId: 'player-2' })
      expect(room.kickedDevices.get('device-judas-0001')).toBe(1)

      // Sneaks back in under a new nickname from the same browser
      room.players.set('player-3', {
        id: 'player-3',
        nickname: 'Thaddaeus',
        avatarId: 'avatar-03',
        isHost: false,
        isConnected: true,
        disconnectedAt: null,
        guessCount: 0,
        lastGuessAt: null,
        isLocked: false,
        deviceId: 'device-judas-0001'
      })
      emits.length = 0
      handleKickPlayer(io, hostSocket, { playerId: 'player-3' })

      expect(emits).toContainEqual({
        to: room.code,
        event: 'PLAYER_LEFT',
        payload: { id: 'player-3', nickname: 'Thaddaeus', newHost: null, reason: 'kicked', banned: true }
      })
    })

    it('rejects kicks while a game is in progress', () => {
      const { room, io, hostSocket, emits } = setupLobbyWithGuest()
      room.status = 'in_progress'

      handleKickPlayer(io, hostSocket, { playerId: 'player-2' })

      expect(hostSocket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
        code: 'GAME_IN_PROGRESS',
        message: 'Players can only be kicked from the lobby'
      })
      expect(room.players.has('player-2')).toBe(true)
      expect(emits).toHaveLength(0)
    })
  })

  describe('device bans on join', () => {
    function joinAs(room: ReturnType<typeof actualStore.createRoom>, nickname: string, deviceId?: unknown) {
      const socket = { id: `socket-${nickname}`, emit: vi.fn(), join: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) } as any
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(findReturningPlayer).mockReturnValue(null as any)
      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname, deviceId })
      return socket
    }

    it('rejects a banned device even under a new nickname', () => {
      const room = actualStore.createRoom('host-dev-1', 'Peter')
      room.kickedDevices.set('device-judas-0001', 2)

      const socket = joinAs(room, 'Thaddaeus', 'device-judas-0001')

      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
        code: 'PLAYER_BANNED',
        message: 'You have been removed from this room and cannot rejoin'
      })
    })

    it('ignores a malformed device id instead of trusting it', () => {
      const room = actualStore.createRoom('host-dev-2', 'Peter')

      joinAs(room, 'Andrew', 'not a device id!')

      const andrew = room.players.get('socket-Andrew')
      expect(andrew).toBeDefined()
      expect(andrew?.deviceId).toBeUndefined()
    })

    it('stores the device id but never sends it to players', () => {
      const room = actualStore.createRoom('host-dev-3', 'Peter')

      const socket = joinAs(room, 'Andrew', 'device-andrew-0001')

      expect(room.players.get('socket-Andrew')?.deviceId).toBe('device-andrew-0001')
      const joined = socket.emit.mock.calls.find(([event]: [string]) => event === 'ROOM_JOINED')
      expect(joined).toBeDefined()
      expect(JSON.stringify(joined[1])).not.toContain('device-andrew-0001')
    })
  })

  describe('seat reclaim', () => {
    function seat(overrides: Record<string, unknown> = {}) {
      return {
        id: 'old-socket',
        nickname: 'Paul',
        avatarId: 'avatar-01',
        isHost: true,
        isConnected: false,
        disconnectedAt: Date.now() - 1000,
        guessCount: 0,
        lastGuessAt: null,
        isLocked: false,
        deviceId: 'device-paul-0001',
        ...overrides
      }
    }
    function fakeSocket(id: string) {
      return { id, emit: vi.fn(), join: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) } as any
    }

    it('refuses a returning seat to a different browser', () => {
      const room = actualStore.createRoom('host-seat-1', 'Peter')
      const held = seat()
      room.players.set('old-socket', held as any)
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(findReturningPlayer).mockReturnValue(held as any)

      const socket = fakeSocket('intruder')
      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Paul', deviceId: 'device-other-0001' })

      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'SEAT_IN_USE' }))
      expect(room.players.has('old-socket')).toBe(true)
      expect(room.players.has('intruder')).toBe(false)
    })

    it('refuses a returning seat when no device id is sent', () => {
      const room = actualStore.createRoom('host-seat-2', 'Peter')
      const held = seat()
      room.players.set('old-socket', held as any)
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(findReturningPlayer).mockReturnValue(held as any)

      const socket = fakeSocket('intruder')
      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Paul' })

      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'SEAT_IN_USE' }))
    })

    it('gives the returning seat back to the same browser', () => {
      const room = actualStore.createRoom('host-seat-3', 'Peter')
      const held = seat()
      room.players.set('old-socket', held as any)
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(findReturningPlayer).mockReturnValue(held as any)

      const socket = fakeSocket('paul-again')
      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Paul', deviceId: 'device-paul-0001' })

      expect(room.players.get('paul-again')).toBe(held)
      expect(room.players.has('old-socket')).toBe(false)
      expect(socket.emit).toHaveBeenCalledWith('ROOM_JOINED', expect.objectContaining({ playerId: 'paul-again' }))
    })

    it('refuses a disconnected lobby seat to a different browser', () => {
      const room = actualStore.createRoom('host-seat-4', 'Peter')
      room.players.set('old-socket', seat({ disconnectedAt: null }) as any)
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(findReturningPlayer).mockReturnValue(null)

      const socket = fakeSocket('intruder')
      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'paul', deviceId: 'device-other-0001' })

      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'SEAT_IN_USE' }))
      expect(room.players.get('old-socket')?.isHost).toBe(true)
    })

    it('still lets a seat stored without a device id be reclaimed by nickname', () => {
      const room = actualStore.createRoom('host-seat-5', 'Peter')
      const held = seat({ deviceId: undefined })
      room.players.set('old-socket', held as any)
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(findReturningPlayer).mockReturnValue(held as any)

      const socket = fakeSocket('paul-again')
      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Paul', deviceId: 'device-paul-0001' })

      expect(room.players.get('paul-again')).toBe(held)
    })

    it('stores the host device id when a room is created', () => {
      const room = actualStore.createRoom('host-seat-6', 'Peter')
      vi.mocked(createRoomInStore).mockReturnValue(room)
      const socket = { id: 'host-seat-6', join: vi.fn(), emit: vi.fn() } as any

      handleCreateRoom({} as any, socket, { nickname: 'Peter', avatarId: 'avatar-01', deviceId: 'device-peter-0001' })

      expect(createRoomInStore).toHaveBeenCalledWith('host-seat-6', 'Peter', 'avatar-01', 'device-peter-0001')
    })
  })

  describe('room flooding', () => {
    function hostSocket(id: string, address = '203.0.113.7') {
      return {
        id,
        join: vi.fn(),
        leave: vi.fn(),
        emit: vi.fn(),
        handshake: { address, headers: {} }
      } as any
    }

    it('limits room creation per address', () => {
      vi.mocked(createRoomInStore).mockImplementation((id: string, name: string) => actualStore.createRoom(id, name))

      for (let i = 0; i < ROOM_LIMITS.create.max; i++) {
        const socket = hostSocket(`flood-${i}`)
        handleCreateRoom({} as any, socket, { nickname: 'Flood' })
        expect(socket.emit).toHaveBeenCalledWith('ROOM_JOINED', expect.anything())
      }

      const blocked = hostSocket('flood-blocked')
      handleCreateRoom({} as any, blocked, { nickname: 'Flood' })
      expect(blocked.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'ROOM_RATE_LIMITED' }))

      const elsewhere = hostSocket('other-home', '198.51.100.9')
      handleCreateRoom({} as any, elsewhere, { nickname: 'Neighbour' })
      expect(elsewhere.emit).toHaveBeenCalledWith('ROOM_JOINED', expect.anything())
    })

    it('refuses new rooms while the heap is nearly full', () => {
      const memory = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        ...process.memoryUsage(),
        heapUsed: Number.MAX_SAFE_INTEGER
      })
      try {
        const socket = hostSocket('busy-host')
        handleCreateRoom({} as any, socket, { nickname: 'Peter' })
        expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'SERVER_BUSY' }))
        expect(createRoomInStore).not.toHaveBeenCalled()
      } finally {
        memory.mockRestore()
      }
    })

    it('leaves the old room before creating another from the same socket', () => {
      const oldRoom = actualStore.createRoom('repeat-host', 'Peter')
      const io = { to: vi.fn(() => ({ emit: vi.fn() })) } as any
      vi.mocked(getRoomBySocket).mockReturnValue(oldRoom)
      vi.mocked(createRoomInStore).mockImplementation((id: string, name: string) => actualStore.createRoom(id, name))

      const socket = hostSocket('repeat-host')
      handleCreateRoom(io, socket, { nickname: 'Peter' })

      expect(oldRoom.players.has('repeat-host')).toBe(false)
      expect(deleteRoom).toHaveBeenCalledWith(oldRoom.code)
      expect(socket.leave).toHaveBeenCalledWith(oldRoom.code)
    })

    it('refuses to join the room the socket is already in', () => {
      const room = actualStore.createRoom('already-here', 'Peter')
      vi.mocked(getRoom).mockReturnValue(room)
      vi.mocked(getRoomBySocket).mockReturnValue(room)
      const socket = { ...hostSocket('already-here'), to: vi.fn(() => ({ emit: vi.fn() })) }

      handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Peter' })

      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'ALREADY_IN_ROOM' }))
    })

    it('limits join attempts per address, which also stops room code guessing', () => {
      vi.mocked(getRoom).mockReturnValue(null)
      for (let i = 0; i < ROOM_LIMITS.join.max; i++) {
        const socket = hostSocket(`guess-${i}`)
        handleJoinRoom({} as any, socket, { roomCode: 'ZZZZZ' + i, nickname: 'Guess' })
        expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'ROOM_NOT_FOUND' }))
      }
      const blocked = hostSocket('guess-blocked')
      handleJoinRoom({} as any, blocked, { roomCode: 'ZZZZZZ', nickname: 'Guess' })
      expect(blocked.emit).toHaveBeenCalledWith('ROOM_ERROR', expect.objectContaining({ code: 'ROOM_RATE_LIMITED' }))
    })
  })
})

describe('joining a game in progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRoomGuardsForTests()
  })

  function lateSocket(id: string) {
    const broadcast = vi.fn()
    return { socket: { id, emit: vi.fn(), join: vi.fn(), to: vi.fn(() => ({ emit: broadcast })) } as any, broadcast }
  }

  it('lets a latecomer in as a spectator with the current game state', () => {
    const room = actualStore.createRoom('host-live-1', 'Peter')
    room.status = 'in_progress'
    vi.mocked(getRoom).mockReturnValue(room)
    vi.mocked(findReturningPlayer).mockReturnValue(null)
    vi.mocked(buildReconnectPayload).mockReturnValue({ playerId: 'late-1', gameState: { roundNumber: 2 } } as any)

    const { socket, broadcast } = lateSocket('late-1')
    handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Ruth' })

    expect(room.players.get('late-1')?.isSpectator).toBe(true)
    expect(socket.join).toHaveBeenCalledWith(room.code)
    expect(socket.emit).toHaveBeenCalledWith(
      'ROOM_JOINED',
      expect.objectContaining({ roomCode: room.code, gameState: { roundNumber: 2 } })
    )
    expect(broadcast).toHaveBeenCalledWith('PLAYER_JOINED', expect.objectContaining({ nickname: 'Ruth', isSpectator: true }))
  })

  it('joins a waiting room as a normal player', () => {
    const room = actualStore.createRoom('host-live-2', 'Peter')
    vi.mocked(getRoom).mockReturnValue(room)
    vi.mocked(findReturningPlayer).mockReturnValue(null)

    const { socket, broadcast } = lateSocket('early-1')
    handleJoinRoom({} as any, socket, { roomCode: room.code, nickname: 'Ruth' })

    expect(room.players.get('early-1')?.isSpectator).toBeUndefined()
    expect(broadcast).toHaveBeenCalledWith('PLAYER_JOINED', expect.not.objectContaining({ isSpectator: true }))
  })
})
