import { Router } from 'express'
import { parseDifficultyMode } from '../db/entities.js'
import { getRandomInPersonCard, InPersonPlayError } from '../game/inPersonPlay.js'
import { logger } from '../utils/logger.js'

const router = Router()

/**
 * Public endpoint for in-person facilitator mode: one random card (entity +
 * shuffled clues) from an enabled dataset. Requires network; no Socket.IO.
 */
router.get('/cards/random', async (req, res) => {
  try {
    const datasetId = typeof req.query.datasetId === 'string' ? req.query.datasetId.trim() : ''
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }

    const difficultyRaw = req.query.difficulty
    const difficultyMode =
      difficultyRaw === undefined || difficultyRaw === ''
        ? 'any'
        : parseDifficultyMode(difficultyRaw)

    if (!difficultyMode) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }

    const excludeEntityId =
      typeof req.query.excludeEntityId === 'string' && req.query.excludeEntityId.trim() !== ''
        ? req.query.excludeEntityId.trim()
        : undefined

    const card = await getRandomInPersonCard({
      datasetId,
      difficultyMode,
      excludeEntityId
    })

    res.json(card)
  } catch (error) {
    if (error instanceof InPersonPlayError) {
      if (error.code === 'NO_CARDS') {
        return res.status(404).json({ error: error.message, code: error.code })
      }
      return res.status(400).json({ error: error.message, code: error.code })
    }
    logger.error('Error fetching in-person card', error)
    res.status(500).json({ error: 'Failed to fetch card' })
  }
})

export default router
