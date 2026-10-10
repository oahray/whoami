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

  it('counts a pass and play start and each character loaded', async () => {
    const app = express()
    app.use(express.json())
    app.use(playTotalsRouter)

    const started = await request(app)
      .post('/play-totals')
      .send({ mode: 'pass', event: 'started', entityIds: ['secret'], difficulty: 'hard' })
    expect(started.status).toBe(204)
    const loaded = await request(app).post('/play-totals').send({ mode: 'pass', event: 'loaded', name: 'Moses' })
    expect(loaded.status).toBe(204)

    const counts = await getPlayCountsForDay()
    expect(counts.passAndPlayStarted).toBe(1)
    expect(counts.passAndPlayCharactersLoaded).toBe(1)
    expect(counts.soloClassicStarted).toBe(0)

    const bulk = await request(app).post('/play-totals').send({ mode: 'pass', event: 'started', cards: 40 })
    expect(bulk.status).toBe(204)
    expect((await getPlayCountsForDay()).passAndPlayCharactersLoaded).toBe(1)
  })
})
