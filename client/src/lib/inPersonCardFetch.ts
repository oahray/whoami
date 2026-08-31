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

type CardQuery = {
  datasetId: string
  difficulty: string
  entityType: EntityTypeFilter | string
}

const cache = new Map<string, InPersonCard>()
const inflight = new Map<string, Promise<InPersonCard>>()

export function cardCacheKey(datasetId: string, entityId: string): string {
  return `${datasetId}:${entityId}`
}

export function peekCachedCard(datasetId: string, entityId: string): InPersonCard | null {
  return cache.get(cardCacheKey(datasetId, entityId)) ?? null
}

export function rememberCard(datasetId: string, entityId: string, card: InPersonCard): void {
  cache.set(cardCacheKey(datasetId, entityId), card)
}

export function resetInPersonCardCacheForTests(): void {
  cache.clear()
  inflight.clear()
}

export async function getInPersonCard(entityId: string, query: CardQuery): Promise<InPersonCard> {
  const key = cardCacheKey(query.datasetId, entityId)
  const cached = cache.get(key)
  if (cached) return cached

  const pending = inflight.get(key)
  if (pending) return pending

  const request = (async () => {
    const params = new URLSearchParams({
      datasetId: query.datasetId,
      difficulty: query.difficulty,
      entityType: query.entityType
    })
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
    const card = body as InPersonCard
    cache.set(key, card)
    return card
  })()

  inflight.set(key, request)
  try {
    return await request
  } finally {
    inflight.delete(key)
  }
}

export function prefetchInPersonCard(entityId: string, query: CardQuery): void {
  void getInPersonCard(entityId, query).catch(() => {
    // Prefetch is best-effort; the next tap will surface a real error.
  })
}
