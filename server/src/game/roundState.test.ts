import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoom } from '../rooms/store.js'

vi.mock('../db/entities.js', () => ({
  getCluesForEntity: vi.fn(),
  getDataset: vi.fn(),
  getDefaultEnabledDataset: vi.fn()
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

import { getCluesForEntity, getDataset, getDefaultEnabledDataset } from '../db/entities.js'
import { buildEntityPool } from './entityPool.js'
import { calculateScore } from './scoring.js'
import { validateGuess } from './validation.js'
import { hasExceededMaxGuesses, isRateLimited } from './rateLimit.js'
import {
  endGame,
  endRound,
  GameStartError,
  processGuess,
  resetRoomForNewGame,
  revealClue,
  startGame,
  startNextRound
} from './roundState.js'

const DEFAULT_DATASET = {
  id: 'ds-default',
  name: 'Bible',
  source: null,
  description: null,
  is_official: true,
  is_enabled: true,
  is_default: true
}

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
    vi.mocked(getDataset).mockResolvedValue(DEFAULT_DATASET as any)
    vi.mocked(getDefaultEnabledDataset).mockResolvedValue(DEFAULT_DATASET as any)
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
    room.currentRound!.activeStartTime = Date.now() - 1000

    const result = processGuess(room, 'player-1', 'Moses')

    expect(validateGuess).toHaveBeenCalledWith('Moses', 'Moses', room.settings.strictMode, [])
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

  it('endRound includes all revealed clues (not capped at 2)', async () => {
    const room = createTestRoom()
    // Three-clue entity to verify the revealed count drives the slice
    const threeClues = [
      { id: 'clue-1', text: 'A', citations: null },
      { id: 'clue-2', text: 'B', citations: null },
      { id: 'clue-3', text: 'C', citations: null }
    ]
    vi.mocked(getCluesForEntity).mockResolvedValueOnce(threeClues as any)

    await startGame(room)
    revealClue(room)
    revealClue(room)

    endRound(room)

    expect(room.roundHistory[0].clues).toHaveLength(3)
  })

  it('revealClue advances the revealed count and returns the next clue', async () => {
    const room = createTestRoom()
    await startGame(room)

    expect(room.currentRound?.revealedClueCount).toBe(1)
    const first = revealClue(room)
    expect(first?.order).toBe(2)
    expect(room.currentRound?.revealedClueCount).toBe(2)
    expect(room.currentRound?.phase).toBe('clue_revealed')
    // No more clues for this entity
    const second = revealClue(room)
    expect(second).toBeNull()
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
      activeStartTime: Date.now(),
      revealedClueCount: 1,
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

  it('startGame falls back to the default-enabled dataset when none is selected', async () => {
    const room = createTestRoom()
    expect(room.settings.datasetId).toBeNull()

    await startGame(room)

    expect(getDefaultEnabledDataset).toHaveBeenCalled()
    expect(room.settings.datasetId).toBe(DEFAULT_DATASET.id)
    expect(buildEntityPool).toHaveBeenCalledWith(
      room.settings.difficultyMode,
      room.settings.totalRounds,
      DEFAULT_DATASET.id
    )
  })

  it('startGame throws GameStartError when the selected dataset is disabled', async () => {
    const room = createTestRoom()
    room.settings.datasetId = 'ds-disabled'
    vi.mocked(getDataset).mockResolvedValueOnce({
      ...DEFAULT_DATASET,
      id: 'ds-disabled',
      is_enabled: false,
      is_default: false
    } as any)

    await expect(startGame(room)).rejects.toBeInstanceOf(GameStartError)
    expect(buildEntityPool).not.toHaveBeenCalled()
  })

  it('startGame throws NO_DATASET when no enabled dataset can be resolved', async () => {
    const room = createTestRoom()
    vi.mocked(getDefaultEnabledDataset).mockResolvedValueOnce(null)

    await expect(startGame(room)).rejects.toMatchObject({
      name: 'GameStartError',
      code: 'NO_DATASET'
    })
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
