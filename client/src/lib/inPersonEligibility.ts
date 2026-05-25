import { API_BASE_URL } from './apiBase'
import { DEFAULT_ENTITY_TYPE_FILTER, type EntityTypeFilter } from './entityTypeFilter'
import type { GameDifficultyMode } from '../types'

export type InPersonEligibility = {
  modes: Record<GameDifficultyMode, number>
}

export const IN_PERSON_DIFFICULTY_OPTIONS: {
  value: GameDifficultyMode
  label: string
}[] = [
  { value: 'any', label: 'Any (mix of all difficulties)' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'nightmare', label: 'Nightmare' }
]

const CACHE_PREFIX = 'whoami-in-person-eligibility:'

function cacheKey(datasetId: string, entityType: EntityTypeFilter): string {
  return `${CACHE_PREFIX}${datasetId}:${entityType}`
}
const TTL_MS = 20 * 60 * 1000

type CachedEntry = {
  fetchedAt: number
  data: InPersonEligibility
}

export function getCachedEligibility(
  datasetId: string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): InPersonEligibility | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(datasetId, entityType))
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedEntry
    if (Date.now() - entry.fetchedAt > TTL_MS) {
      sessionStorage.removeItem(cacheKey(datasetId, entityType))
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function setCachedEligibility(
  datasetId: string,
  data: InPersonEligibility,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): void {
  try {
    const entry: CachedEntry = { fetchedAt: Date.now(), data }
    sessionStorage.setItem(cacheKey(datasetId, entityType), JSON.stringify(entry))
  } catch {
    // ignore quota / private mode
  }
}

export async function fetchInPersonEligibility(
  datasetId: string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER,
  options?: { useCache?: boolean }
): Promise<InPersonEligibility> {
  const useCache = options?.useCache !== false
  if (useCache) {
    const cached = getCachedEligibility(datasetId, entityType)
    if (cached) return cached
  }

  const res = await fetch(
    `${API_BASE_URL}/cards/eligibility?${new URLSearchParams({ datasetId, entityType })}`
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load eligibility (${res.status})`)
  }
  const data = (await res.json()) as InPersonEligibility
  setCachedEligibility(datasetId, data, entityType)
  return data
}

export function firstPlayableDifficulty(
  modes: InPersonEligibility['modes']
): GameDifficultyMode | null {
  for (const opt of IN_PERSON_DIFFICULTY_OPTIONS) {
    if ((modes[opt.value] ?? 0) > 0) return opt.value
  }
  return null
}

export function isDifficultyPlayable(
  modes: InPersonEligibility['modes'],
  mode: GameDifficultyMode
): boolean {
  return (modes[mode] ?? 0) > 0
}
