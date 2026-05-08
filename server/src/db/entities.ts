import { supabase } from './supabase.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

export type GameDifficultyMode = 'any' | Difficulty

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export interface Entity {
  id: string
  name: string
  type: 'character' | 'place'
  is_published: boolean
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
 * Published entities that have at least two clues for the given mode
 * (for `any`, all clues count; for a specific tier, only clues with that difficulty count).
 */
export async function getPublishedEntitiesForGamePool(
  mode: GameDifficultyMode,
  maxEntities: number
): Promise<Entity[]> {
  const { data: clueRows, error: cluesError } = await supabase
    .from('clues')
    .select('entity_id, difficulty')

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

  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('is_published', true)
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`)
  }

  const filtered = (data ?? []).filter(e => eligibleIds.has(e.id))
  return shuffle(filtered).slice(0, maxEntities)
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
