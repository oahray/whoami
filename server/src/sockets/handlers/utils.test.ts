import { describe, it, expect } from 'vitest'
import { createRoom } from '../../rooms/store.js'
import { buildReconnectPayload, findReturningPlayer, GRACE_PERIOD_MS } from './utils.js'

describe('socket handler utils', () => {
  describe('findReturningPlayer', () => {
    it('returns a disconnected player within the grace period', () => {
      const room = createRoom('host-1', 'Host')
      const host = room.players.get('host-1')!

      host.isConnected = false
      host.disconnectedAt = Date.now() - 1_000

      const returning = findReturningPlayer(room, 'Host')

      expect(returning).toBe(host)
    })

    it('does not return a disconnected player after the grace period', () => {
      const room = createRoom('host-1', 'Host')
      const host = room.players.get('host-1')!

      host.isConnected = false
      host.disconnectedAt = Date.now() - GRACE_PERIOD_MS - 1_000

      const returning = findReturningPlayer(room, 'Host')

      expect(returning).toBeNull()
    })
  })

  describe('buildReconnectPayload', () => {
    it('includes only the visible first clue during an active round', () => {
      const room = createRoom('host-1', 'Host')
      const host = room.players.get('host-1')!

      room.status = 'in_progress'
      room.scores.set('host-1', 150)
      room.currentRound = {
        roundNumber: 1,
        entity: {
          id: 'entity-1',
          name: 'Moses',
          type: 'character',
          is_published: true
        },
        clues: [
          { id: 'c1', order: 1, text: 'Led Israel out of Egypt', citations: null },
          { id: 'c2', order: 2, text: 'Saw a burning bush', citations: null }
        ],
        phase: 'active',
        serverStartTime: 123456789,
        activeStartTime: 123456789 + 3000,
        revealedClueCount: 1,
        correctGuesses: [],
        timers: {
          clueReveal: null,
          roundEnd: null
        }
      }

      const payload = buildReconnectPayload(room, host)

      expect(payload.players).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'host-1', nickname: 'Host', avatarId: host.avatarId })
        ])
      )
      expect(payload.gameState.serverStartTime).toBe(123456789)
      expect(payload.gameState.cluesRevealed).toEqual([
        { order: 1, text: 'Led Israel out of Egypt' }
      ])
      expect(payload.gameState.currentScoreboard).toEqual([
        { playerId: 'host-1', nickname: 'Host', score: 150 }
      ])
    })

    it('includes two clues once the second clue has been revealed', () => {
      const room = createRoom('host-1', 'Host')
      const host = room.players.get('host-1')!

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

      room.status = 'in_progress'
      room.scores.set('host-1', 50)
      room.scores.set('p2', 200)
      room.currentRound = {
        roundNumber: 2,
        entity: {
          id: 'entity-2',
          name: 'Paul',
          type: 'character',
          is_published: true
        },
        clues: [
          { id: 'c1', order: 1, text: 'Missionary apostle', citations: null },
          { id: 'c2', order: 2, text: 'Formerly persecuted Christians', citations: null }
        ],
        phase: 'clue_revealed',
        serverStartTime: 987654321,
        activeStartTime: 987654321 + 3000,
        revealedClueCount: 2,
        correctGuesses: [],
        timers: {
          clueReveal: null,
          roundEnd: null
        }
      }

      const payload = buildReconnectPayload(room, host)

      expect(payload.gameState.cluesRevealed).toEqual([
        { order: 1, text: 'Missionary apostle' },
        { order: 2, text: 'Formerly persecuted Christians' }
      ])
      expect(payload.gameState.currentScoreboard).toEqual([
        { playerId: 'p2', nickname: 'Paul', score: 200 },
        { playerId: 'host-1', nickname: 'Host', score: 50 }
      ])
    })

    it('includes a signed archive for the latest finished game', () => {
      const room = createRoom('host-1', 'Host')
      const host = room.players.get('host-1')!
      room.status = 'finished'
      room.finalScoreboard = [{ playerId: 'host-1', nickname: 'Host', score: 10 }]
      room.gameHistory = [{
        id: 'ABC-1',
        gameNumber: 1,
        endedAt: 1,
        totalRounds: 5,
        difficultyMode: 'any',
        roundDurationMs: 30_000,
        clueRevealTimeMs: 5_000,
        scoreboard: [{ playerId: 'host-1', nickname: 'Host', avatarId: host.avatarId, score: 10 }]
      }]

      const payload = buildReconnectPayload(room, host)

      expect(payload.signedArchive).toEqual(
        expect.objectContaining({
          signature: expect.any(String),
          payload: expect.objectContaining({
            id: 'ABC-1',
            roomCode: room.code,
            viewerPlayerId: 'host-1'
          })
        })
      )
    })
  })
})
