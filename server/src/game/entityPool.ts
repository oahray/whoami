import { getPublishedEntities } from '../db/entities.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

interface Entity {
  id: string
  name: string
  type: string
  difficulty: Difficulty
  is_published: boolean
}

function getBackfillOrder(mode: Difficulty): Difficulty[] {
  const backfillMap: Record<Difficulty, Difficulty[]> = {
    easy: ['medium', 'hard', 'nightmare'],
    medium: ['hard', 'nightmare'],
    hard: ['medium', 'easy', 'nightmare'],
    nightmare: ['hard', 'medium', 'easy']
  }
  return backfillMap[mode] || []
}

function filterByDifficulty(entities: Entity[], difficulty: Difficulty): Entity[] {
  return entities.filter(e => e.difficulty === difficulty)
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function buildEntityPool(mode: Difficulty, totalRounds: number): Promise<Entity[]> {
  const allEntities = await getPublishedEntities()

  let primary: Entity[] = []
  if (mode === 'easy') {
    primary = filterByDifficulty(allEntities, 'easy')
  } else if (mode === 'medium') {
    primary = [
      ...filterByDifficulty(allEntities, 'easy'),
      ...filterByDifficulty(allEntities, 'medium')
    ]
  } else if (mode === 'hard') {
    primary = filterByDifficulty(allEntities, 'hard')
  } else if (mode === 'nightmare') {
    primary = filterByDifficulty(allEntities, 'nightmare')
  }

  let pool = shuffle(primary)

  if (pool.length < totalRounds) {
    const backfillOrder = getBackfillOrder(mode)

    for (const tier of backfillOrder) {
      if (pool.length >= totalRounds) break

      const tierEntities = filterByDifficulty(allEntities, tier)
      const shuffledTier = shuffle(tierEntities)
      pool = [...pool, ...shuffledTier]
    }
  }

  return shuffle(pool).slice(0, totalRounds)
}
