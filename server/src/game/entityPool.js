import { getPublishedEntities } from '../db/entities.js'

/**
 * Get backfill order for a difficulty mode
 * @param {string} mode - Difficulty mode (easy, medium, hard, nightmare)
 * @returns {string[]} Array of difficulty tiers in backfill order
 */
function getBackfillOrder(mode) {
  const backfillMap = {
    easy: ['medium', 'hard', 'nightmare'],
    medium: ['hard', 'nightmare'],
    hard: ['medium', 'easy', 'nightmare'],
    nightmare: ['hard', 'medium', 'easy']
  }
  return backfillMap[mode] || []
}

/**
 * Filter entities by difficulty
 * @param {Array} entities - Array of entity objects
 * @param {string} difficulty - Difficulty level to filter by
 * @returns {Array} Filtered entities
 */
function filterByDifficulty(entities, difficulty) {
  return entities.filter(e => e.difficulty === difficulty)
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffle(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Build entity pool for a game session
 * @param {string} mode - Difficulty mode (easy, medium, hard, nightmare)
 * @param {number} totalRounds - Total number of rounds needed
 * @returns {Promise<Array>} Shuffled array of entities for the session
 */
export async function buildEntityPool(mode, totalRounds) {
  // Fetch all published entities
  const allEntities = await getPublishedEntities()

  // Get primary pool based on mode
  let primary = []
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

  // Shuffle primary pool
  let pool = shuffle(primary)

  // If we don't have enough, backfill from adjacent tiers
  if (pool.length < totalRounds) {
    const backfillOrder = getBackfillOrder(mode)

    for (const tier of backfillOrder) {
      if (pool.length >= totalRounds) break

      const tierEntities = filterByDifficulty(allEntities, tier)
      const shuffledTier = shuffle(tierEntities)
      pool = [...pool, ...shuffledTier]
    }
  }

  // Return only what we need, shuffled again to mix backfilled items
  return shuffle(pool).slice(0, totalRounds)
}
