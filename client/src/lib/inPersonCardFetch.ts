import { API_BASE_URL } from './apiBase'
import type { EntityTypeFilter } from './entityTypeFilter'
import type { InPersonCard } from '../types'

export class CardFetchError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'CardFetchError'
    this.status = status
    this.code = code
  }
}

/** 404 after a purge, or 503 if the entity endpoint is gated. */
export function isLostCardError(error: unknown): boolean {
  return error instanceof CardFetchError && (error.status === 404 || error.status === 503)
}

export type CardQuery = {
  datasetId: string
  difficulty: string
  entityType: EntityTypeFilter | string
  /**
   * Daily only. When set, the server seeds clue selection and the client stores
   * the card in an isolated Daily cache (never shared with Classic/Endurance).
   */
  dailyChallengeId?: string
}

/**
 * Separate stores so Daily and Classic cannot share entries. The Classic store only
 * lives for one Solo run or one Pass & play game; see {@link startFreshCardRun}.
 */
const classicCache = new Map<string, InPersonCard>()
const classicInflight = new Map<string, Promise<InPersonCard>>()
const dailyCache = new Map<string, InPersonCard>()
const dailyInflight = new Map<string, Promise<InPersonCard>>()

function isDailyQuery(
  query: CardQuery
): query is CardQuery & { dailyChallengeId: string } {
  return typeof query.dailyChallengeId === 'string' && query.dailyChallengeId.length > 0
}

function classicCacheKey(query: CardQuery, entityId: string): string {
  return [query.datasetId, query.difficulty, query.entityType, entityId].join('|')
}

function dailyCacheKey(dailyChallengeId: string, entityId: string): string {
  return `${dailyChallengeId}:${entityId}`
}

export function peekCachedCard(query: CardQuery, entityId: string): InPersonCard | null {
  return classicCache.get(classicCacheKey(query, entityId)) ?? null
}

export function peekCachedDailyCard(
  dailyChallengeId: string,
  entityId: string
): InPersonCard | null {
  return dailyCache.get(dailyCacheKey(dailyChallengeId, entityId)) ?? null
}

export function rememberCard(query: CardQuery, entityId: string, card: InPersonCard): void {
  classicCache.set(classicCacheKey(query, entityId), card)
}

/**
 * Forget Classic, Endurance and Pass & play cards from earlier games, so a new game gets
 * freshly shuffled clues. Without this, an app left open replays the same clue order.
 */
export function startFreshCardRun(): void {
  classicCache.clear()
  classicInflight.clear()
}

export function rememberDailyCard(
  dailyChallengeId: string,
  entityId: string,
  card: InPersonCard
): void {
  dailyCache.set(dailyCacheKey(dailyChallengeId, entityId), card)
}

export function resetInPersonCardCacheForTests(): void {
  classicCache.clear()
  classicInflight.clear()
  dailyCache.clear()
  dailyInflight.clear()
}

export async function getInPersonCard(entityId: string, query: CardQuery): Promise<InPersonCard> {
  if (isDailyQuery(query)) {
    return getDailyCard(entityId, query)
  }
  return getClassicCard(entityId, query)
}

async function getClassicCard(entityId: string, query: CardQuery): Promise<InPersonCard> {
  const key = classicCacheKey(query, entityId)
  const cached = classicCache.get(key)
  if (cached) return cached

  const pending = classicInflight.get(key)
  if (pending) return pending

  const request = fetchCard(entityId, query).then((card) => {
    classicCache.set(key, card)
    return card
  })

  classicInflight.set(key, request)
  try {
    return await request
  } finally {
    classicInflight.delete(key)
  }
}

async function getDailyCard(
  entityId: string,
  query: CardQuery & { dailyChallengeId: string }
): Promise<InPersonCard> {
  const key = dailyCacheKey(query.dailyChallengeId, entityId)
  const cached = dailyCache.get(key)
  if (cached) return cached

  const pending = dailyInflight.get(key)
  if (pending) return pending

  const request = fetchCard(entityId, query).then((card) => {
    dailyCache.set(key, card)
    return card
  })

  dailyInflight.set(key, request)
  try {
    return await request
  } finally {
    dailyInflight.delete(key)
  }
}

async function fetchCard(entityId: string, query: CardQuery): Promise<InPersonCard> {
  const params = new URLSearchParams({
    datasetId: query.datasetId,
    difficulty: query.difficulty,
    entityType: query.entityType
  })
  if (isDailyQuery(query)) {
    params.set('dailyChallengeId', query.dailyChallengeId)
  }
  const response = await fetch(
    `${API_BASE_URL}/cards/entity/${encodeURIComponent(entityId)}?${params.toString()}`
  )
  const body = (await response.json().catch(() => ({}))) as {
    error?: string
    code?: string
  } & InPersonCard
  if (!response.ok) {
    throw new CardFetchError(
      body.error ?? `Failed to load card (${response.status})`,
      response.status,
      body.code
    )
  }
  return body as InPersonCard
}

export function prefetchInPersonCard(entityId: string, query: CardQuery): void {
  void getInPersonCard(entityId, query).catch(() => {
    // Prefetch is best-effort; the next tap will surface a real error.
  })
}
