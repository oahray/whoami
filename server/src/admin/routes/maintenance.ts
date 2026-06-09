import { Router, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  cancelMaintenanceWindow,
  createMaintenanceWindow,
  listMaintenanceWindows,
  MaintenanceScheduleError
} from '../../db/maintenance.js'
import { logger } from '../../utils/logger.js'

const router = Router()

router.get('/maintenance', async (_req: AuthRequest, res: Response) => {
  try {
    const windows = await listMaintenanceWindows()
    res.json(windows)
  } catch (error) {
    logger.error('Error listing maintenance windows', error)
    res.status(500).json({ error: 'Failed to list maintenance windows' })
  }
})

router.post('/maintenance', async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as {
      startsAt?: string
      endsAt?: string
      datasetId?: string | null
      adminNote?: string | null
    }

    if (!body.startsAt || !body.endsAt) {
      return res.status(400).json({ error: 'startsAt and endsAt are required' })
    }

    const window = await createMaintenanceWindow({
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      datasetId: body.datasetId ?? null,
      adminNote: body.adminNote ?? null,
      createdBy: req.user?.id ?? null
    })

    res.status(201).json(window)
  } catch (error) {
    if (error instanceof MaintenanceScheduleError) {
      const status =
        error.code === 'NOT_FOUND' ? 404 : error.code === 'OVERLAPPING_WINDOW' ? 409 : 400
      return res.status(status).json({ error: error.code, message: error.message })
    }
    logger.error('Error creating maintenance window', error)
    res.status(500).json({ error: 'Failed to create maintenance window' })
  }
})

router.delete('/maintenance/:id', async (req: AuthRequest, res: Response) => {
  try {
    await cancelMaintenanceWindow(req.params.id)
    res.json({ success: true })
  } catch (error) {
    if (error instanceof MaintenanceScheduleError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400
      return res.status(status).json({ error: error.code, message: error.message })
    }
    logger.error('Error cancelling maintenance window', error)
    res.status(500).json({ error: 'Failed to cancel maintenance window' })
  }
})

export default router
