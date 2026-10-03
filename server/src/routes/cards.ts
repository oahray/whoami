import { Router, type Response } from 'express'
import { parseEntityTypeFilter } from '../game/entityTypeFilter.js'
import { parseDifficultySelection } from '../game/difficultySelection.js'
import {
  buildInPersonCardForEntity,
  dailyCardSeed,
  getInPersonDeck,
  getInPersonEligibility,
  getRandomInPersonCard,
  resolvePublishedEntities,
  InPersonPlayError,
  type ResolveEntityRequest
} from '../game/inPersonPlay.js'
import {
  DAILY_CHALLENGE_VERSION,
  getDailyCardFromChallenge,
  getDailyChallenge
} from '../game/dailyChallenge.js'
import { getMaintenanceBlock } from '../db/maintenance.js'
import {
  DEFAULT_KNOWLEDGE_SCORE_RULES,
  KNOWLEDGE_SCORE_VERSION
} from '../game/scoring.js'
import { logger } from '../utils/logger.js'

export { DAILY_CHALLENGE_VERSION }

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

function parseOptionalTrimmed(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.trim()
  return value.length > 0 ? value : undefined
}

function handleInPersonError(error: unknown, res: Response, context: string) {
  if (error instanceof InPersonPlayError) {
    if (error.code === 'NO_CARDS' || error.code === 'ENTITY_NOT_FOUND') {
      return res.status(404).json({ error: error.message, code: error.code })
    }
    return res.status(400).json({ error: error.message, code: error.code })
  }
  if (error instanceof Error) {
    if (error.message === 'No default dataset is available') {
      return res.status(404).json({ error: error.message })
    }
    if (error.message === 'No cards are available for today') {
      return res.status(404).json({ error: error.message })
    }
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
    const payload = await getDailyChallenge()
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

/**
 * Resolve a small set of entity ids (Review) without fetching the full published pool.
 * Body: { datasetId, entities: [{ id, name? }] }
 */
router.post('/cards/resolve', async (req, res) => {
  try {
    const maintenance = await getMaintenanceBlock()
    if (maintenance) {
      return res.status(503).json({
        error: maintenance.message,
        code: maintenance.code,
        maintenanceEndsAt: maintenance.endsAt
      })
    }

    const datasetId = parseDatasetId(req.body?.datasetId)
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' })
    }
    const rawEntities = req.body?.entities
    if (!Array.isArray(rawEntities)) {
      return res.status(400).json({ error: 'entities must be an array' })
    }
    const requests: ResolveEntityRequest[] = rawEntities.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return { id: '' }
      const record = entry as Record<string, unknown>
      return {
        id: typeof record.id === 'string' ? record.id : '',
        ...(typeof record.name === 'string' ? { name: record.name } : {})
      }
    })

    const entities = await resolvePublishedEntities(datasetId, requests)
    res.json({
      entities,
      entityIds: entities.map((entity) => entity.id),
      scoringVersion: KNOWLEDGE_SCORE_VERSION,
      scoringRules: DEFAULT_KNOWLEDGE_SCORE_RULES
    })
  } catch (error) {
    return handleInPersonError(error, res, 'Failed to resolve entities')
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
    const dailyChallengeId = parseOptionalTrimmed(req.query.dailyChallengeId)
    if (dailyChallengeId) {
      const frozen = await getDailyCardFromChallenge(dailyChallengeId, entityId)
      if (frozen) {
        return res.json(frozen)
      }
    }
    const card = await buildInPersonCardForEntity({
      datasetId,
      entityId,
      difficultySelection,
      ...(dailyChallengeId ? { seed: dailyCardSeed(dailyChallengeId, entityId) } : {})
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
    return handleInPersonError(error, res, 'Failed to fetch random card')
  }
})

export default router
