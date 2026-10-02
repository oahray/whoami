import { Router, type Response } from 'express'
import { parseEntityTypeFilter } from '../game/entityTypeFilter.js'
import { parseDifficultySelection } from '../game/difficultySelection.js'
import {
  buildInPersonCardForEntity,
  getEligibleEntityIds,
  getInPersonDeck,
  getInPersonEligibility,
  getRandomInPersonCard,
  InPersonPlayError
} from '../game/inPersonPlay.js'
import { getMaintenanceBlock } from '../db/maintenance.js'
import { getDefaultEnabledDataset } from '../db/entities.js'
import {
  DEFAULT_KNOWLEDGE_SCORE_RULES,
  KNOWLEDGE_SCORE_VERSION
} from '../game/scoring.js'
import { pickSeededSample } from '../game/shuffle.js'
import { logger } from '../utils/logger.js'

const router = Router()
const DAILY_CHALLENGE_VERSION = 3
const DAILY_CHALLENGE_ROUNDS = 10
let dailyChallengeCache: {
  cacheKey: string
  payload: Record<string, unknown>
} | null = null

function parseDatasetId(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseDifficultyQuery(raw: unknown) {
  return parseDifficultySelection(raw)
}

function parseEntityTypeQuery(raw: unknown) {
  return parseEntityTypeFilter(raw)
}

function dailyDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
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

router.get('/cards/daily-challenge', async (_req, res) => {
  try {
    const dateKey = dailyDateKey()
    const cacheKey = `${dateKey}-v${DAILY_CHALLENGE_VERSION}`
    if (dailyChallengeCache?.cacheKey === cacheKey) {
      return res.json(dailyChallengeCache.payload)
    }
    const dataset = await getDefaultEnabledDataset()
    if (!dataset) {
      return res.status(404).json({ error: 'No default dataset is available' })
    }
    const challengeId = cacheKey
    const eligibleIds = await getEligibleEntityIds(dataset.id, [], 'all')
    const orderedIds = pickSeededSample(eligibleIds, DAILY_CHALLENGE_ROUNDS, challengeId)
    if (orderedIds.length === 0) {
      return res.status(404).json({ error: 'No cards are available for today' })
    }

    const payload = {
      challengeId,
      challengeVersion: DAILY_CHALLENGE_VERSION,
      dateKey,
      datasetId: dataset.id,
      datasetName: dataset.name,
      difficulty: 'any',
      entityType: 'all',
      roundDurationMs: 30_000,
      clueRevealIntervalMs: 5_000,
      entityIds: orderedIds,
      scoringVersion: KNOWLEDGE_SCORE_VERSION,
      scoringRules: DEFAULT_KNOWLEDGE_SCORE_RULES
    }
    dailyChallengeCache = { cacheKey, payload }
    return res.json(payload)
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to load daily challenge')
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
    res.json({
      ...deck,
      scoringVersion: KNOWLEDGE_SCORE_VERSION,
      scoringRules: DEFAULT_KNOWLEDGE_SCORE_RULES
    })
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
