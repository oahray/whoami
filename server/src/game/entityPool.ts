import { getPublishedEntitiesForGamePool } from '../db/entities.js'
import type { Entity } from '../db/entities.js'
import type { DifficultySelection } from './difficultySelection.js'
import { parseDifficultySelection } from './difficultySelection.js'
import type { EntityTypeFilter } from './entityTypeFilter.js'

export async function buildEntityPool(
  difficultySelection: DifficultySelection | string,
  totalRounds: number,
  datasetId: string,
  entityType: EntityTypeFilter = 'character'
): Promise<Entity[]> {
  const selection =
    typeof difficultySelection === 'string'
      ? parseDifficultySelection(difficultySelection) ?? []
      : difficultySelection
  return getPublishedEntitiesForGamePool(selection, totalRounds, datasetId, entityType)
}
