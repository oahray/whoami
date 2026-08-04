import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoom, deleteRoom, getAllRooms, getLiveMultiplayerStats } from '../../rooms/store.js'
import liveRouter from './live.js'

describe('getLiveMultiplayerStats', () => {
  afterEach(() => {
    for (const code of [...getAllRooms().keys()]) {
      deleteRoom(code)
    }
  })

  it('counts connected players and room statuses', () => {
    const waiting = createRoom('host-1', 'Host')
    const playing = createRoom('host-2', 'Host2')
    playing.status = 'in_progress'
    playing.players.set('guest', {
      id: 'guest',
      nickname: 'Guest',
      avatarId: 'avatar-01',
      isHost: false,
      isConnected: true,
      disconnectedAt: null,
      guessCount: 0,
      lastGuessAt: null,
      isLocked: false
    })
    playing.players.get('host-2')!.isConnected = false

    const stats = getLiveMultiplayerStats()
    expect(stats.totalRooms).toBe(2)
    expect(stats.roomsWaiting).toBe(1)
    expect(stats.roomsInProgress).toBe(1)
    // waiting host + playing guest (host-2 disconnected)
    expect(stats.connectedPlayers).toBe(2)
    expect(waiting.code).toBeTruthy()
  })
})

describe('GET /admin/live', () => {
  beforeEach(() => {
    for (const code of [...getAllRooms().keys()]) {
      deleteRoom(code)
    }
  })

  afterEach(() => {
    for (const code of [...getAllRooms().keys()]) {
      deleteRoom(code)
    }
  })

  it('returns anonymous live multiplayer totals', async () => {
    createRoom('host-1', 'Host')
    const app = express()
    app.use(liveRouter)

    const res = await request(app).get('/live')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      connectedPlayers: 1,
      roomsWaiting: 1,
      roomsInProgress: 0,
      totalRooms: 1
    })
    expect(res.body.asOf).toEqual(expect.any(String))
    expect(JSON.stringify(res.body)).not.toMatch(/Host|host-1/)
  })
})
