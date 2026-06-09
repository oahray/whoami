/** Accept bulk-import array JSON or export payload `{ entities: [...] }`. */
export function parseBulkImportJson(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text)

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { entities?: unknown }).entities)
  ) {
    return (parsed as { entities: unknown[] }).entities
  }

  throw new Error('JSON must be an array of entities or an object with an "entities" array')
}
