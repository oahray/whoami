import { getPublishedEntitiesForGamePool } from '../db/entities.js'
import type { GameDifficultyMode } from '../db/entities.js'

type DifficultyMode = GameDifficultyMode

export async function buildEntityPool(mode: DifficultyMode, totalRounds: number): Promise<import('../db/entities.js').Entity[]> {
  return getPublishedEntitiesForGamePool(mode, totalRounds)
}
