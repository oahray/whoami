import type { Entity } from '../types'

export type EntitySortKey = 'name' | 'clues'
export type EntitySortDir = 'asc' | 'desc'

export function compareEntities(
  a: Entity,
  b: Entity,
  sortKey: EntitySortKey,
  sortDir: EntitySortDir
): number {
  const direction = sortDir === 'asc' ? 1 : -1
  if (sortKey === 'clues') {
    const diff = (a.clueCount ?? 0) - (b.clueCount ?? 0)
    if (diff !== 0) return diff * direction
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  }
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  if (byName !== 0) return byName * direction
  return ((a.clueCount ?? 0) - (b.clueCount ?? 0)) * direction
}
