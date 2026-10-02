import type { Difficulty } from '../types'

export type ClueBaseline = {
  text: string
  citations: string
  difficulty: Difficulty | null
}

export type ClueLike = {
  id: string | null
  text: string
  citations: string
  difficulty: Difficulty | null
}

export function toClueBaseline(clue: Pick<ClueLike, 'text' | 'citations' | 'difficulty'>): ClueBaseline {
  return {
    text: clue.text,
    citations: clue.citations || '',
    difficulty: clue.difficulty || null
  }
}

export function buildClueBaselineMap(
  clues: Array<{ id: string | null } & Pick<ClueLike, 'text' | 'citations' | 'difficulty'>>
): Record<string, ClueBaseline> {
  const map: Record<string, ClueBaseline> = {}
  for (const clue of clues) {
    if (!clue.id) continue
    map[clue.id] = toClueBaseline(clue)
  }
  return map
}

/** New clues (no id) are always dirty; existing ones only if fields changed. */
export function isClueDirty(clue: ClueLike, baselineById: Record<string, ClueBaseline>): boolean {
  if (!clue.id) return true
  const baseline = baselineById[clue.id]
  if (!baseline) return true
  const current = toClueBaseline(clue)
  return (
    current.text !== baseline.text ||
    current.citations !== baseline.citations ||
    current.difficulty !== baseline.difficulty
  )
}
