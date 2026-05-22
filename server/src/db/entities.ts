import { supabase } from './supabase.js'
import { shuffle } from '../game/shuffle.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

export type GameDifficultyMode = 'any' | Difficulty

export const GAME_DIFFICULTY_MODES: readonly GameDifficultyMode[] = [
  'any',
  'easy',
  'medium',
  'hard',
  'nightmare'
]

const DIFFICULTY_MODES: GameDifficultyMode[] = [...GAME_DIFFICULTY_MODES]

export function parseDifficultyMode(raw: unknown): GameDifficultyMode | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase() as GameDifficultyMode
  return DIFFICULTY_MODES.includes(value) ? value : null
}

export interface Entity {
  id: string
  name: string
  type: 'character' | 'place'
  is_published: boolean
  /**
   * Dataset that owns this entity. Required at the DB level (NOT NULL); kept
   * optional here while we plumb dataset scoping through every code path.
   */
  dataset_id?: string
  /** Optional alternate names accepted during guess matching. */
  aliases?: string[]
  created_at?: string
  updated_at?: string
}

export interface Dataset {
  id: string
  name: string
  source: string | null
  description: string | null
  is_official: boolean
  is_enabled: boolean
  is_default: boolean
  created_at?: string
  updated_at?: string
}

export interface Clue {
  id: string
  entity_id: string
  text: string
  citations: string | null
  difficulty: Difficulty | null
  created_at?: string
  updated_at?: string
}

export async function getPublishedEntities(): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('is_published', true)
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`)
  }

  return data || []
}

/**
 * Published entities that have at least two clues for the given mode, scoped
 * to a single dataset. (For `any`, all clues count; for a specific tier, only
 * clues with that difficulty count.)
 */
export async function getPublishedEntitiesForGamePool(
  mode: GameDifficultyMode,
  maxEntities: number,
  datasetId: string
): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('is_published', true)
    .eq('dataset_id', datasetId)
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`)
  }

  const datasetEntities = data ?? []
  if (datasetEntities.length === 0) {
    return []
  }

  const datasetEntityIds = datasetEntities.map((e) => e.id)

  const { data: clueRows, error: cluesError } = await supabase
    .from('clues')
    .select('entity_id, difficulty')
    .in('entity_id', datasetEntityIds)

  if (cluesError) {
    throw new Error(`Failed to fetch clues for pool: ${cluesError.message}`)
  }

  const countByEntity = new Map<string, number>()
  for (const row of clueRows ?? []) {
    if (mode !== 'any') {
      if (row.difficulty !== mode) continue
    }
    countByEntity.set(row.entity_id, (countByEntity.get(row.entity_id) ?? 0) + 1)
  }

  const eligibleIds = new Set<string>()
  for (const [entityId, count] of countByEntity) {
    if (count >= 2) eligibleIds.add(entityId)
  }

  const filtered = datasetEntities.filter((e) => eligibleIds.has(e.id))
  return shuffle(filtered).slice(0, maxEntities)
}

/**
 * List all datasets, ordered by name. Includes both enabled and disabled datasets;
 * callers filter as needed.
 */
export async function listDatasets(): Promise<Dataset[]> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch datasets: ${error.message}`)
  }

  return (data ?? []) as Dataset[]
}

export async function getDataset(id: string): Promise<Dataset | null> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch dataset ${id}: ${error.message}`)
  }

  return (data as Dataset) ?? null
}

/** Returns the dataset flagged as default, or any enabled dataset, else null. */
export async function getDefaultEnabledDataset(): Promise<Dataset | null> {
  const { data: defaultRow } = await supabase
    .from('datasets')
    .select('*')
    .eq('is_default', true)
    .eq('is_enabled', true)
    .maybeSingle()

  if (defaultRow) return defaultRow as Dataset

  const { data: enabledRow } = await supabase
    .from('datasets')
    .select('*')
    .eq('is_enabled', true)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (enabledRow as Dataset) ?? null
}

