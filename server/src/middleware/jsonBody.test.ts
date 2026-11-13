import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

const authSawBody = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('../admin/auth.js', () => ({
  adminAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    authSawBody.value = req.body
    if (req.headers.authorization !== 'Bearer admin') return res.status(401).json({ error: 'Unauthorized' })
    next()
  }
}))

vi.mock('../admin/routes/bulkImport.js', async () => {
  const { Router } = await import('express')
  const router = Router()
  router.post('/bulk-import', (req, res) => res.json({ count: req.body.entities.length }))
  return { default: router }
})

const { jsonBody } = await import('./jsonBody.js')
const { default: adminRoutes } = await import('../admin/routes/index.js')

function buildApp() {
  const app = express()
  app.use(jsonBody)
  app.post('/echo', (req, res) => res.json({ ok: Boolean(req.body) }))
  app.use('/admin', adminRoutes)
  return app
}

const bigBody = { entities: Array.from({ length: 2000 }, (_, i) => ({ name: `Entity ${i}`, notes: 'x'.repeat(200) })) }

describe('jsonBody', () => {
  it('turns away an anonymous bulk import before reading its body', async () => {
    authSawBody.value = 'unset'
    const res = await request(buildApp()).post('/admin/bulk-import').send(bigBody)
    expect(res.status).toBe(401)
    expect(authSawBody.value).toBeUndefined()
  })

  it('reads a large bulk import body once the admin is signed in', async () => {
    const res = await request(buildApp())
      .post('/admin/bulk-import')
      .set('Authorization', 'Bearer admin')
      .send(bigBody)
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2000)
  })

  it('keeps the small limit everywhere else', async () => {
    const res = await request(buildApp()).post('/echo').send(bigBody)
    expect(res.status).toBe(413)
  })
})
