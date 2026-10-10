export type EntityTypeFilter = 'character' | 'place' | 'all'

export const DEFAULT_ENTITY_TYPE_FILTER: EntityTypeFilter = 'character'

/** User-facing label for the entity-type setting. */
export const ENTITY_TYPE_FIELD_LABEL = 'Card type'

export const ENTITY_TYPE_HINT_IN_PERSON = 'Characters, places, or both in the deck.'

export const ENTITY_TYPE_HINT_LOBBY = 'Characters, places, or both each round.'

export const ENTITY_TYPE_OPTIONS: { value: EntityTypeFilter; label: string }[] = [
  { value: 'character', label: 'Characters' },
  { value: 'place', label: 'Places' },
  { value: 'all', label: 'Characters & places' }
]

export function entityTypeOptionLabel(value: EntityTypeFilter): string {
  return ENTITY_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? 'Characters'
}

export function entityTypeCountLabel(filter: EntityTypeFilter, count: number): string {
  const noun =
    filter === 'place' ? 'place' : filter === 'character' ? 'character' : 'entity'
  return `${count} ${noun}${count === 1 ? '' : 's'} in this deck`
}

/** The only card type in the set, when the other type is absent. */
export function soleCardType(
  types: { character: number; place: number } | null | undefined
): 'character' | 'place' | null {
  if (!types) return null
  if (types.character > 0 && types.place === 0) return 'character'
  if (types.place > 0 && types.character === 0) return 'place'
  return null
}
