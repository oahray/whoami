import { supabase } from './supabase.js'

/**
 * Get published entities filtered by difficulty
 * @param {string[]} difficulties - Array of difficulty levels to filter by
 * @returns {Promise<Array>} Array of published entities
 */
export async function getPublishedEntities(difficulties = []) {
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

/**
 * Get all clues for a specific entity, ordered by clue order
 * @param {string} entityId - UUID of the entity
 * @returns {Promise<Array>} Array of clues with citations
 */
export async function getCluesForEntity(entityId) {
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
