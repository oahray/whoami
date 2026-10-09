import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPlayCountsForDay, resetPlayCountsForTests } from '../analytics/playCounts.js'
import playTotalsRouter from './playTotals.js'

vi.mock('../redis/client.js', () => ({
  isRedisConfigured: () => false,
  getRedis: async () => null
}))

describe('POST /play-totals', () => {
  afterEach(() => resetPlayCountsForTests())

  it('counts a solo mode start and finish and ignores other fields', async () => {
    const app = express()
    app.use(express.json())
    app.use(playTotalsRouter)

    const started = await request(app)
      .post('/play-totals')
      .send({ mode: 'classic', event: 'started', score: 99, name: 'Moses' })
    expect(started.status).toBe(204)

    const completed = await request(app).post('/play-totals').send({ mode: 'classic', event: 'completed' })
    expect(completed.status).toBe(204)

    const counts = await getPlayCountsForDay()
    expect(counts.soloClassicStarted).toBe(1)
    expect(counts.soloClassicCompleted).toBe(1)
    expect(counts.soloDailyStarted).toBe(0)

    const bad = await request(app).post('/play-totals').send({ mode: 'classic' })
    expect(bad.status).toBe(400)
  })
})
