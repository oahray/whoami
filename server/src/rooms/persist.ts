import { getRedis, isRedisConfigured } from '../redis/client.js'
import { logger } from '../utils/logger.js'
import {
  deserializeRoom,
  prepareRoomForHydrate,
  ROOM_REDIS_KEY_PATTERN,
  ROOM_REDIS_TTL_SECONDS,
  roomRedisKey,
  serializeRoom,
  type SerializedRoom
} from './serialize.js'
import type { RoomState } from './store.js'

export async function saveRoomToRedis(room: RoomState): Promise<void> {
  if (!isRedisConfigured()) return
  try {
    const redis = await getRedis()
    if (!redis) return
    const payload = JSON.stringify(serializeRoom(room))
    await redis.set(roomRedisKey(room.code), payload, 'EX', ROOM_REDIS_TTL_SECONDS)
  } catch (err) {
    logger.error('Failed to persist room to Redis', err, { roomCode: room.code })
  }
}

export async function deleteRoomFromRedis(code: string): Promise<void> {
  if (!isRedisConfigured()) return
  try {
    const redis = await getRedis()
    if (!redis) return
    await redis.del(roomRedisKey(code))
  } catch (err) {
    logger.error('Failed to delete room from Redis', err, { roomCode: code })
  }
}

/** Fire-and-forget write; safe to call from sync socket handlers. */
export function persistRoom(room: RoomState): void {
  void saveRoomToRedis(room)
}

export function removePersistedRoom(code: string): void {
  void deleteRoomFromRedis(code)
}

/**
 * Read and prepare room snapshots. Caller inserts them into the in-memory Map.
 * No-op (empty list) when REDIS_URL is unset.
 */
export async function fetchRoomsFromRedis(): Promise<{
  rooms: RoomState[]
  restored: number
  demoted: number
}> {
  if (!isRedisConfigured()) {
    logger.info('REDIS_URL unset; multiplayer rooms are in-memory only')
    return { rooms: [], restored: 0, demoted: 0 }
  }

  const redis = await getRedis()
  if (!redis) return { rooms: [], restored: 0, demoted: 0 }

  const hydrated: RoomState[] = []
  let restored = 0
  let demoted = 0
  let cursor = '0'

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', ROOM_REDIS_KEY_PATTERN, 'COUNT', 100)
    cursor = nextCursor
    if (keys.length === 0) continue

    const values = await redis.mget(...keys)
    for (let i = 0; i < keys.length; i += 1) {
      const raw = values[i]
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as SerializedRoom
        if (!parsed?.code || typeof parsed.code !== 'string') continue
        const wasInProgress = parsed.status === 'in_progress'
        const room = prepareRoomForHydrate(deserializeRoom(parsed))
        hydrated.push(room)
        restored += 1
        if (wasInProgress) demoted += 1
        await saveRoomToRedis(room)
      } catch (err) {
        logger.error('Failed to hydrate room from Redis', err, { key: keys[i] })
      }
    }
  } while (cursor !== '0')

  logger.info('Loaded rooms from Redis', { restored, demoted })
  return { rooms: hydrated, restored, demoted }
}
