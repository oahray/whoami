function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

function normalizeStringLenient(str: string): string {
  let normalized = str
    .toLowerCase()
    .trim()
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = normalized.split(/\s+/)
  const filteredWords = words.filter(word => !['the', 'a', 'an'].includes(word))

  return filteredWords.join(' ')
}

function matchesAnswer(input: string, answer: string, strictMode: boolean): boolean {
  if (!input || !answer) return false

  if (strictMode) {
    return normalizeString(input) === normalizeString(answer)
  }
  return normalizeStringLenient(input) === normalizeStringLenient(answer)
}

/**
 * Validate a guess against the canonical entity name and any aliases.
 * Aliases are matched with the same normalization rules as the canonical
 * answer (case-insensitive in both modes; lenient mode also strips quotes,
 * hyphens, and "the/a/an").
 */
export function validateGuess(
  input: string,
  answer: string,
  strictMode = false,
  aliases: string[] = []
): boolean {
  if (!input) return false
  if (matchesAnswer(input, answer, strictMode)) return true

  for (const alias of aliases) {
    if (typeof alias === 'string' && alias.trim() !== '' && matchesAnswer(input, alias, strictMode)) {
      return true
    }
  }
  return false
}
