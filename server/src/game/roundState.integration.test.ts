import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRoom } from '../rooms/store.js'
import { startGame, startNextRound, activateRound, revealClue, processGuess, endRound } from './roundState.js'
import type { RoomState } from '../rooms/store.js'

vi.mock('../db/entities.js', () => ({
  getCluesForEntity: vi.fn(),
  getDataset: vi.fn(),
  getDefaultEnabledDataset: vi.fn()
}))

vi.mock('./entityPool.js', () => ({
  buildEntityPool: vi.fn()
}))

import { getCluesForEntity, getDataset, getDefaultEnabledDataset } from '../db/entities.js'
import { buildEntityPool } from './entityPool.js'

const DEFAULT_DATASET = {
  id: 'ds-default',
  name: 'Bible',
  source: null,
  description: null,
  is_official: true,
  is_enabled: true,
  is_default: true
}

describe('Round Flow Integration', () => {
  let room: RoomState
  const mockEntity: any = {
    id: 'entity-1',
    name: 'Moses',
    type: 'character',
    is_published: true
  }

  const mockClues = [
    { id: 'clue-1', text: 'Led the Israelites out of Egypt', citations: 'Exodus 1:1' },
    { id: 'clue-2', text: 'Received the Ten Commandments', citations: 'Exodus 20:1' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    room = createRoom('host-1', 'Host')
    room.players.set('player-1', {
      id: 'player-1',
      nickname: 'Player1',
      avatarId: 'avatar-01',
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
      avatarId: 'avatar-01',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })

    room.settings.roundDuration = 30000
    room.settings.clueRevealTime = 10000
    room.settings.totalRounds = 1
    room.settings.strictMode = false

    vi.mocked(buildEntityPool).mockResolvedValue([mockEntity])
    vi.mocked(getCluesForEntity).mockResolvedValue(mockClues as any)
    vi.mocked(getDataset).mockResolvedValue(DEFAULT_DATASET as any)
    vi.mocked(getDefaultEnabledDataset).mockResolvedValue(DEFAULT_DATASET as any)
  })

  describe('full round flow', () => {
    it('should start game and initialize round correctly', async () => {
      await startGame(room)

      expect(room.status).toBe('in_progress')
      expect(room.currentRound).not.toBeNull()
      expect(room.currentRound?.roundNumber).toBe(1)
      expect(room.currentRound?.entity).toEqual(mockEntity)
      expect(room.currentRound?.phase).toBe('starting')
      expect(room.currentRound?.clues).toHaveLength(2)
      expect(room.currentRound?.correctGuesses).toHaveLength(0)
      expect(buildEntityPool).toHaveBeenCalled()
      expect(getCluesForEntity).toHaveBeenCalledWith('entity-1', { difficultySelection: [] })
    })

    it('should activate round and allow guessing', async () => {
      await startGame(room)
      const startTime = room.currentRound!.serverStartTime

      activateRound(room)

      expect(room.currentRound?.phase).toBe('active')
      expect(room.currentRound?.serverStartTime).toBe(startTime)
    })

    it('should process correct guess before clue reveal', async () => {
      await startGame(room)
      activateRound(room)

      const result = processGuess(room, 'player-1', 'Moses')

      expect(result).not.toBeNull()
      expect(result?.correct).toBe(true)
      expect(result?.position).toBe(1)
      expect(result?.pointsEarned).toBeGreaterThan(0)
      expect(room.currentRound?.correctGuesses).toHaveLength(1)
      expect(room.currentRound?.correctGuesses[0].clueIndex).toBe(0)
      expect(room.currentRound?.correctGuesses[0].position).toBe(1)
      expect(room.players.get('player-1')?.isLocked).toBe(true)
      expect(room.scores.get('player-1')).toBeGreaterThan(0)
    })

    it('should process incorrect guess', async () => {
      await startGame(room)
      activateRound(room)

      const result = processGuess(room, 'player-1', 'David')

      expect(result).not.toBeNull()
      expect(result?.correct).toBe(false)
      expect(room.currentRound?.correctGuesses).toHaveLength(0)
      expect(room.players.get('player-1')?.isLocked).toBe(false)
      expect(room.players.get('player-1')?.guessCount).toBe(1)
    })

    it('should reveal clue at correct time', async () => {
      await startGame(room)
      activateRound(room)

      revealClue(room)

      expect(room.currentRound?.phase).toBe('clue_revealed')
    })

    it('should process correct guess after clue reveal with different scoring', async () => {
      await startGame(room)
      activateRound(room)
      revealClue(room)

      const result = processGuess(room, 'player-2', 'Moses')

      expect(result).not.toBeNull()
      expect(result?.correct).toBe(true)
      expect(room.currentRound?.correctGuesses[0].clueIndex).toBe(1)
      expect(result?.pointsEarned).toBeLessThan(1500)
    })

    it('should end round when all players guess correctly', async () => {
      await startGame(room)
      activateRound(room)

      processGuess(room, 'player-1', 'Moses')
      processGuess(room, 'player-2', 'Moses')

      endRound(room)

      expect(room.currentRound?.phase).toBe('ended')
      expect(room.roundHistory).toHaveLength(1)
      expect(room.roundHistory[0].roundNumber).toBe(1)
      expect(room.roundHistory[0].correctGuesses).toHaveLength(2)
      expect(room.roundHistory[0].answerRevealed).toBe(true)
    })

    it('should calculate scores correctly for multiple players', async () => {
      await startGame(room)
      activateRound(room)

      const firstResult = processGuess(room, 'player-1', 'Moses')
      const firstScore = firstResult?.pointsEarned || 0

      await new Promise(resolve => setTimeout(resolve, 100))

      const secondResult = processGuess(room, 'player-2', 'Moses')
      const secondScore = secondResult?.pointsEarned || 0

      expect(firstScore).toBeGreaterThan(secondScore)
      expect(room.currentRound?.correctGuesses[0].position).toBe(1)
      expect(room.currentRound?.correctGuesses[1].position).toBe(2)
      expect(room.scores.get('player-1')).toBeGreaterThan(room.scores.get('player-2') || 0)
    })

    it('should not allow guessing in starting phase', async () => {
      await startGame(room)

      const result = processGuess(room, 'player-1', 'Moses')

      expect(result).toBeNull()
      expect(room.currentRound?.correctGuesses).toHaveLength(0)
    })

    it('should not allow guessing after round ends', async () => {
      await startGame(room)
      activateRound(room)
      processGuess(room, 'player-1', 'Moses')
      processGuess(room, 'player-2', 'Moses')

      const result = processGuess(room, 'player-1', 'Moses')

      expect(result).toBeNull()
    })

    it('should not allow locked player to guess again', async () => {
      await startGame(room)
      activateRound(room)
      processGuess(room, 'player-1', 'Moses')

      const result = processGuess(room, 'player-1', 'Moses')

      expect(result).toBeNull()
    })

    it('should end game after all rounds', async () => {
      room.settings.totalRounds = 2
      const mockEntity2 = { ...mockEntity, id: 'entity-2', name: 'David' }
      vi.mocked(buildEntityPool).mockResolvedValue([mockEntity, mockEntity2])
      vi.mocked(getCluesForEntity).mockImplementation((id: string) => {
        if (id === 'entity-2') {
          return Promise.resolve([
            { id: 'clue-3', text: 'Was a shepherd', citations: '1 Samuel 16:1' },
            { id: 'clue-4', text: 'Defeated Goliath', citations: '1 Samuel 17:1' }
          ] as any)
        }
        return Promise.resolve(mockClues as any)
      })

      await startGame(room)
      expect(room.status).toBe('in_progress')

      activateRound(room)
      processGuess(room, 'player-1', 'Moses')
      processGuess(room, 'player-2', 'Moses')
      endRound(room)

      await startNextRound(room)
      expect(room.currentRound?.roundNumber).toBe(2)

      activateRound(room)
      processGuess(room, 'player-1', 'David')
      processGuess(room, 'player-2', 'David')
      endRound(room)

      await startNextRound(room)
      expect(room.status).toBe('finished')
      expect(room.finalScoreboard).toBeDefined()
      expect(room.finalScoreboard?.length).toBeGreaterThanOrEqual(2)
      expect(room.finalScoreboard?.every(p => p.score >= 0)).toBe(true)
    })

    it('should maintain correct state transitions', async () => {
      await startGame(room)
      expect(room.currentRound?.phase).toBe('starting')

      activateRound(room)
      expect(room.currentRound?.phase).toBe('active')

      revealClue(room)
      expect(room.currentRound?.phase).toBe('clue_revealed')

      processGuess(room, 'player-1', 'Moses')
      processGuess(room, 'player-2', 'Moses')
      endRound(room)
      expect(room.currentRound?.phase).toBe('ended')
    })

    it('should track scoreboard correctly', async () => {
      await startGame(room)
      activateRound(room)

      processGuess(room, 'player-1', 'Moses')
      await new Promise(resolve => setTimeout(resolve, 50))
      processGuess(room, 'player-2', 'Moses')
      endRound(room)

      const scoreboard = room.roundHistory[0].scoreboard
      expect(scoreboard).toHaveLength(3)
      expect(scoreboard[0].timeElapsedMs).toBeLessThan(scoreboard[1].timeElapsedMs)
      expect(scoreboard[0].totalScore).toBeGreaterThanOrEqual(scoreboard[1].totalScore)
      expect(scoreboard[2].totalScore).toBe(0)
    })
  })
})
