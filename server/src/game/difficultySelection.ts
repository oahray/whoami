/** Single clue/gameplay difficulty tier (not including “any”). */
export const DIFFICULTY_TIERS = ['easy', 'medium', 'hard', 'nightmare'] as const

export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number]

/**
 * Selected gameplay tiers. Empty means all difficulties (“any”).
 * Always stored sorted and unique.
 */
export type DifficultySelection = DifficultyTier[]

export function isAnyDifficultySelection(selection: DifficultySelection): boolean {
  return selection.length === 0
}

export function normalizeDifficultySelection(
  raw: readonly string[]
): DifficultySelection | null {
  const unique = new Set<DifficultyTier>()
  for (const item of raw) {
    const value = item.trim().toLowerCase()
    if (!(DIFFICULTY_TIERS as readonly string[]).includes(value)) return null
    unique.add(value as DifficultyTier)
  }
  if (unique.size === DIFFICULTY_TIERS.length) return []
  return DIFFICULTY_TIERS.filter((tier) => unique.has(tier))
}

/** Parse query/body values: `any`, `easy`, `hard,nightmare`, or string[]. */
export function parseDifficultySelection(raw: unknown): DifficultySelection | null {
  if (raw === undefined || raw === null || raw === '') return []
  if (Array.isArray(raw)) {
    if (raw.length === 0) return []
    if (!raw.every((item) => typeof item === 'string')) return null
    return normalizeDifficultySelection(raw)
  }
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().toLowerCase()
  if (trimmed === 'any') return []
  if (trimmed.includes(',')) {
    return normalizeDifficultySelection(trimmed.split(',').map((part) => part.trim()).filter(Boolean))
  }
  return normalizeDifficultySelection([trimmed])
}

export function encodeDifficultySelection(selection: DifficultySelection): string {
  return isAnyDifficultySelection(selection) ? 'any' : selection.join(',')
}

export function difficultySelectionEquals(a: DifficultySelection, b: DifficultySelection): boolean {
  if (a.length !== b.length) return false
  return a.every((tier, index) => tier === b[index])
}

export function formatDifficultySelection(selection: DifficultySelection): string {
  if (isAnyDifficultySelection(selection)) return 'Any'
  return selection.map((tier) => tier.charAt(0).toUpperCase() + tier.slice(1)).join(' · ')
}

/** Sum clue counts for the selected tiers (`any` uses the total). */
export function countCluesForSelection(
  counts: { any: number } & Partial<Record<DifficultyTier, number>>,
  selection: DifficultySelection
): number {
  if (isAnyDifficultySelection(selection)) return counts.any
  return selection.reduce((sum, tier) => sum + (counts[tier] ?? 0), 0)
}
