/**
 * Short-lived memory cache for published content (datasets, entities, clues) read by the
 * public card endpoints. Concurrent requests for the same key share one database call,
 * failures are never kept, and admin changes clear everything (see admin/routes/index.ts).
 */
export const CONTENT_CACHE_TTL_MS = 5 * 60_000

type Entry = { expiresAt: number; value: Promise<unknown> }

const entries = new Map<string, Entry>()

export function cachedContent<T>(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = entries.get(key)
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>
  const value = load()
  entries.set(key, { expiresAt: now + CONTENT_CACHE_TTL_MS, value })
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key)
  })
  return value
}

export function clearContentCache(): void {
  entries.clear()
}
