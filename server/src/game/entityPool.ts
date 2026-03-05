import { getPublishedEntities, getCluesForEntity } from '../db/entities.js'
import type { Entity as DbEntity } from '../db/entities.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'
type DifficultyMode = Difficulty | 'any'

interface EntityWithDifficulty {
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

function filterByDifficulty(entities: EntityWithDifficulty[], difficulty: Difficulty): EntityWithDifficulty[] {
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

async function getEntitiesWithEffectiveDifficulty(): Promise<EntityWithDifficulty[]> {
  const dbEntities: DbEntity[] = await getPublishedEntities()
  const result: EntityWithDifficulty[] = []

  const difficultyOrder: Difficulty[] = ['easy', 'medium', 'hard', 'nightmare']

  for (const entity of dbEntities) {
    const clues = await getCluesForEntity(entity.id)
    if (!clues || clues.length < 2) {
      continue
    }

    const clueDifficulties = clues
      .map(c => c.difficulty)
      .filter((d): d is Difficulty => !!d && difficultyOrder.includes(d as Difficulty))

    let effective: Difficulty = 'medium'
    if (clueDifficulties.length > 0) {
      const minIndex = Math.min(
        ...clueDifficulties
          .map(d => difficultyOrder.indexOf(d as Difficulty))
          .filter(idx => idx >= 0)
      )
      effective = difficultyOrder[minIndex] ?? 'medium'
    }

    result.push({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      difficulty: effective,
      is_published: entity.is_published
    })
  }

  return result
}

export async function buildEntityPool(mode: DifficultyMode, totalRounds: number): Promise<EntityWithDifficulty[]> {
  const allEntities = await getEntitiesWithEffectiveDifficulty()

  if (mode === 'any') {
    return shuffle(allEntities).slice(0, totalRounds)
  }

  let primary: EntityWithDifficulty[] = []
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
