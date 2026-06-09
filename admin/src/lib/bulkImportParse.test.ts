import { describe, expect, it } from 'vitest'
import { parseBulkImportJson } from './bulkImportParse'

describe('parseBulkImportJson', () => {
  it('accepts a bare entities array', () => {
    const json = '[{"name":"Moses","type":"character","clues":[{"text":"x"}]}]'
    expect(parseBulkImportJson(json)).toHaveLength(1)
  })

  it('accepts export payload with entities key', () => {
    const json = '{"entities":[{"name":"Moses","type":"character","clues":[{"text":"x"}]}]}'
    expect(parseBulkImportJson(json)).toHaveLength(1)
  })

  it('rejects invalid shapes', () => {
    expect(() => parseBulkImportJson('{"name":"nope"}')).toThrow(/array of entities/)
  })
})
