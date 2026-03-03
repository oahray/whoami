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

export function validateGuess(input: string, answer: string, strictMode = false): boolean {
  if (!input || !answer) return false

  if (strictMode) {
    return normalizeString(input) === normalizeString(answer)
  } else {
    return normalizeStringLenient(input) === normalizeStringLenient(answer)
  }
}
