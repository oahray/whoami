import { describe, expect, it } from 'vitest'
import { canReclaimSeat, socketClientAddress, sweepStaleRooms } from './roomGuards.js'
import { createRoom, getRoom } from './store.js'

describe('socketClientAddress', () => {
  const socket = (xff: string | undefined, address = '10.0.0.1') => ({
    handshake: { address, headers: xff === undefined ? {} : { 'x-forwarded-for': xff } }
  })

  it('reads the address the trusted proxies saw, ignoring what the client prepends', () => {
    expect(socketClientAddress(socket('6.6.6.6, 203.0.113.7'), 1)).toBe('203.0.113.7')
    expect(socketClientAddress(socket('6.6.6.6, 203.0.113.7, 172.70.1.1'), 2)).toBe('203.0.113.7')
  })

  it('falls back to the socket address when there is no forwarding header', () => {
    expect(socketClientAddress(socket(undefined, '203.0.113.9'), 1)).toBe('203.0.113.9')
    expect(socketClientAddress({}, 1)).toBe('unknown')
  })
})

describe('canReclaimSeat', () => {
  it('requires the same device id when the seat has one', () => {
    expect(canReclaimSeat({ deviceId: 'device-paul-0001' }, 'device-paul-0001')).toBe(true)
    expect(canReclaimSeat({ deviceId: 'device-paul-0001' }, 'device-paul-0002')).toBe(false)
    expect(canReclaimSeat({ deviceId: 'device-paul-0001' }, null)).toBe(false)
  })

  it('keeps the nickname-only rule for seats stored without one', () => {
    expect(canReclaimSeat({}, null)).toBe(true)
  })
})

describe('sweepStaleRooms', () => {
  const GRACE = 5 * 60_000

  it('deletes rooms nobody has been connected to for longer than the grace period', () => {
    const now = Date.now()
    const stale = createRoom('sweep-stale', 'Peter')
    const host = stale.players.get('sweep-stale')!
    host.isConnected = false
    host.disconnectedAt = now - GRACE - 1

    const recent = createRoom('sweep-recent', 'John')
    const recentHost = recent.players.get('sweep-recent')!
    recentHost.isConnected = false
    recentHost.disconnectedAt = now - 1000

    const live = createRoom('sweep-live', 'James')

    sweepStaleRooms(GRACE, now)

    expect(getRoom(stale.code)).toBeNull()
    expect(getRoom(recent.code)).not.toBeNull()
    expect(getRoom(live.code)).not.toBeNull()
  })

  it('stops round timers on rooms it deletes', () => {
    const now = Date.now()
    const room = createRoom('sweep-timers', 'Peter')
    const host = room.players.get('sweep-timers')!
    host.isConnected = false
    host.disconnectedAt = now - GRACE - 1
    let fired = false
    const timer = setTimeout(() => { fired = true }, 10)
    room.currentRound = { timers: { clueReveal: timer, roundEnd: null } } as any

    sweepStaleRooms(GRACE, now)

    expect(room.currentRound?.timers.clueReveal).toBeNull()
    return new Promise<void>((resolve) => setTimeout(() => { expect(fired).toBe(false); resolve() }, 30))
  })
})
