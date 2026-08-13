import { describe, expect, it } from 'vitest'
import { createRoom, recordFinishedGame } from './store.js'
import { GAME_HISTORY_MAX } from '../game/multiplayerDefaults.js'

describe('recordFinishedGame', () => {
  it('appends score-only snapshots and caps at GAME_HISTORY_MAX', () => {
    const room = createRoom('host-1', 'Host', 'avatar-01')
    room.players.set('p2', {
      id: 'p2',
      nickname: 'Paul',
      avatarId: 'avatar-02',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })

    for (let i = 0; i < GAME_HISTORY_MAX + 3; i++) {
      room.finalScoreboard = [
        { playerId: 'p2', nickname: 'Paul', score: 100 + i },
        { playerId: 'host-1', nickname: 'Host', score: 50 + i }
      ]
      recordFinishedGame(room)
    }

    expect(room.gameHistory).toHaveLength(GAME_HISTORY_MAX)
    expect(room.gameHistory[0]?.gameNumber).toBe(4)
    expect(room.gameHistory[GAME_HISTORY_MAX - 1]?.gameNumber).toBe(GAME_HISTORY_MAX + 3)
    expect(room.gameHistory[GAME_HISTORY_MAX - 1]?.scoreboard).toEqual([
      expect.objectContaining({ nickname: 'Paul', avatarId: 'avatar-02', score: 100 + GAME_HISTORY_MAX + 2 }),
      expect.objectContaining({ nickname: 'Host', avatarId: 'avatar-01', score: 50 + GAME_HISTORY_MAX + 2 })
    ])
  })
})
