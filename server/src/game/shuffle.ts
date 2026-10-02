/** Fisher-Yates in-place shuffle on a copy. Used by rounds and in-person cards. */
export function shuffle<T>(array: T[]): T[] {
  return shuffleWithRng(array, Math.random)
}

/** FNV-1a 32-bit hash for deterministic seeds. */
export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Mulberry32 PRNG from a string seed. */
export function createSeededRng(seed: string): () => number {
  let state = hashString(seed) || 1
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithRng<T>(array: T[], rng: () => number): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function seededShuffle<T>(array: T[], seed: string): T[] {
  return shuffleWithRng(array, createSeededRng(seed))
}

/** Deterministic random-looking sample (seeded Fisher–Yates, then take N). */
export function pickSeededSample<T>(items: T[], count: number, seed: string): T[] {
  return seededShuffle(items, seed).slice(0, Math.min(count, items.length))
}
