import { describe, expect, it } from 'vitest'
import { compareEntities } from '../lib/entitySort'
import type { Entity } from '../types'

const moses: Entity = {
  id: '1',
  name: 'Moses',
  type: 'character',
  is_published: true,
  clueCount: 5
}

const aaron: Entity = {
  id: '2',
  name: 'Aaron',
  type: 'character',
  is_published: true,
  clueCount: 12
}

const jerusalem: Entity = {
  id: '3',
  name: 'Jerusalem',
  type: 'place',
  is_published: false,
  clueCount: 5
}

describe('compareEntities', () => {
  it('sorts by name ascending and descending', () => {
    const rows = [moses, aaron, jerusalem]
    expect([...rows].sort((a, b) => compareEntities(a, b, 'name', 'asc')).map((e) => e.name)).toEqual([
      'Aaron',
      'Jerusalem',
      'Moses'
    ])
    expect([...rows].sort((a, b) => compareEntities(a, b, 'name', 'desc')).map((e) => e.name)).toEqual([
      'Moses',
      'Jerusalem',
      'Aaron'
    ])
  })

  it('sorts by clue count and breaks ties by name', () => {
    const rows = [moses, aaron, jerusalem]
    expect([...rows].sort((a, b) => compareEntities(a, b, 'clues', 'desc')).map((e) => e.name)).toEqual([
      'Aaron',
      'Jerusalem',
      'Moses'
    ])
    expect([...rows].sort((a, b) => compareEntities(a, b, 'clues', 'asc')).map((e) => e.name)).toEqual([
      'Jerusalem',
      'Moses',
      'Aaron'
    ])
  })
})
