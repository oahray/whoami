export type EntityTypeFilter = 'character' | 'place' | 'all'

export const DEFAULT_ENTITY_TYPE_FILTER: EntityTypeFilter = 'character'

export function parseEntityTypeFilter(raw: unknown): EntityTypeFilter | null {
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_ENTITY_TYPE_FILTER
  }
  if (raw === 'character' || raw === 'place' || raw === 'all') {
    return raw
  }
  return null
}

export function entityMatchesTypeFilter(
  type: 'character' | 'place',
  filter: EntityTypeFilter
): boolean {
  return filter === 'all' || type === filter
}
