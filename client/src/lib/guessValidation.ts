function normalizeStrict(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ')
}

function normalizeLenient(value: string): string {
  return normalizeStrict(value)
    .replace(/['-]/g, ' ')
    .split(/\s+/)
    .filter((word) => !['the', 'a', 'an'].includes(word))
    .join(' ')
}

function matches(input: string, answer: string, strict: boolean): boolean {
  if (!input || !answer) return false
  const normalize = strict ? normalizeStrict : normalizeLenient
  return normalize(input) === normalize(answer)
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
