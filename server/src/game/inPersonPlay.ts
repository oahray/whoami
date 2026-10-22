import {
  getCluesForEntity,
  listDatasets,
  GAME_DIFFICULTY_MODES,
  type GameDifficultyMode,
  type Entity
} from '../db/entities.js'
import { fetchAllPages } from '../db/fetchAllPages.js'
import { supabase } from '../db/supabase.js'
import { IN_PERSON_CLUES_MIN, IN_PERSON_CLUES_MAX } from './config.js'
import {
  countCluesForSelection,
  isAnyDifficultySelection,
  parseDifficultySelection,
  type DifficultySelection
} from './difficultySelection.js'
import {
  DEFAULT_ENTITY_TYPE_FILTER,
  entityMatchesTypeFilter,
  type EntityTypeFilter
} from './entityTypeFilter.js'
import { shuffle, seededShuffle } from './shuffle.js'
import { cachedContent } from './contentCache.js'

export type InPersonCardPayload = {
  entity: {
    id: string
    name: string
    type: 'character' | 'place'
    aliases: string[]
  }
  clues: Array<{ order: number; text: string; citations: string | null }>
}

export type InPersonEligibility = {
  modes: Record<GameDifficultyMode, number>
  /** Entities eligible for the requested difficulty selection (defaults to any). */
  selectedCount: number
  /** Published entities in the dataset, ignoring the requested card type. */
  types: { character: number; place: number }
}

function coerceSelection(
  value: DifficultySelection | GameDifficultyMode | undefined
): DifficultySelection {
  if (value == null) return []
  if (typeof value === 'string') return parseDifficultySelection(value) ?? []
  return value
}

/** Seed for Daily clue selection: challenge id + entity id (server-owned format). */
export function dailyCardSeed(challengeId: string, entityId: string): string {
  return `${challengeId}:${entityId}`
}

export class InPersonPlayError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_DATASET'
      | 'DATASET_DISABLED'
      | 'INVALID_DIFFICULTY'
      | 'NO_CARDS'
      | 'ENTITY_NOT_FOUND',
    message: string
  ) {
    super(message)
    this.name = 'InPersonPlayError'
  }
}

async function assertPlayableDataset(datasetId: string) {
  // The whole (small) datasets table is cached, so unknown ids never reach the database.
  const datasets = await cachedContent('datasets', listDatasets)
  const dataset = datasets.find((entry) => entry.id === datasetId) ?? null
  if (!dataset) {
    throw new InPersonPlayError('INVALID_DATASET', 'Dataset not found')
  }
  if (!dataset.is_enabled) {
    throw new InPersonPlayError('DATASET_DISABLED', 'Selected dataset is disabled')
  }
  return dataset
}

async function fetchPublishedEntities(
  datasetId: string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): Promise<Entity[]> {
  const all = await cachedContent(`published:${datasetId}`, () => loadPublishedEntities(datasetId))
  return all.filter((e) => entityMatchesTypeFilter(e.type, entityType))
}

async function loadPublishedEntities(datasetId: string): Promise<Entity[]> {
  try {
    const data = await fetchAllPages<Entity>((from, to) =>
      supabase
        .from('entities')
        .select('*')
        .eq('is_published', true)
        .eq('dataset_id', datasetId)
        .order('name')
        .order('id')
        .range(from, to)
    )
    return data
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Failed to fetch entities: ${message}`)
  }
}

type EntityClueCounts = Record<GameDifficultyMode, number>

function emptyClueCounts(): EntityClueCounts {
  return { any: 0, easy: 0, medium: 0, hard: 0, nightmare: 0 }
}

/** Clue counts for the given published entities, read from one cached map per dataset. */
async function clueCountsFor(
  datasetId: string,
  entityIds: string[]
): Promise<Map<string, EntityClueCounts>> {
  const all = await cachedContent(`clueCounts:${datasetId}`, async () =>
    fetchClueCountsByEntity((await fetchPublishedEntities(datasetId, 'all')).map((e) => e.id))
  )
  const subset = new Map<string, EntityClueCounts>()
  for (const id of entityIds) subset.set(id, all.get(id) ?? emptyClueCounts())
  return subset
}

async function fetchClueCountsByEntity(
  entityIds: string[]
): Promise<Map<string, EntityClueCounts>> {
  const countsByEntity = new Map<string, EntityClueCounts>()
  if (entityIds.length === 0) return countsByEntity

  for (const id of entityIds) {
    countsByEntity.set(id, emptyClueCounts())
  }

  let clueRows: Array<{ entity_id: string; difficulty: string | null }>
  try {
    clueRows = await fetchAllPages((from, to) =>
      supabase
        .from('clues')
        .select('entity_id, difficulty')
        .in('entity_id', entityIds)
        .order('id')
        .range(from, to)
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Failed to fetch clues for in-person pool: ${message}`)
  }

  for (const row of clueRows) {
    const counts = countsByEntity.get(row.entity_id)
    if (!counts) continue
    counts.any += 1
    const tier = row.difficulty as keyof EntityClueCounts
    if (tier !== 'any' && tier in counts) {
      counts[tier] += 1
    }
  }

  return countsByEntity
}

