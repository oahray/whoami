import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler } from './errorHandler.js'
import { logger } from '../utils/logger.js'

describe('errorHandler middleware', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a JSON 500 (no HTML stack trace) when a sync route throws', async () => {
    const app = express()
    app.get('/boom', () => {
      throw new Error('kaboom')
    })
    app.use(errorHandler)

    const res = await request(app).get('/boom')

    expect(res.status).toBe(500)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(res.body).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    })
    expect(logger.error).toHaveBeenCalled()
  })

  it('returns a JSON 500 when an async route calls next(err)', async () => {
    const app = express()
    app.get('/async-boom', async (_req, _res, next) => {
      next(new Error('async-kaboom'))
    })
    app.use(errorHandler)

    const res = await request(app).get('/async-boom')

    expect(res.status).toBe(500)
    expect(res.body.error).toBe('INTERNAL_ERROR')
  })

  it('does not mutate response if headers were already sent', async () => {
    const app = express()
    app.get('/partial', (_req, res, next) => {
      res.status(202).json({ partial: true })
      next(new Error('after-send'))
    })
    app.use(errorHandler)

    const res = await request(app).get('/partial')

    expect(res.status).toBe(202)
    expect(res.body).toEqual({ partial: true })
  })
})
