import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetPlayCountsForTests, recordPlayCount } from '../../analytics/playCounts.js'
import playTotalsRouter from './playTotals.js'

vi.mock('../../redis/client.js', () => ({
  isRedisConfigured: () => false,
  getRedis: async () => null
}))

describe('GET /admin/play-totals', () => {
  afterEach(() => resetPlayCountsForTests())

  it('returns today multiplayer totals and rejects other ranges', async () => {
    recordPlayCount('multiplayerRoomsCreated')
    recordPlayCount('multiplayerGamesStarted')
    const app = express()
    app.use(playTotalsRouter)

    const today = await request(app).get('/play-totals')
    expect(today.status).toBe(200)
    expect(today.body.range).toBe('today')
    expect(today.body.timeZone).toBe('UTC')
    expect(today.body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(today.body.multiplayer).toMatchObject({
      roomsCreated: 1,
      gamesStarted: 1,
      gamesCompleted: 0,
      abandonedBeforeStart: 0,
      playerConnections: 0
    })
    expect(today.body.solo).toEqual({
      classic: { started: 0, completed: 0 },
      daily: { started: 0, completed: 0 },
      endurance: { started: 0, completed: 0 },
      review: { started: 0, completed: 0 }
    })
    expect(JSON.stringify(today.body)).not.toMatch(/nickname|roomCode|playerId/i)

    const week = await request(app).get('/play-totals?range=week')
    expect(week.status).toBe(400)
  })
})
