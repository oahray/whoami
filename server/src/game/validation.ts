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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

const ARTICLES = new Set(['the', 'a', 'an'])

/** Drop optional articles — lenient mode only. */
function stripArticles(value: string): string {
  return value
    .split(/\s+/)
    .filter((word) => word.length > 0 && !ARTICLES.has(word))
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

const TITLES = new Set(['king', 'queen', 'prophet', 'prophetess', 'apostle', 'saint', 'st', 'st.', 'judge', 'priest'])

/** Only brackets and commas split words here, so "Moses!" stays a different word from "Moses". */
function nameWords(value: string, strict: boolean): string[] {
  const words = normalizePunctuation(value.replace(/[(),]/g, ' ')).split(' ').filter(Boolean)
  return strict ? words : words.filter((word) => !ARTICLES.has(word))
}

/** Titles players put in front of a name ("King David", "High Priest Eli"). Never drops the last word. */
function dropTitles(words: string[]): string[] {
  let rest = words
  for (;;) {
    if (rest.length > 2 && rest[0] === 'high' && rest[1] === 'priest') rest = rest.slice(2)
    else if (rest.length > 1 && TITLES.has(rest[0])) rest = rest.slice(1)
    else return rest
  }
}

function sameWordsAnyOrder(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().join(' ') === [...right].sort().join(' ')
}

/**
 * Qualifiers without brackets ("Simon the Zealot", "Zealot Simon", "Abimelech, king of Gerar") and leading titles.
 * Any extra words must be the answer's own qualifier, so "John the Baptist" never matches "John (the apostle)".
 */
function matchesQualifiedName(input: string, answer: string, strict: boolean): boolean {
  const guess = dropTitles(nameWords(input, strict))
  const main = dropTitles(nameWords(stripParentheticals(answer), strict))
  if (guess.length === 0 || main.length === 0) return false
  const qualifier = (answer.match(/\([^)]*\)/g) ?? []).flatMap((part) => nameWords(part, strict))
  const full = [...main, ...qualifier]
  const same = (words: string[]) => {
    const left = compact(guess.join(' '))
    const right = compact(words.join(' '))
    return left === right || (!strict && isNearMiss(left, right))
  }
  return same(main) || same(full) || sameWordsAnyOrder(guess, full)
}

function matchesAnswer(input: string, answer: string, strictMode: boolean): boolean {
  if (!input || !answer) return false

  const { left: leftBase, right: rightBase } = normalizeForGuess(input, answer)
  if (equalsIgnoringSeparators(leftBase, rightBase)) return true
  if (matchesQualifiedName(input, answer, strictMode)) return true

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

export type GuessCloseness = 'spelling' | 'close' | null

/** Comparable core for closeness: no parentheticals, articles, leading titles, case or separators. */
function closenessCore(value: string): string {
  return compact(dropTitles(nameWords(stripParentheticals(value), false)).join(' '))
}

/** Typos still counted as "close": none for names under 4 letters, 1 up to 7, 2 from 8. */
function closeDistanceAllowed(length: number): number {
  if (length < 4) return 0
  return length >= 8 ? 2 : 1
}

/**
 * How close a wrong guess was. Only ever told to the guesser, never to the room.
 * - 'spelling': Strict mode rejected it, but it would count with Strict mode off.
 * - 'close': within the allowed typos of the answer or an alias.
 * Call only for guesses that `validateGuess` rejected.
 */
export function guessCloseness(
  input: string,
  answer: string,
  strictMode = false,
  aliases: string[] = []
): GuessCloseness {
  if (!input || !input.trim()) return null
  if (strictMode && validateGuess(input, answer, false, aliases)) return 'spelling'
  const guess = closenessCore(input)
  if (!guess) return null
  for (const target of [answer, ...aliases]) {
    if (typeof target !== 'string' || target.trim() === '') continue
    const core = closenessCore(target)
    const allowed = closeDistanceAllowed(core.length)
    if (allowed === 0 || Math.abs(core.length - guess.length) > allowed) continue
    if (damerauLevenshtein(guess, core) <= allowed) return 'close'
  }
  return null
}
