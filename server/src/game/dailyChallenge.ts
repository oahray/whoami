import { getDefaultEnabledDataset } from '../db/entities.js'
import { getRedis, isRedisConfigured } from '../redis/client.js'
import {
  DEFAULT_KNOWLEDGE_SCORE_RULES,
  KNOWLEDGE_SCORE_VERSION
} from './scoring.js'
import {
  buildInPersonCardForEntity,
  dailyCardSeed,
  getEligibleEntityIds,
  type InPersonCardPayload
} from './inPersonPlay.js'
import { pickSeededSample } from './shuffle.js'
import { logger } from '../utils/logger.js'

export const DAILY_CHALLENGE_VERSION = 1
export const DAILY_CHALLENGE_ROUNDS = 10

/** Keep snapshots past UTC midnight so late players / timezone edges still match. */
const DAILY_REDIS_TTL_SECONDS = 60 * 60 * 48

export type DailyChallengePayload = {
  challengeId: string
  challengeVersion: number
  dateKey: string
  datasetId: string
  datasetName: string
  difficulty: 'any'
  entityType: 'all'
  roundDurationMs: number
  clueRevealIntervalMs: number
  entityIds: string[]
  /** Frozen cards for this challenge — every device must see these clues. */
  cards: Record<string, InPersonCardPayload>
  scoringVersion: number
  scoringRules: typeof DEFAULT_KNOWLEDGE_SCORE_RULES
}

let memoryCache: { cacheKey: string; payload: DailyChallengePayload } | null = null

export function dailyDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function dailyRedisKey(challengeId: string): string {
  return `whoami:daily-challenge:${challengeId}`
}

function isValidPayload(value: unknown): value is DailyChallengePayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<DailyChallengePayload>
  return (
    typeof payload.challengeId === 'string' &&
    Array.isArray(payload.entityIds) &&
    payload.entityIds.length > 0 &&
    !!payload.cards &&
    typeof payload.cards === 'object'
  )
}

/** Exported for tests. */
export function resetDailyChallengeCacheForTests(): void {
  memoryCache = null
}

async function readRedisPayload(challengeId: string): Promise<DailyChallengePayload | null> {
  if (!isRedisConfigured()) return null
  try {
    const redis = await getRedis()
    if (!redis) return null
    const raw = await redis.get(dailyRedisKey(challengeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isValidPayload(parsed) ? parsed : null
  } catch (error) {
    logger.error('Failed to read daily challenge from Redis', error)
    return null
  }
}

async function writeRedisPayload(payload: DailyChallengePayload): Promise<void> {
  if (!isRedisConfigured()) return
  try {
    const redis = await getRedis()
    if (!redis) return
    await redis.set(
      dailyRedisKey(payload.challengeId),
      JSON.stringify(payload),
      'EX',
      DAILY_REDIS_TTL_SECONDS
    )
  } catch (error) {
    // Daily must still work from memory / deterministic rebuild.
    logger.error('Failed to write daily challenge to Redis', error)
  }
}

async function buildDailyChallengePayload(dateKey: string): Promise<DailyChallengePayload> {
  const dataset = await getDefaultEnabledDataset()
  if (!dataset) {
    throw new Error('No default dataset is available')
  }

  const challengeId = `${dateKey}-v${DAILY_CHALLENGE_VERSION}`
  const eligibleIds = await getEligibleEntityIds(dataset.id, [], 'all')
  // Sort before sampling so rebuilds stay aligned when Redis is cold.
  const sortedEligible = [...eligibleIds].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0
  )
  const entityIds = pickSeededSample(sortedEligible, DAILY_CHALLENGE_ROUNDS, challengeId)
  if (entityIds.length === 0) {
    throw new Error('No cards are available for today')
  }

  const cards: Record<string, InPersonCardPayload> = {}
  for (const entityId of entityIds) {
    cards[entityId] = await buildInPersonCardForEntity({
      datasetId: dataset.id,
      entityId,
      difficultySelection: [],
      seed: dailyCardSeed(challengeId, entityId)
    })
  }

  return {
    challengeId,
    challengeVersion: DAILY_CHALLENGE_VERSION,
    dateKey,
    datasetId: dataset.id,
    datasetName: dataset.name,
    difficulty: 'any',
    entityType: 'all',
    roundDurationMs: 30_000,
    clueRevealIntervalMs: 5_000,
    entityIds,
    cards,
    scoringVersion: KNOWLEDGE_SCORE_VERSION,
    scoringRules: DEFAULT_KNOWLEDGE_SCORE_RULES
  }
}

/**
 * Today's fixed Daily challenge.
 * Prefer Redis (multi-instance), then process memory, then deterministic rebuild.
 */
export async function getDailyChallenge(now = new Date()): Promise<DailyChallengePayload> {
  const dateKey = dailyDateKey(now)
  const cacheKey = `${dateKey}-v${DAILY_CHALLENGE_VERSION}`

  if (memoryCache?.cacheKey === cacheKey) {
    return memoryCache.payload
  }

  const fromRedis = await readRedisPayload(cacheKey)
  if (fromRedis) {
    memoryCache = { cacheKey, payload: fromRedis }
    return fromRedis
  }

  const payload = await buildDailyChallengePayload(dateKey)
  memoryCache = { cacheKey, payload }
  await writeRedisPayload(payload)
  return payload
}

/** Prefer a frozen Daily card when the challenge snapshot is available. */
export async function getDailyCardFromChallenge(
  challengeId: string,
  entityId: string
): Promise<InPersonCardPayload | null> {
  if (memoryCache?.payload.challengeId === challengeId) {
    return memoryCache.payload.cards[entityId] ?? null
  }

  const fromRedis = await readRedisPayload(challengeId)
  if (fromRedis) {
    memoryCache = { cacheKey: challengeId, payload: fromRedis }
    return fromRedis.cards[entityId] ?? null
  }

  // Cold process / Redis down: rebuild today's challenge if the id matches.
  const todayId = `${dailyDateKey()}-v${DAILY_CHALLENGE_VERSION}`
  if (challengeId !== todayId) return null
  const payload = await getDailyChallenge()
  return payload.cards[entityId] ?? null
}
