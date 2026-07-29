import { API_BASE_URL } from './apiBase'
import {
  encodeDifficultySelection,
  type DifficultySelection
} from './difficultySelection'
import { DEFAULT_ENTITY_TYPE_FILTER, type EntityTypeFilter } from './entityTypeFilter'
import type { GameDifficultyMode } from '../types'

export type InPersonEligibility = {
  modes: Record<GameDifficultyMode, number>
  /** Entities playable for the requested difficulty selection. */
  selectedCount: number
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

function cacheKey(
  datasetId: string,
  entityType: EntityTypeFilter,
  difficulty: DifficultySelection
): string {
  return `${CACHE_PREFIX}${datasetId}:${entityType}:${encodeDifficultySelection(difficulty)}`
}
const TTL_MS = 20 * 60 * 1000

type CachedEntry = {
  fetchedAt: number
  data: InPersonEligibility
}

export function getCachedEligibility(
  datasetId: string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER,
  difficulty: DifficultySelection = []
): InPersonEligibility | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(datasetId, entityType, difficulty))
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedEntry
    if (Date.now() - entry.fetchedAt > TTL_MS) {
      sessionStorage.removeItem(cacheKey(datasetId, entityType, difficulty))
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
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER,
  difficulty: DifficultySelection = []
): void {
  try {
    const entry: CachedEntry = { fetchedAt: Date.now(), data }
    sessionStorage.setItem(cacheKey(datasetId, entityType, difficulty), JSON.stringify(entry))
  } catch {
    // ignore quota / private mode
  }
}

export async function fetchInPersonEligibility(
  datasetId: string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER,
  options?: { useCache?: boolean; difficulty?: DifficultySelection }
): Promise<InPersonEligibility> {
  const difficulty = options?.difficulty ?? []
  const useCache = options?.useCache !== false
  if (useCache) {
    const cached = getCachedEligibility(datasetId, entityType, difficulty)
    if (cached) return cached
  }

  const params = new URLSearchParams({
    datasetId,
    entityType,
    difficulty: encodeDifficultySelection(difficulty)
  })
  const res = await fetch(`${API_BASE_URL}/cards/eligibility?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load eligibility (${res.status})`)
  }
  const data = (await res.json()) as InPersonEligibility
  if (typeof data.selectedCount !== 'number') {
    data.selectedCount = data.modes?.any ?? 0
  }
  setCachedEligibility(datasetId, data, entityType, difficulty)
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

export function isDifficultySelectionPlayable(
  eligibility: InPersonEligibility | null,
  selection: DifficultySelection
): boolean {
  if (!eligibility) return false
  if (selection.length === 0) return (eligibility.modes.any ?? 0) > 0
  if (selection.length === 1) return (eligibility.modes[selection[0]] ?? 0) > 0
  return eligibility.selectedCount > 0
}
