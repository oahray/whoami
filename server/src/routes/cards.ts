import { Router, type Response } from 'express'
import { parseDifficultyMode } from '../db/entities.js'
import { parseEntityTypeFilter } from '../game/entityTypeFilter.js'
import {
  buildInPersonCardForEntity,
  getInPersonDeck,
  getInPersonEligibility,
  getRandomInPersonCard,
  InPersonPlayError
} from '../game/inPersonPlay.js'
import { logger } from '../utils/logger.js'

const router = Router()

function parseDatasetId(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseDifficultyQuery(raw: unknown) {
  if (raw === undefined || raw === '') return 'any' as const
  return parseDifficultyMode(raw)
}

function parseEntityTypeQuery(raw: unknown) {
  return parseEntityTypeFilter(raw)
}

function handleInPersonError(error: unknown, res: Response, context: string) {
  if (error instanceof InPersonPlayError) {
    if (error.code === 'NO_CARDS' || error.code === 'ENTITY_NOT_FOUND') {
      return res.status(404).json({ error: error.message, code: error.code })
    }
    return res.status(400).json({ error: error.message, code: error.code })
  }
  logger.error(context, error)
  return res.status(500).json({ error: context })
}

/**
 * Public endpoints for in-person facilitator mode. Requires network; no Socket.IO.
 */
router.get('/cards/eligibility', async (req, res) => {
  try {
    const datasetId = parseDatasetId(req.query.datasetId)
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }
    const entityType = parseEntityTypeQuery(req.query.entityType)
    if (!entityType) {
      return res.status(400).json({ error: 'Invalid entity type' })
    }
    const eligibility = await getInPersonEligibility(datasetId, entityType)
    res.json(eligibility)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to fetch eligibility')
  }
})

router.get('/cards/deck', async (req, res) => {
  try {
    const datasetId = parseDatasetId(req.query.datasetId)
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }
    const difficultyMode = parseDifficultyQuery(req.query.difficulty)
    if (!difficultyMode) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }
    const entityType = parseEntityTypeQuery(req.query.entityType)
    if (!entityType) {
      return res.status(400).json({ error: 'Invalid entity type' })
    }
    const deck = await getInPersonDeck(datasetId, difficultyMode, entityType)
    res.json(deck)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to fetch deck')
  }
})

router.get('/cards/entity/:entityId', async (req, res) => {
  try {
    const datasetId = parseDatasetId(req.query.datasetId)
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }
    const difficultyMode = parseDifficultyQuery(req.query.difficulty)
    if (!difficultyMode) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }
    const entityId = typeof req.params.entityId === 'string' ? req.params.entityId.trim() : ''
    if (!entityId) {
      return res.status(400).json({ error: 'entityId is required' })
    }
    const card = await buildInPersonCardForEntity({
      datasetId,
      entityId,
      difficultyMode
    })
    res.json(card)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to fetch card')
  }
})

router.get('/cards/random', async (req, res) => {
  try {
    const datasetId = parseDatasetId(req.query.datasetId)
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }

    const difficultyMode = parseDifficultyQuery(req.query.difficulty)
    if (!difficultyMode) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }

    const excludeEntityId =
      typeof req.query.excludeEntityId === 'string' && req.query.excludeEntityId.trim() !== ''
        ? req.query.excludeEntityId.trim()
        : undefined

    const entityType = parseEntityTypeQuery(req.query.entityType)
    if (!entityType) {
      return res.status(400).json({ error: 'Invalid entity type' })
    }

    const card = await getRandomInPersonCard({
      datasetId,
      difficultyMode,
      entityType,
      excludeEntityId
    })

    res.json(card)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to fetch card')
  }
})

export default router
