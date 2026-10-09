import Redis from 'ioredis'
import { logger } from '../utils/logger.js'

let client: Redis | null = null
let connectAttempted = false

/** True when REDIS_URL is set (persistence intended for this process). */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

/**
 * Lazily connect. Returns null when REDIS_URL is unset (local/dev without Redis).
 * Throws if REDIS_URL is set but the connection cannot be established.
 */
export async function getRedis(): Promise<Redis | null> {
  if (!isRedisConfigured()) return null
  if (client) return client

  if (connectAttempted && !client) {
    throw new Error('Redis connection previously failed')
  }
  connectAttempted = true

  const url = process.env.REDIS_URL!.trim()
  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true
  })

  redis.on('error', (err) => {
    logger.error('Redis client error', err)
  })

  try {
    await redis.connect()
    client = redis
    logger.info('Redis connected')
    return client
  } catch (err) {
    redis.disconnect()
    throw err
  }
}

/** Test helper. */
export async function resetRedisClientForTests(): Promise<void> {
  if (client) {
    client.disconnect()
    client = null
  }
  connectAttempted = false
}
