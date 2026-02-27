function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function validateGuess(input: string, answer: string, strictMode = false): boolean {
  if (!input || !answer) return false
  return normalizeString(input) === normalizeString(answer)
}
