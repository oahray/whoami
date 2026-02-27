/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Validate a guess against the correct answer
 * @param {string} input - Player's guess input
 * @param {string} answer - Correct answer
 * @param {boolean} strictMode - Whether strict mode is enabled (exact match required)
 * @returns {boolean} True if guess is correct
 */
export function validateGuess(input, answer, strictMode = false) {
  if (!input || !answer) return false

  if (strictMode) {
    // Exact match (case-insensitive, normalized)
    return normalizeString(input) === normalizeString(answer)
  } else {
    // Case-insensitive, normalized comparison
    return normalizeString(input) === normalizeString(answer)
  }
}
