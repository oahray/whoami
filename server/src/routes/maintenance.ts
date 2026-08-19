import { Router } from 'express'
import { getMaintenanceStatus } from '../db/maintenance.js'
import { logger } from '../utils/logger.js'

const router = Router()

router.get('/maintenance/status', async (_req, res) => {
  try {
    const status = await getMaintenanceStatus()
    res.set('Cache-Control', 'public, max-age=15')
    res.json(status)
  } catch (error) {
    logger.error('Error fetching maintenance status', error)
    res.status(500).json({ error: 'Failed to fetch maintenance status' })
  }
})

export default router
