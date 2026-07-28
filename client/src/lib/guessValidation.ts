function normalizeStrict(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Drop clarifying qualifiers like `(Jesus' brother)`. */
function stripParentheticals(value: string): string {
  return value.replace(/\([^)]*\)/g, ' ')
}

/**
 * Lenient form: case-insensitive, optional articles, apostrophes/dashes as spaces,
 * and parenthetical qualifiers ignored.
 */
function normalizeLenient(value: string): string {
  return stripParentheticals(value)
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
function normalizeCompact(value: string): string {
  return normalizeLenient(value).replace(/\s+/g, '')
}

function matches(input: string, answer: string, strict: boolean): boolean {
  if (!input || !answer) return false
  if (strict) {
    return normalizeStrict(input) === normalizeStrict(answer)
  }
  const left = normalizeLenient(input)
  const right = normalizeLenient(answer)
  if (!left || !right) return false
  if (left === right) return true
  return normalizeCompact(input) === normalizeCompact(answer)
}

export function validateGuess(
  input: string,
  answer: string,
  aliases: string[] = [],
  strict = false
): boolean {
  if (matches(input, answer, strict)) return true
  return aliases.some((alias) => typeof alias === 'string' && matches(input, alias, strict))
}
