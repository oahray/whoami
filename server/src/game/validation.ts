/** Drop clarifying qualifiers like `(Jesus' brother)`. */
function stripParentheticals(value: string): string {
  return value.replace(/\([^)]*\)/g, ' ')
}

function hasParenthetical(value: string): boolean {
  return /\([^)]*\)/.test(value)
}

/** Casefold + treat apostrophes/dashes as spaces. Keeps parenthetical text. */
function normalizePunctuation(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['\u2019\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Guess without `(...)` → compare main names only.
 * Guess with `(...)` → must match the full answer, including that context.
 */
function normalizeForGuess(input: string, answer: string): { left: string; right: string } {
  if (hasParenthetical(input)) {
    return {
      left: normalizePunctuation(input),
      right: normalizePunctuation(answer)
    }
  }
  return {
    left: normalizePunctuation(stripParentheticals(input)),
    right: normalizePunctuation(stripParentheticals(answer))
  }
}

/** Drop optional articles — lenient mode only. */
function stripArticles(value: string): string {
  return value
    .split(/\s+/)
    .filter((word) => word.length > 0 && !['the', 'a', 'an'].includes(word))
    .join(' ')
}

function compact(value: string): string {
  return value.replace(/\s+/g, '')
}

/** Damerau–Levenshtein distance (insert/delete/substitute/adjacent transpose). */
function damerauLevenshtein(a: string, b: string): number {
  const al = a.length
  const bl = b.length
  const dp: number[][] = Array.from({ length: al + 1 }, () => Array<number>(bl + 1).fill(0))
  for (let i = 0; i <= al; i += 1) dp[i][0] = i
  for (let j = 0; j <= bl; j += 1) dp[0][j] = j
  for (let i = 1; i <= al; i += 1) {
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
      }
    }
  }
  return dp[al][bl]
}

/**
 * Allow a single typo (including adjacent letter swaps like Pharoah/Pharaoh)
 * on longer compact names to avoid short false friends (Mark/Mary).
 */
function isNearMiss(left: string, right: string): boolean {
  if (left.length < 6 || right.length < 6) return false
  if (Math.abs(left.length - right.length) > 1) return false
  return damerauLevenshtein(left, right) <= 1
}

function equalsIgnoringSeparators(left: string, right: string): boolean {
  if (!left || !right) return false
  if (left === right) return true
  return compact(left) === compact(right)
}

function matchesAnswer(input: string, answer: string, strictMode: boolean): boolean {
  if (!input || !answer) return false

  const { left: leftBase, right: rightBase } = normalizeForGuess(input, answer)
  if (equalsIgnoringSeparators(leftBase, rightBase)) return true

  if (strictMode) return false

  // Lenient: optional articles + one-typo near miss on longer names.
  const left = stripArticles(leftBase)
  const right = stripArticles(rightBase)
  if (equalsIgnoringSeparators(left, right)) return true
  return isNearMiss(compact(left), compact(right))
}

/**
 * Validate a guess against the canonical entity name and any aliases.
 *
 * Always flexible: case, whitespace, dashes/apostrophes.
 * Omitting `(...)` matches the main name only; including it requires the full answer.
 * Strict mode only removes spelling leniency (articles + one-typo near misses).
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
