import { Router } from 'express'
import { getHistoryPublicKeyResponse } from '../game/historyArchive.js'

const router = Router()

router.get('/history-public-key', (_req, res) => {
  const body = getHistoryPublicKeyResponse()
  if (!body) {
    res.status(503).json({ error: 'History signing is unavailable' })
    return
  }
  res.json({
    alg: body.alg,
    kid: body.kid,
    publicKey: body.publicKey
  })
})

export default router
