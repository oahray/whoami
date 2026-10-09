import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoom, deleteRoom, getAllRooms } from '../rooms/store.js'
import { endGame } from '../game/roundState.js'
import {
  emptyPlayCounts,
  getPlayCountsForDay,
  recordPlayCount,
  resetPlayCountsForTests,
  utcPlayCountDate
} from './playCounts.js'

vi.mock('../redis/client.js', () => ({
  isRedisConfigured: () => false,
  getRedis: async () => null
}))

describe('playCounts', () => {
  afterEach(() => {
    resetPlayCountsForTests()
    for (const code of [...getAllRooms().keys()]) deleteRoom(code)
    resetPlayCountsForTests()
  })

  it('uses the UTC date', () => {
    expect(utcPlayCountDate(new Date('2026-10-09T23:30:00.000Z'))).toBe('2026-10-09')
    expect(utcPlayCountDate(new Date('2026-10-09T00:30:00.000Z'))).toBe('2026-10-09')
  })

  it('counts a created waiting room, then an abandon when it is removed', async () => {
    const before = await getPlayCountsForDay()
    const room = createRoom('host-1', 'Host')
    const created = await getPlayCountsForDay()
    expect(created.multiplayerRoomsCreated).toBe(before.multiplayerRoomsCreated + 1)
    expect(created.multiplayerPlayerConnections).toBe(before.multiplayerPlayerConnections + 1)

    deleteRoom(room.code)
    const abandoned = await getPlayCountsForDay()
    expect(abandoned.multiplayerAbandonedBeforeStart).toBe(before.multiplayerAbandonedBeforeStart + 1)
  })

  it('does not count a started room as abandoned when it is removed', async () => {
    const room = createRoom('host-1', 'Host')
    room.status = 'in_progress'
    const before = await getPlayCountsForDay()
    deleteRoom(room.code)
    const after = await getPlayCountsForDay()
    expect(after.multiplayerAbandonedBeforeStart).toBe(before.multiplayerAbandonedBeforeStart)
  })

  it('counts a finished game once', async () => {
    const room = createRoom('host-1', 'Host')
    room.status = 'in_progress'
    room.scores.set('host-1', 10)
    endGame(room)
    endGame(room)
    const counts = await getPlayCountsForDay()
    expect(counts.multiplayerGamesCompleted).toBe(1)
  })

  it('keeps days separate', async () => {
    recordPlayCount('multiplayerGamesStarted', new Date('2026-01-01T12:00:00.000Z'))
    recordPlayCount('multiplayerGamesStarted', new Date('2026-01-02T12:00:00.000Z'))
    expect((await getPlayCountsForDay('2026-01-01')).multiplayerGamesStarted).toBe(1)
    expect((await getPlayCountsForDay('2026-01-02')).multiplayerGamesStarted).toBe(1)
    expect(emptyPlayCounts().soloClassicStarted).toBe(0)
  })
})
