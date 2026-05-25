import { getPublishedEntitiesForGamePool } from '../db/entities.js'
import type { GameDifficultyMode, Entity } from '../db/entities.js'
import type { EntityTypeFilter } from './entityTypeFilter.js'

type DifficultyMode = GameDifficultyMode

export async function buildEntityPool(
  mode: DifficultyMode,
  totalRounds: number,
  datasetId: string,
  entityType: EntityTypeFilter = 'character'
): Promise<Entity[]> {
  return getPublishedEntitiesForGamePool(mode, totalRounds, datasetId, entityType)
}
