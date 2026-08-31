import { describe, expect, it } from 'vitest'
import {
  deserializeRoom,
  prepareRoomForHydrate,
  roomRedisKey,
  serializeRoom
} from './serialize.js'
import { createRoom } from './store.js'

describe('room serialize', () => {
  it('builds a namespaced redis key', () => {
    expect(roomRedisKey('ABC123')).toBe('whoami:room:ABC123')
  })

  it('round-trips a waiting lobby without timers', () => {
    const room = createRoom('host-1', 'Host', 'avatar-02')
    room.settings.totalRounds = 7
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
    room.scores.set('host-1', 0)
    room.kickedPlayers.set('spam', 1)

    const json = serializeRoom(room)
    expect(json.currentRound).toBeNull()
    expect(json.players).toHaveLength(2)
    expect(json.scores).toEqual([['host-1', 0]])

    const restored = deserializeRoom(json)
    expect(restored.code).toBe(room.code)
    expect(restored.hostId).toBe('host-1')
    expect(restored.settings.totalRounds).toBe(7)
    expect(restored.players.get('p2')?.nickname).toBe('Paul')
    expect(restored.kickedPlayers.get('spam')).toBe(1)
    expect(restored.currentRound).toBeNull()
  })

  it('preserves shuffled clue order for an in-progress round', () => {
    const room = createRoom('host-1', 'Host')
    room.status = 'in_progress'
    room.currentRound = {
      roundNumber: 2,
      entity: {
        id: 'e1',
        name: 'Moses',
        type: 'character',
        is_published: true
      },
      clues: [
        { id: 'c3', order: 1, text: 'Shepherd', citations: null },
        { id: 'c1', order: 2, text: 'Goliath', citations: null }
      ],
      phase: 'clue_revealed',
      serverStartTime: 1000,
      activeStartTime: 4000,
      revealedClueCount: 2,
      correctGuesses: [],
      timers: {
        clueReveal: setTimeout(() => {}, 999_999),
        roundEnd: null
      }
    }

    const json = serializeRoom(room)
    expect(json.currentRound && 'timers' in json.currentRound).toBe(false)
    expect(json.currentRound?.clues.map((c) => c.text)).toEqual(['Shepherd', 'Goliath'])

    const restored = deserializeRoom(json)
    expect(restored.currentRound?.timers.clueReveal).toBeNull()
    expect(restored.currentRound?.clues.map((c) => c.text)).toEqual(['Shepherd', 'Goliath'])
    expect(restored.currentRound?.revealedClueCount).toBe(2)

    clearTimeout(room.currentRound.timers.clueReveal!)
  })

  it('demotes in-progress rooms to a joinable lobby on hydrate', () => {
    const room = createRoom('host-1', 'Host')
    room.status = 'in_progress'
    room.scores.set('host-1', 40)
    room.currentRound = {
      roundNumber: 1,
      entity: {
        id: 'e1',
        name: 'Moses',
        type: 'character',
        is_published: true
      },
      clues: [{ id: 'c1', order: 1, text: 'Clue', citations: null }],
      phase: 'active',
      serverStartTime: 1,
      activeStartTime: 2,
      revealedClueCount: 1,
      correctGuesses: [],
      timers: { clueReveal: null, roundEnd: null }
    }

    const prepared = prepareRoomForHydrate(room, 5_000)
    expect(prepared.status).toBe('waiting')
    expect(prepared.currentRound).toBeNull()
    expect(prepared.scores.size).toBe(0)
    expect(prepared.players.get('host-1')?.isConnected).toBe(false)
    expect(prepared.players.get('host-1')?.disconnectedAt).toBe(5_000)
  })
})
