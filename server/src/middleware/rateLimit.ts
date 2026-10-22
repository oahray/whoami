import type { RequestHandler } from 'express'

export type RateLimitRule = { windowMs: number; max: number }

/**
 * Fixed-window counter per key, held in memory. Old windows are swept as time passes,
 * so a flood of different addresses only costs memory for the current window.
 */
export function createRateLimiter(rule: RateLimitRule, now: () => number = Date.now) {
  const buckets = new Map<string, { windowStart: number; count: number }>()
  let lastSweep = now()

  return {
    hit(key: string): { allowed: boolean; retryAfterMs: number } {
      const time = now()
      if (time - lastSweep >= rule.windowMs) {
        for (const [bucketKey, bucket] of buckets) {
          if (time - bucket.windowStart >= rule.windowMs) buckets.delete(bucketKey)
        }
        lastSweep = time
      }
      const bucket = buckets.get(key)
      if (!bucket || time - bucket.windowStart >= rule.windowMs) {
        buckets.set(key, { windowStart: time, count: 1 })
        return { allowed: true, retryAfterMs: 0 }
      }
      bucket.count += 1
      if (bucket.count <= rule.max) return { allowed: true, retryAfterMs: 0 }
      return { allowed: false, retryAfterMs: bucket.windowStart + rule.windowMs - time }
    },
    size: () => buckets.size
  }
}

/** 429 with Retry-After once an address goes over the rule. Relies on `trust proxy` for req.ip. */
export function rateLimit(rule: RateLimitRule): RequestHandler {
  const limiter = createRateLimiter(rule)
  return (req, res, next) => {
    const { allowed, retryAfterMs } = limiter.hit(req.ip ?? 'unknown')
    if (allowed) return next()
    res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))))
    res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.',
      code: 'RATE_LIMITED'
    })
  }
}

/**
 * Limits for the public HTTP API. They are deliberately loose: players on one church or
 * school Wi-Fi share an address, and the aim is to stop scripted floods, not people.
 */
export const PUBLIC_RATE_LIMITS = {
  /** Every public endpoint together. */
  overall: { windowMs: 60_000, max: 600 },
  /** Starting a game loads and shuffles the whole pool. */
  deck: { windowMs: 60_000, max: 60 },
  /** Anonymous play counters for the admin dashboard. */
  playTotals: { windowMs: 60_000, max: 120 }
} satisfies Record<string, RateLimitRule>