export async function countEnabledDatasets(): Promise<number> {
  const { count, error } = await supabase
    .from('datasets')
    .select('*', { count: 'exact', head: true })
    .eq('is_enabled', true)

  if (error) {
    throw new Error(`Failed to count enabled datasets: ${error.message}`)
  }

  return count ?? 0
}

export interface DatasetCreateInput {
  name: string
  source?: string | null
  description?: string | null
  is_official?: boolean
  is_enabled?: boolean
  is_default?: boolean
}

export async function createDataset(input: DatasetCreateInput): Promise<Dataset> {
  const payload = {
    name: input.name,
    source: input.source ?? null,
    description: input.description ?? null,
    is_official: input.is_official ?? false,
    is_enabled: input.is_enabled ?? true,
    is_default: input.is_default ?? false
  }

  const { data, error } = await supabase
    .from('datasets')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to create dataset: ${error.message}`)
  }

  return data as Dataset
}

export interface DatasetUpdateInput {
  name?: string
  source?: string | null
  description?: string | null
  is_official?: boolean
  is_enabled?: boolean
  is_default?: boolean
}

/**
 * Update dataset flags / metadata with two invariants enforced in app code:
 *   1. At least one dataset must remain enabled — disabling the last enabled
 *      dataset is rejected.
 *   2. At most one dataset may be `is_default` — setting `is_default = true`
 *      clears the flag on every other dataset in the same transaction.
 */
export async function updateDatasetFlags(
  id: string,
  patch: DatasetUpdateInput
): Promise<Dataset> {
  const current = await getDataset(id)
  if (!current) {
    throw new DatasetUpdateError('NOT_FOUND', `Dataset ${id} not found`)
  }

  if (patch.is_enabled === false && current.is_enabled) {
    const enabled = await countEnabledDatasets()
    if (enabled <= 1) {
      throw new DatasetUpdateError(
        'CANNOT_DISABLE_LAST_ENABLED',
        'Cannot disable the last enabled dataset'
      )
    }
  }

  if (patch.is_default === true) {
    const { error: clearError } = await supabase
      .from('datasets')
      .update({ is_default: false })
      .neq('id', id)
      .eq('is_default', true)

    if (clearError) {
      throw new Error(`Failed to clear other default datasets: ${clearError.message}`)
    }
  }

  const updateRow: Record<string, unknown> = {}
  if (patch.name !== undefined) updateRow.name = patch.name
  if (patch.source !== undefined) updateRow.source = patch.source
  if (patch.description !== undefined) updateRow.description = patch.description
  if (patch.is_official !== undefined) updateRow.is_official = patch.is_official
  if (patch.is_enabled !== undefined) updateRow.is_enabled = patch.is_enabled
  if (patch.is_default !== undefined) updateRow.is_default = patch.is_default

  if (Object.keys(updateRow).length === 0) {
    return current
  }

  const { data, error } = await supabase
    .from('datasets')
    .update(updateRow)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update dataset ${id}: ${error.message}`)
  }

  return data as Dataset
}

export class DatasetUpdateError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CANNOT_DISABLE_LAST_ENABLED', message: string) {
    super(message)
    this.name = 'DatasetUpdateError'
  }
}

/**
 * Resolve a dataset id from an admin request: prefers an explicit `?datasetId=`
 * query (or `datasetId` in body), and falls back to the default enabled dataset
 * for backwards compatibility while the admin UI is migrating to dataset-aware
 * URLs. Returns null if no dataset can be resolved (e.g. fresh install before
 * `db:create-default-dataset` has been run).
 */
export async function resolveDatasetIdFromRequest(
  raw: unknown
): Promise<string | null> {
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim()
  }

  const fallback = await getDefaultEnabledDataset()
  return fallback?.id ?? null
}

export async function getCluesForEntity(
  entityId: string,
  options?: { difficultyMode?: GameDifficultyMode }
): Promise<Clue[]> {
  let query = supabase.from('clues').select('*').eq('entity_id', entityId)

  const mode = options?.difficultyMode ?? 'any'
  if (mode !== 'any') {
    query = query.eq('difficulty', mode)
  }

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch clues: ${error.message}`)
  }

  return data || []
}