function isEligibleForSelection(counts: EntityClueCounts, selection: DifficultySelection): boolean {
  return countCluesForSelection(counts, selection) >= IN_PERSON_CLUES_MIN
}

function isEligibleForMode(counts: EntityClueCounts, mode: GameDifficultyMode): boolean {
  return isEligibleForSelection(counts, coerceSelection(mode))
}

function countEligibleModes(
  countsByEntity: Map<string, EntityClueCounts>,
  selection: DifficultySelection
): Omit<InPersonEligibility, 'types'> {
  const modes = emptyClueCounts()
  for (const counts of countsByEntity.values()) {
    for (const mode of GAME_DIFFICULTY_MODES) {
      if (isEligibleForMode(counts, mode)) {
        modes[mode] += 1
      }
    }
  }
  let selectedCount = 0
  for (const counts of countsByEntity.values()) {
    if (isEligibleForSelection(counts, selection)) selectedCount += 1
  }
  return { modes, selectedCount }
}

export async function getInPersonEligibility(
  datasetId: string,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER,
  difficultySelection: DifficultySelection | GameDifficultyMode = []
): Promise<InPersonEligibility> {
  await assertPlayableDataset(datasetId)
  const published = await fetchPublishedEntities(datasetId, 'all')
  const types = { character: 0, place: 0 }
  for (const entity of published) {
    if (entity.type === 'place') types.place += 1
    else if (entity.type === 'character') types.character += 1
  }
  const entities = published.filter((entity) => entityMatchesTypeFilter(entity.type, entityType))
  const countsByEntity = await clueCountsFor(datasetId, entities.map((e) => e.id))
  return { ...countEligibleModes(countsByEntity, coerceSelection(difficultySelection)), types }
}

export async function getEligibleEntities(
  datasetId: string,
  difficultySelection: DifficultySelection | GameDifficultyMode,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): Promise<Array<{ id: string; name: string }>> {
  await assertPlayableDataset(datasetId)
  const selection = coerceSelection(difficultySelection)
  const entities = await fetchPublishedEntities(datasetId, entityType)
  const countsByEntity = await clueCountsFor(datasetId, entities.map((e) => e.id))
  return entities
    .filter((e) => {
      const counts = countsByEntity.get(e.id)
      return counts ? isEligibleForSelection(counts, selection) : false
    })
    .map((e) => ({ id: e.id, name: e.name }))
}

export async function getEligibleEntityIds(
  datasetId: string,
  difficultySelection: DifficultySelection | GameDifficultyMode,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): Promise<string[]> {
  const entities = await getEligibleEntities(datasetId, difficultySelection, entityType)
  return entities.map((entity) => entity.id)
}

export async function getInPersonDeck(
  datasetId: string,
  difficultySelection: DifficultySelection | GameDifficultyMode,
  entityType: EntityTypeFilter = DEFAULT_ENTITY_TYPE_FILTER
): Promise<{ entityIds: string[]; entities: Array<{ id: string; name: string }> }> {
  const entities = await getEligibleEntities(datasetId, difficultySelection, entityType)
  if (entities.length === 0) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'No published entities with enough clues for this dataset, entity type, and difficulty'
    )
  }
  const shuffled = shuffle(entities)
  return {
    entityIds: shuffled.map((entity) => entity.id),
    entities: shuffled
  }
}

export type ResolveEntityRequest = {
  id: string
  name?: string
}

export type ResolvedEntity = {
  id: string
  name: string
  /** Client-provided id before remapping (may equal `id`). */
  previousId: string
}

const MAX_RESOLVE_ENTITIES = 50

function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Resolve a small set of client-known entity ids for Review.
 * Matches by id first, then by normalized name when ids changed after a reimport.
 * Only returns entities that still have enough clues for any-difficulty play.
 */
