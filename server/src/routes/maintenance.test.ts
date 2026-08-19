import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db/maintenance.js', () => ({
  getMaintenanceStatus: vi.fn()
}))

import { getMaintenanceStatus } from '../db/maintenance.js'
import maintenanceRouter from './maintenance.js'

function makeApp() {
  const app = express()
  app.use(maintenanceRouter)
  return app
}

describe('public maintenance route', () => {
  it('GET /maintenance/status returns the current phase', async () => {
    vi.mocked(getMaintenanceStatus).mockResolvedValue({
      phase: 'freeze',
      endsAt: '2026-06-09T15:00:00.000Z',
      startsAt: '2026-06-09T14:45:00.000Z'
    })

    const response = await request(makeApp()).get('/maintenance/status')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('public, max-age=15')
    expect(response.body).toEqual({
      phase: 'freeze',
      endsAt: '2026-06-09T15:00:00.000Z',
      startsAt: '2026-06-09T14:45:00.000Z'
    })
  })
})
