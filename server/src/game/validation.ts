function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Drop clarifying qualifiers like `(Jesus' brother)`. */
function stripParentheticals(value: string): string {
  return value.replace(/\([^)]*\)/g, ' ')
}

function normalizeStringLenient(str: string): string {
  return stripParentheticals(str)
    .toLowerCase()
    .trim()
    .replace(/['\u2019\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !['the', 'a', 'an'].includes(word))
    .join(' ')
}

/** Same as lenient, but with spaces removed so `MaryMagdalene` matches `Mary-Magdalene`. */
function normalizeStringCompact(str: string): string {
  return normalizeStringLenient(str).replace(/\s+/g, '')
}

function matchesAnswer(input: string, answer: string, strictMode: boolean): boolean {
  if (!input || !answer) return false

  if (strictMode) {
    return normalizeString(input) === normalizeString(answer)
  }

  const left = normalizeStringLenient(input)
  const right = normalizeStringLenient(answer)
  if (!left || !right) return false
  if (left === right) return true
  return normalizeStringCompact(input) === normalizeStringCompact(answer)
}

/**
 * Validate a guess against the canonical entity name and any aliases.
 * Aliases are matched with the same normalization rules as the canonical
 * answer (case-insensitive in both modes; lenient mode also strips quotes,
 * hyphens, parentheticals, and "the/a/an").
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