export async function resolvePublishedEntities(
  datasetId: string,
  requests: ResolveEntityRequest[]
): Promise<ResolvedEntity[]> {
  await assertPlayableDataset(datasetId)

  const seen = new Set<string>()
  const unique: Array<{ id: string; name?: string }> = []
  for (const request of requests) {
    const id = typeof request.id === 'string' ? request.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const name =
      typeof request.name === 'string' && request.name.trim().length > 0
        ? request.name.trim()
        : undefined
    unique.push(name ? { id, name } : { id })
    if (unique.length >= MAX_RESOLVE_ENTITIES) break
  }
  if (unique.length === 0) return []

  const published = await fetchPublishedEntities(datasetId, 'all')
  const requested = new Set(unique.map((entry) => entry.id))
  const byId = new Map(
    published.filter((entity) => requested.has(entity.id)).map((entity) => [entity.id, entity])
  )

  const unresolved = unique.filter((entry) => !byId.has(entry.id) && entry.name)
  const byName = new Map<string, { id: string; name: string }>()
  if (unresolved.length > 0) {
    for (const entity of published) {
      const normalized = normalizeEntityName(entity.name)
      if (normalized && !byName.has(normalized)) byName.set(normalized, entity)
    }
  }

  const candidates: Array<{ id: string; name: string; previousId: string }> = []
  const resolvedIds = new Set<string>()
  for (const entry of unique) {
    const direct = byId.get(entry.id)
    if (direct) {
      if (!resolvedIds.has(direct.id)) {
        resolvedIds.add(direct.id)
        candidates.push({ id: direct.id, name: direct.name, previousId: entry.id })
      }
      continue
    }
    if (!entry.name) continue
    const match = byName.get(normalizeEntityName(entry.name))
    if (!match || resolvedIds.has(match.id)) continue
    resolvedIds.add(match.id)
    candidates.push({ id: match.id, name: match.name, previousId: entry.id })
  }

  const countsByEntity = await clueCountsFor(datasetId, candidates.map((c) => c.id))
  return candidates.filter((candidate) => {
    const counts = countsByEntity.get(candidate.id) ?? emptyClueCounts()
    return isEligibleForSelection(counts, [])
  })
}

export async function buildInPersonCardForEntity(params: {
  datasetId: string
  entityId: string
  difficultySelection?: DifficultySelection | GameDifficultyMode
  /** @deprecated prefer difficultySelection */
  difficultyMode?: GameDifficultyMode
  /**
   * When set (Daily), clue selection/order is deterministic for this seed.
   * Classic / Endurance / in-person omit this and keep a random shuffle.
   */
  seed?: string
}): Promise<InPersonCardPayload> {
  const { datasetId, entityId, seed } = params
  const difficultySelection = coerceSelection(params.difficultySelection ?? params.difficultyMode)
  await assertPlayableDataset(datasetId)

  // Looked up in the cached published list, so made-up ids never reach the database.
  const entity = (await fetchPublishedEntities(datasetId, 'all')).find((e) => e.id === entityId)
  if (!entity) {
    throw new InPersonPlayError('ENTITY_NOT_FOUND', 'Character not found in this content pack')
  }

  const allClues = await cachedContent(`clues:${entityId}`, () => getCluesForEntity(entityId))
  // Same rule as the database filter it replaces: a specific selection drops unrated clues.
  const clues = isAnyDifficultySelection(difficultySelection)
    ? allClues
    : allClues.filter((clue) => clue.difficulty != null && difficultySelection.includes(clue.difficulty))
  if (clues.length < IN_PERSON_CLUES_MIN) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'This character does not have enough clues for the selected difficulty'
    )
  }

  const selected = selectCluesForCard(clues, seed)

  return {
    entity: {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases ?? []
    },
    clues: selected.map((c, index) => ({
      order: index + 1,
      text: c.text,
      citations: c.citations
    }))
  }
}

/** Pick up to IN_PERSON_CLUES_MAX clues; seeded path sorts by id first for stability. */
function selectCluesForCard<T extends { id: string }>(clues: T[], seed?: string): T[] {
  const limit = Math.min(IN_PERSON_CLUES_MAX, clues.length)
  if (seed) {
    const stable = [...clues].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return seededShuffle(stable, seed).slice(0, limit)
  }
  return shuffle(clues).slice(0, limit)
}

export async function getRandomInPersonCard(params: {
  datasetId: string
  difficultySelection?: DifficultySelection | GameDifficultyMode
  /** @deprecated prefer difficultySelection */
  difficultyMode?: GameDifficultyMode
  entityType?: EntityTypeFilter
  excludeEntityId?: string
}): Promise<InPersonCardPayload> {
  const {
    datasetId,
    excludeEntityId,
    entityType = DEFAULT_ENTITY_TYPE_FILTER
  } = params
  const difficultySelection = coerceSelection(params.difficultySelection ?? params.difficultyMode)
  let entityIds = await getEligibleEntityIds(datasetId, difficultySelection, entityType)
  if (excludeEntityId) {
    entityIds = entityIds.filter((id) => id !== excludeEntityId)
  }
  if (entityIds.length === 0) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'No published entities with enough clues for this dataset, entity type, and difficulty'
    )
  }

  const entityId = entityIds[Math.floor(Math.random() * entityIds.length)]
  return buildInPersonCardForEntity({ datasetId, entityId, difficultySelection })
}
