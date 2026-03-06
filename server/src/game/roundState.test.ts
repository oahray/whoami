import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoom } from '../rooms/store.js'

vi.mock('../db/entities.js', () => ({
  getCluesForEntity: vi.fn()
}))

vi.mock('./entityPool.js', () => ({
  buildEntityPool: vi.fn()
}))

vi.mock('./scoring.js', () => ({
  calculateScore: vi.fn()
}))

vi.mock('./validation.js', () => ({
  validateGuess: vi.fn()
}))

vi.mock('./rateLimit.js', () => ({
  isRateLimited: vi.fn(),
  hasExceededMaxGuesses: vi.fn()
}))

import { getCluesForEntity } from '../db/entities.js'
import { buildEntityPool } from './entityPool.js'
import { calculateScore } from './scoring.js'
import { validateGuess } from './validation.js'
import { hasExceededMaxGuesses, isRateLimited } from './rateLimit.js'
import {
  endGame,
  endRound,
  processGuess,
  resetRoomForNewGame,
  revealClue,
  startGame,
  startNextRound
} from './roundState.js'

describe('roundState unit', () => {
  const mockEntity = {
    id: 'entity-1',
    name: 'Moses',
    type: 'character' as const,
    is_published: true
  }

  const mockClues = [
    { id: 'clue-1', text: 'Led Israel out of Egypt', citations: 'Exodus 12' },
    { id: 'clue-2', text: 'Received the Ten Commandments', citations: 'Exodus 20' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buildEntityPool).mockResolvedValue([mockEntity])
    vi.mocked(getCluesForEntity).mockResolvedValue(mockClues as any)
    vi.mocked(calculateScore).mockReturnValue(321)
    vi.mocked(validateGuess).mockReturnValue(true)
    vi.mocked(isRateLimited).mockReturnValue(false)
    vi.mocked(hasExceededMaxGuesses).mockReturnValue(false)
  })

  function createTestRoom() {
    const room = createRoom('host-1', 'Host')
    room.players.set('player-1', {
      id: 'player-1',
      nickname: 'Player1',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })
    room.players.set('player-2', {
      id: 'player-2',
      nickname: 'Player2',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })
    return room
  }

  it('startGame initializes scores, players, and first round', async () => {
    const room = createTestRoom()
    room.players.get('player-1')!.guessCount = 3
    room.players.get('player-1')!.lastGuessAt = Date.now()
    room.players.get('player-1')!.isLocked = true

    await startGame(room)

    expect(room.status).toBe('in_progress')
    expect(room.currentRound?.roundNumber).toBe(1)
    expect(room.currentRound?.entity).toEqual(mockEntity)
    expect(room.currentRound?.clues).toHaveLength(2)
    expect(room.scores.get('host-1')).toBe(0)
    expect(room.scores.get('player-1')).toBe(0)
    expect(room.players.get('player-1')?.guessCount).toBe(0)
    expect(room.players.get('player-1')?.lastGuessAt).toBeNull()
    expect(room.players.get('player-1')?.isLocked).toBe(false)
  })

  it('processGuess records a correct guess, locks player, and updates score', async () => {
    const room = createTestRoom()
    await startGame(room)
    room.currentRound!.phase = 'active'
    room.currentRound!.serverStartTime = Date.now() - 1000

    const result = processGuess(room, 'player-1', 'Moses')

    expect(validateGuess).toHaveBeenCalledWith('Moses', 'Moses', room.settings.strictMode)
    expect(calculateScore).toHaveBeenCalled()
    expect(result).toEqual({
      correct: true,
      position: 1,
      timeElapsedMs: expect.any(Number),
      pointsEarned: 321
    })
    expect(room.players.get('player-1')?.isLocked).toBe(true)
    expect(room.currentRound?.correctGuesses).toHaveLength(1)
    expect(room.scores.get('player-1')).toBe(321)
  })

  it('processGuess returns null when player is rate limited or over max guesses', async () => {
    const room = createTestRoom()
    await startGame(room)
    room.currentRound!.phase = 'active'

    vi.mocked(isRateLimited).mockReturnValue(true)
    expect(processGuess(room, 'player-1', 'Moses')).toBeNull()

    vi.mocked(isRateLimited).mockReturnValue(false)
    vi.mocked(hasExceededMaxGuesses).mockReturnValue(true)
    expect(processGuess(room, 'player-1', 'Moses')).toBeNull()
  })

  it('endRound includes all players and only revealed clues in scoreboard payload', async () => {
    const room = createTestRoom()
    await startGame(room)
    room.currentRound!.phase = 'active'
    room.scores.set('player-1', 500)

    room.currentRound!.correctGuesses.push({
      playerId: 'player-1',
      nickname: 'Player1',
      timeElapsedMs: 1200,
      clueIndex: 0,
      position: 1,
      pointsEarned: 500
    })

    endRound(room)

    expect(room.roundHistory).toHaveLength(1)
    expect(room.roundHistory[0].clues).toHaveLength(1)
    expect(room.roundHistory[0].scoreboard).toHaveLength(3)
    expect(room.roundHistory[0].scoreboard[0]).toMatchObject({
      playerId: 'player-1',
      totalScore: 500,
      pointsEarned: 500
    })
    expect(room.roundHistory[0].scoreboard[2].totalScore).toBe(0)
  })

  it('endRound includes two clues after clue reveal', async () => {
    const room = createTestRoom()
    await startGame(room)
    revealClue(room)

    endRound(room)

    expect(room.roundHistory[0].clues).toHaveLength(2)
  })

  it('startNextRound ends the game when all rounds are exhausted', async () => {
    const room = createTestRoom()
    room.settings.totalRounds = 1
    room.status = 'in_progress'
    room.roundHistory = [{ roundNumber: 1 }] as any
    room.scores.set('host-1', 100)
    room.scores.set('player-1', 200)
    room.scores.set('player-2', 50)

    await startNextRound(room)

    expect(room.status).toBe('finished')
    expect(room.currentRound).toBeNull()
    expect(room.finalScoreboard).toEqual([
      { playerId: 'player-1', nickname: 'Player1', score: 200 },
      { playerId: 'host-1', nickname: 'Host', score: 100 },
      { playerId: 'player-2', nickname: 'Player2', score: 50 }
    ])
  })

  it('resetRoomForNewGame clears transient game state but keeps players and settings', () => {
    const room = createTestRoom()
    room.status = 'finished'
    room.currentRound = {
      roundNumber: 2,
      entity: mockEntity,
      clues: [],
      phase: 'ended',
      serverStartTime: Date.now(),
      correctGuesses: [],
      timers: {
        clueReveal: null,
        roundEnd: null
      }
    }
    room.roundHistory = [{ roundNumber: 1 }] as any
    room.entityPool = [mockEntity]
    room.usedEntityIds.add(mockEntity.id)
    room.scores.set('player-1', 999)
    room.finalScoreboard = [{ playerId: 'player-1', nickname: 'Player1', score: 999 }]
    room.players.get('player-1')!.guessCount = 4
    room.players.get('player-1')!.lastGuessAt = Date.now()
    room.players.get('player-1')!.isLocked = true
    room.settings.strictMode = true

    resetRoomForNewGame(room)

    expect(room.status).toBe('waiting')
    expect(room.currentRound).toBeNull()
    expect(room.roundHistory).toEqual([])
    expect(room.entityPool).toEqual([])
    expect(room.usedEntityIds.size).toBe(0)
    expect(room.scores.size).toBe(0)
    expect(room.finalScoreboard).toBeUndefined()
    expect(room.players.get('player-1')?.guessCount).toBe(0)
    expect(room.players.get('player-1')?.lastGuessAt).toBeNull()
    expect(room.players.get('player-1')?.isLocked).toBe(false)
    expect(room.players.get('player-1')?.nickname).toBe('Player1')
    expect(room.settings.strictMode).toBe(true)
  })

  it('endGame sorts final scoreboard by score descending', () => {
    const room = createTestRoom()
    room.status = 'in_progress'
    room.scores.set('host-1', 100)
    room.scores.set('player-1', 400)
    room.scores.set('player-2', 250)

    endGame(room)

    expect(room.status).toBe('finished')
    expect(room.finalScoreboard).toEqual([
      { playerId: 'player-1', nickname: 'Player1', score: 400 },
      { playerId: 'player-2', nickname: 'Player2', score: 250 },
      { playerId: 'host-1', nickname: 'Host', score: 100 }
    ])
  })
})
