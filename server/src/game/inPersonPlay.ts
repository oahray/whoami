import { getCluesForEntity, getDataset, type GameDifficultyMode, type Entity } from '../db/entities.js'
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

export class InPersonPlayError extends Error {
  constructor(
    public readonly code: 'INVALID_DATASET' | 'DATASET_DISABLED' | 'INVALID_DIFFICULTY' | 'NO_CARDS',
    message: string
  ) {
    super(message)
    this.name = 'InPersonPlayError'
  }
}

async function countCluesForEntities(
  entityIds: string[],
  mode: GameDifficultyMode
): Promise<Map<string, number>> {
  if (entityIds.length === 0) return new Map()

  const { data: clueRows, error } = await supabase
    .from('clues')
    .select('entity_id, difficulty')
    .in('entity_id', entityIds)

  if (error) {
    throw new Error(`Failed to fetch clues for in-person pool: ${error.message}`)
  }

  const countByEntity = new Map<string, number>()
  for (const row of clueRows ?? []) {
    if (mode !== 'any' && row.difficulty !== mode) continue
    countByEntity.set(row.entity_id, (countByEntity.get(row.entity_id) ?? 0) + 1)
  }
  return countByEntity
}

async function getEligibleEntities(
  datasetId: string,
  mode: GameDifficultyMode,
  excludeEntityId?: string
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

  const entities = (data ?? []).filter((e) => e.id !== excludeEntityId)
  if (entities.length === 0) return []

  const counts = await countCluesForEntities(
    entities.map((e) => e.id),
    mode
  )

  return entities.filter((e) => (counts.get(e.id) ?? 0) >= IN_PERSON_CLUES_MIN)
}

export async function getRandomInPersonCard(params: {
  datasetId: string
  difficultyMode: GameDifficultyMode
  excludeEntityId?: string
}): Promise<InPersonCardPayload> {
  const { datasetId, difficultyMode, excludeEntityId } = params

  const dataset = await getDataset(datasetId)
  if (!dataset) {
    throw new InPersonPlayError('INVALID_DATASET', 'Dataset not found')
  }
  if (!dataset.is_enabled) {
    throw new InPersonPlayError('DATASET_DISABLED', 'Selected dataset is disabled')
  }

  const eligible = await getEligibleEntities(datasetId, difficultyMode, excludeEntityId)
  if (eligible.length === 0) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'No published characters with enough clues for this dataset and difficulty'
    )
  }

  const entity = eligible[Math.floor(Math.random() * eligible.length)]
  const clues = await getCluesForEntity(entity.id, { difficultyMode })
  if (clues.length < IN_PERSON_CLUES_MIN) {
    throw new InPersonPlayError(
      'NO_CARDS',
      'No published characters with enough clues for this dataset and difficulty'
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
