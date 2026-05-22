import {
  getCluesForEntity,
  getDataset,
  GAME_DIFFICULTY_MODES,
  type GameDifficultyMode,
  type Entity
} from '../db/entities.js'
import { supabase } from '../db/supabase.js'
import { IN_PERSON_CLUES_MIN, IN_PERSON_CLUES_MAX } from './config.js'
import { shuffle } from './shuffle.js'

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
  const dataset = await getDataset(datasetId)
  if (!dataset) {
    throw new InPersonPlayError('INVALID_DATASET', 'Dataset not found')
  }
  if (!dataset.is_enabled) {
    throw new InPersonPlayError('DATASET_DISABLED', 'Selected dataset is disabled')
  }
  return dataset
}

async function fetchPublishedEntities(datasetId: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('is_published', true)
    .eq('dataset_id', datasetId)
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`)
  }
  return data ?? []
}

type EntityClueCounts = Record<GameDifficultyMode, number>

function emptyClueCounts(): EntityClueCounts {
  return { any: 0, easy: 0, medium: 0, hard: 0, nightmare: 0 }
}

async function fetchClueCountsByEntity(
  entityIds: string[]
): Promise<Map<string, EntityClueCounts>> {
  const countsByEntity = new Map<string, EntityClueCounts>()
  if (entityIds.length === 0) return countsByEntity

  for (const id of entityIds) {
    countsByEntity.set(id, emptyClueCounts())
  }

  const { data: clueRows, error } = await supabase
    .from('clues')
    .select('entity_id, difficulty')
    .in('entity_id', entityIds)

  if (error) {
    throw new Error(`Failed to fetch clues for in-person pool: ${error.message}`)
  }

  for (const row of clueRows ?? []) {
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

function isEligibleForMode(counts: EntityClueCounts, mode: GameDifficultyMode): boolean {
  return counts[mode] >= IN_PERSON_CLUES_MIN
}

function countEligibleModes(countsByEntity: Map<string, EntityClueCounts>): InPersonEligibility {
  const modes = emptyClueCounts()
  for (const counts of countsByEntity.values()) {
    for (const mode of GAME_DIFFICULTY_MODES) {
      if (isEligibleForMode(counts, mode)) {
        modes[mode] += 1
      }
    }
  }
  return { modes }
}

export async function getInPersonEligibility(datasetId: string): Promise<InPersonEligibility> {
  await assertPlayableDataset(datasetId)
  const entities = await fetchPublishedEntities(datasetId)
  const countsByEntity = await fetchClueCountsByEntity(entities.map((e) => e.id))
  return countEligibleModes(countsByEntity)
}

export async function getEligibleEntityIds(
  datasetId: string,
  mode: GameDifficultyMode
): Promise<string[]> {
  await assertPlayableDataset(datasetId)
  const entities = await fetchPublishedEntities(datasetId)
  const countsByEntity = await fetchClueCountsByEntity(entities.map((e) => e.id))
  return entities
    .filter((e) => {
      const counts = countsByEntity.get(e.id)
      return counts ? isEligibleForMode(counts, mode) : false
    })
    .map((e) => e.id)
}

export async function getInPersonDeck(
  datasetId: string,
  difficultyMode: GameDifficultyMode
): Promise<{ entityIds: string[] }> {
  const entityIds = await getEligibleEntityIds(datasetId, difficultyMode)
  if (entityIds.length === 0) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'No published characters with enough clues for this dataset and difficulty'
    )
  }
  return { entityIds: shuffle(entityIds) }
}

export async function buildInPersonCardForEntity(params: {
  datasetId: string
  entityId: string
  difficultyMode: GameDifficultyMode
}): Promise<InPersonCardPayload> {
  const { datasetId, entityId, difficultyMode } = params
  await assertPlayableDataset(datasetId)

  const { data: entity, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', entityId)
    .eq('dataset_id', datasetId)
    .eq('is_published', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch entity: ${error.message}`)
  }
  if (!entity) {
    throw new InPersonPlayError('ENTITY_NOT_FOUND', 'Character not found in this content pack')
  }

  const clues = await getCluesForEntity(entityId, { difficultyMode })
  if (clues.length < IN_PERSON_CLUES_MIN) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'This character does not have enough clues for the selected difficulty'
    )
  }

  const shuffled = shuffle(clues).slice(0, IN_PERSON_CLUES_MAX)

  return {
    entity: {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases ?? []
    },
    clues: shuffled.map((c, index) => ({
      order: index + 1,
      text: c.text,
      citations: c.citations
    }))
  }
}

export async function getRandomInPersonCard(params: {
  datasetId: string
  difficultyMode: GameDifficultyMode
  excludeEntityId?: string
}): Promise<InPersonCardPayload> {
  const { datasetId, difficultyMode, excludeEntityId } = params

  let entityIds = await getEligibleEntityIds(datasetId, difficultyMode)
  if (excludeEntityId) {
    entityIds = entityIds.filter((id) => id !== excludeEntityId)
  }
  if (entityIds.length === 0) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'No published characters with enough clues for this dataset and difficulty'
    )
  }

  const entityId = entityIds[Math.floor(Math.random() * entityIds.length)]
  return buildInPersonCardForEntity({ datasetId, entityId, difficultyMode })
}
