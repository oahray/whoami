import { getPublishedEntities } from '../db/entities.js'

type DifficultyMode = 'easy' | 'medium' | 'hard' | 'nightmare' | 'any'

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function buildEntityPool(_mode: DifficultyMode, totalRounds: number): Promise<import('../db/entities.js').Entity[]> {
  const allEntities = await getPublishedEntities()
  return shuffle(allEntities).slice(0, totalRounds)
}
