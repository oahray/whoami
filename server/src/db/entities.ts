import { supabase } from './supabase.js'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'

export interface Entity {
  id: string
  name: string
  type: 'character' | 'place'
  difficulty: Difficulty
  is_published: boolean
  created_at?: string
  updated_at?: string
}

export interface Clue {
  id: string
  entity_id: string
  order: number
  text: string
  citations: string | null
  difficulty: Difficulty | null
  created_at?: string
  updated_at?: string
}

export async function getPublishedEntities(difficulties: Difficulty[] = []): Promise<Entity[]> {
  let query = supabase
    .from('entities')
    .select('*')
    .eq('is_published', true)

  if (difficulties.length > 0) {
    query = query.in('difficulty', difficulties)
  }

  const { data, error } = await query.order('name')

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`)
  }

  return data || []
}

export async function getCluesForEntity(entityId: string): Promise<Clue[]> {
  const { data, error } = await supabase
    .from('clues')
    .select('*')
    .eq('entity_id', entityId)
    .order('order', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch clues: ${error.message}`)
  }

  return data || []
}
