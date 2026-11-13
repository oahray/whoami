import { timingSafeEqual } from 'crypto'
import v8 from 'node:v8'
import { createRateLimiter, type RateLimitRule } from '../middleware/rateLimit.js'
import { TRUST_PROXY_HOPS } from '../config/proxy.js'
import { deleteRoom, getAllRooms, type Player, type RoomState } from './store.js'

/**
 * Limits on rooms. Loose enough for a family on one Wi-Fi joining and reconnecting,
 * tight enough that a script cannot fill memory with rooms or guess room codes.
 */
export const ROOM_LIMITS = {
  create: { windowMs: 10 * 60_000, max: 10 },
  join: { windowMs: 60_000, max: 30 },
  // Share of the V8 heap in use above which new rooms are refused, so a flood degrades to
  // "server busy" instead of an out-of-memory crash that would end every running game.
  heapBusyRatio: 0.85,
  sweepIntervalMs: 5 * 60_000
} satisfies { create: RateLimitRule; join: RateLimitRule; heapBusyRatio: number; sweepIntervalMs: number }

let createLimiter = createRateLimiter(ROOM_LIMITS.create)
let joinLimiter = createRateLimiter(ROOM_LIMITS.join)

export function resetRoomGuardsForTests(): void {
  createLimiter = createRateLimiter(ROOM_LIMITS.create)
  joinLimiter = createRateLimiter(ROOM_LIMITS.join)
}

type HandshakeLike = {
  handshake?: { address?: string; headers?: Record<string, string | string[] | undefined> }
}

/** Same rule as Express's `trust proxy` with a hop count, applied to the socket handshake. */
export function socketClientAddress(socket: HandshakeLike, hops = TRUST_PROXY_HOPS): string {
  const handshake = socket.handshake
  if (!handshake) return 'unknown'
  const header = handshake.headers?.['x-forwarded-for']
  const forwarded = (Array.isArray(header) ? header.join(',') : header ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const chain = [...forwarded, handshake.address ?? 'unknown']
  return chain[Math.max(0, chain.length - 1 - hops)]
}

export function allowRoomCreate(address: string): boolean {
  return createLimiter.hit(address).allowed
}

export function allowRoomJoin(address: string): boolean {
  return joinLimiter.hit(address).allowed
}

type HeapReading = { used: number; limit: number }

function readHeap(): HeapReading {
  return { used: process.memoryUsage().heapUsed, limit: v8.getHeapStatistics().heap_size_limit }
}

export function memoryPressureHigh(read: () => HeapReading = readHeap): boolean {
  const { used, limit } = read()
  return limit > 0 && used / limit > ROOM_LIMITS.heapBusyRatio
}

/**
 * A disconnected seat goes back only to the browser that held it.
 * Seats from before device ids were stored have none, so they keep the old nickname-only rule.
 */
export function canReclaimSeat(seat: Pick<Player, 'deviceId'>, deviceId: string | null): boolean {
  if (!seat.deviceId) return true
  if (!deviceId) return false
  const held = Buffer.from(seat.deviceId)
  const offered = Buffer.from(deviceId)
  return held.length === offered.length && timingSafeEqual(held, offered)
}

function stopRoundTimers(room: RoomState): void {
  const timers = room.currentRound?.timers
  if (!timers) return
  if (timers.clueReveal) clearTimeout(timers.clueReveal)
  if (timers.roundEnd) clearTimeout(timers.roundEnd)
  timers.clueReveal = null
  timers.roundEnd = null
}

/**
 * Deletes rooms nobody has been connected to for longer than the grace period.
 * The per-player disconnect timers do this in normal running, but they are lost on a
 * restart, so rooms reloaded from Redis would otherwise stay in memory for good.
 */
export function sweepStaleRooms(graceMs: number, now = Date.now()): number {
  let removed = 0
  for (const room of Array.from(getAllRooms().values())) {
    const abandoned = Array.from(room.players.values()).every(
      (player) => !player.isConnected && player.disconnectedAt != null && now - player.disconnectedAt >= graceMs
    )
    if (!abandoned) continue
    stopRoundTimers(room)
    deleteRoom(room.code)
    removed++
  }
  return removed
}
