import { Router, Response } from 'express'
import { getLiveMultiplayerStats } from '../../rooms/store.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

/** Live multiplayer presence from in-memory rooms (admin auth required). */
router.get('/live', (_req: AuthRequest, res: Response) => {
  res.json({
    ...getLiveMultiplayerStats(),
    asOf: new Date().toISOString()
  })
})

export default router
