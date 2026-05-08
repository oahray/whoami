import { getPublishedEntitiesForGamePool } from '../db/entities.js'
import type { GameDifficultyMode, Entity } from '../db/entities.js'

type DifficultyMode = GameDifficultyMode

export async function buildEntityPool(
  mode: DifficultyMode,
  totalRounds: number,
  datasetId: string
): Promise<Entity[]> {
  return getPublishedEntitiesForGamePool(mode, totalRounds, datasetId)
}
