import { Router, type Response } from 'express'
import { parseEntityTypeFilter } from '../game/entityTypeFilter.js'
import { parseDifficultySelection } from '../game/difficultySelection.js'
import {
  buildInPersonCardForEntity,
  getInPersonDeck,
  getInPersonEligibility,
  getRandomInPersonCard,
  InPersonPlayError
} from '../game/inPersonPlay.js'
import { getMaintenanceBlock } from '../db/maintenance.js'
import { logger } from '../utils/logger.js'

const router = Router()

function parseDatasetId(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseDifficultyQuery(raw: unknown) {
  return parseDifficultySelection(raw)
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
    const difficultySelection = parseDifficultyQuery(req.query.difficulty)
    if (difficultySelection === null) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }
    const eligibility = await getInPersonEligibility(datasetId, entityType, difficultySelection)
    res.json(eligibility)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to fetch eligibility')
  }
})

router.get('/cards/deck', async (req, res) => {
  try {
    const maintenance = await getMaintenanceBlock()
    if (maintenance) {
      return res.status(503).json({
        error: maintenance.message,
        code: maintenance.code,
        maintenanceEndsAt: maintenance.endsAt
      })
    }

    const datasetId = parseDatasetId(req.query.datasetId)
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }
    const difficultySelection = parseDifficultyQuery(req.query.difficulty)
    if (difficultySelection === null) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }
    const entityType = parseEntityTypeQuery(req.query.entityType)
    if (!entityType) {
      return res.status(400).json({ error: 'Invalid entity type' })
    }
    const deck = await getInPersonDeck(datasetId, difficultySelection, entityType)
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
    const difficultySelection = parseDifficultyQuery(req.query.difficulty)
    if (difficultySelection === null) {
      return res.status(400).json({ error: 'Invalid difficulty' })
    }
    const entityId = typeof req.params.entityId === 'string' ? req.params.entityId.trim() : ''
    if (!entityId) {
      return res.status(400).json({ error: 'entityId is required' })
    }
    const card = await buildInPersonCardForEntity({
      datasetId,
      entityId,
      difficultySelection
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

    const difficultySelection = parseDifficultyQuery(req.query.difficulty)
    if (difficultySelection === null) {
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
      difficultySelection,
      entityType,
      excludeEntityId
    })

    res.json(card)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to fetch card')
  }
})

export default router
