import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../rooms/store.js', async () => {
  const actual = await vi.importActual<typeof import('../../rooms/store.js')>('../../rooms/store.js')
  return {
    ...actual,
    getRoomBySocket: vi.fn()
  }
})

vi.mock('../../game/roundState.js', async () => {
  const actual = await vi.importActual<typeof import('../../game/roundState.js')>(
    '../../game/roundState.js'
  )
  return {
    ...actual,
    startGame: vi.fn(),
    startNextRound: vi.fn(),
    activateRound: vi.fn(),
    revealClue: vi.fn(),
    processGuess: vi.fn(),
    endRound: vi.fn(),
    resetRoomForNewGame: vi.fn()
  }
})

vi.mock('./utils.js', () => ({
  broadcastRoundEnd: vi.fn()
}))

vi.mock('../../db/maintenance.js', () => ({
  getMaintenanceBlock: vi.fn().mockResolvedValue(null)
}))

const actualStore = await vi.importActual<typeof import('../../rooms/store.js')>('../../rooms/store.js')

import { getRoomBySocket } from '../../rooms/store.js'
import {
  GameStartError,
  processGuess,
  resetRoomForNewGame,
  startGame
} from '../../game/roundState.js'
import { broadcastRoundEnd } from './utils.js'
import { handleStartGame, handleSubmitGuess } from './game.js'

describe('game socket handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects starting when a game is already in progress', async () => {
    const room = actualStore.createRoom('host-socket', 'Host')
    const socket = { id: 'host-socket', emit: vi.fn() } as any
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) } as any

    room.status = 'in_progress'
    vi.mocked(getRoomBySocket).mockReturnValue(room)

    await handleStartGame(io, socket, {})

    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'GAME_IN_PROGRESS',
      message: 'Game is already in progress'
    })
  })

  it('resets a finished room and emits ROUND_STARTED with current scoreboard', async () => {
    const room = actualStore.createRoom('host-socket', 'Host')
    const roomEmit = vi.fn()
    const socket = { id: 'host-socket', emit: vi.fn() } as any
    const io = { to: vi.fn(() => ({ emit: roomEmit })) } as any

    room.status = 'finished'
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
    room.scores.set('host-socket', 100)
    room.scores.set('p2', 250)

    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(startGame).mockImplementation(async (targetRoom: any) => {
      targetRoom.status = 'in_progress'
      targetRoom.currentRound = {
        roundNumber: 1,
        phase: 'starting',
        serverStartTime: 123,
        clues: [{ order: 1, text: 'Led Israel out of Egypt' }]
      }
    })

    await handleStartGame(io, socket, {})

    expect(resetRoomForNewGame).toHaveBeenCalledWith(room)
    expect(roomEmit).toHaveBeenCalledWith('ROUND_STARTED', expect.objectContaining({
      roundNumber: 1,
      currentScoreboard: [
        { playerId: 'p2', nickname: 'Paul', score: 250 },
        { playerId: 'host-socket', nickname: 'Host', score: 100 }
      ]
    }))
  })

  it('broadcasts correct guesses and round-end when the round has already ended', () => {
    const room = actualStore.createRoom('host-socket', 'Host')
    const roomEmit = vi.fn()
    const socket = { id: 'host-socket', emit: vi.fn() } as any
    const io = { to: vi.fn(() => ({ emit: roomEmit })) } as any

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
    room.currentRound = {
      phase: 'ended'
    } as any
    room.roundHistory = [{ scoreboard: [] }] as any

    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(processGuess).mockReturnValue({
      correct: true,
      position: 1,
      timeElapsedMs: 1200
    })

    handleSubmitGuess(io, socket, { guess: 'Moses' })

    expect(roomEmit).toHaveBeenCalledWith('GUESS_BROADCAST', {
      nickname: 'Host',
      guess: 'Moses',
      correct: true
    })
    expect(roomEmit).toHaveBeenCalledWith('PLAYER_CORRECT', {
      nickname: 'Host',
      position: 1,
      timeElapsedMs: 1200
    })
    expect(broadcastRoundEnd).toHaveBeenCalledWith(io, room, room.roundHistory[0])
  })

  it('emits DATASET_DISABLED when startGame rejects a disabled dataset', async () => {
    const room = actualStore.createRoom('host-socket', 'Host')
    const socket = { id: 'host-socket', emit: vi.fn() } as any
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) } as any

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
    vi.mocked(startGame).mockImplementationOnce(async () => {
      throw new GameStartError('DATASET_DISABLED', 'Selected dataset is disabled')
    })

    await handleStartGame(io, socket, {})

    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'DATASET_DISABLED',
      message: 'Selected dataset is disabled'
    })
  })

  it('emits PLAYER_LOCKED when a locked player guesses again', () => {
    const room = actualStore.createRoom('host-socket', 'Host')
    const socket = { id: 'host-socket', emit: vi.fn() } as any
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) } as any

    room.currentRound = {
      phase: 'active'
    } as any
    room.players.get('host-socket')!.isLocked = true

    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(processGuess).mockReturnValue(null)

    handleSubmitGuess(io, socket, { guess: 'Moses' })

    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'PLAYER_LOCKED',
      message: 'You have already guessed correctly this round'
    })
  })
})
