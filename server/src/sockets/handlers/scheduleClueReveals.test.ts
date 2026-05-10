import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoom } from '../../rooms/store.js'
import { scheduleClueReveals } from './utils.js'

function buildIo() {
  const emit = vi.fn()
  const io = {
    to: vi.fn(() => ({ emit })),
    emit: vi.fn()
  } as any
  return { io, emit }
}

function buildRoundWithClues(count: number) {
  const room = createRoom('host-1', 'Host')
  room.status = 'in_progress'
  room.settings.roundDuration = 30000
  room.settings.clueRevealTime = 5000
  const now = Date.now()
  room.currentRound = {
    roundNumber: 1,
    entity: {
      id: 'entity-1',
      name: 'Moses',
      type: 'character',
      is_published: true
    },
    clues: Array.from({ length: count }, (_, i) => ({
      id: `c${i + 1}`,
      order: i + 1,
      text: `Clue ${i + 1}`,
      citations: null
    })),
    phase: 'active',
    serverStartTime: now,
    activeStartTime: now,
    revealedClueCount: 1,
    correctGuesses: [],
    timers: {
      clueReveal: null,
      roundEnd: null
    }
  }
  return room
}

describe('scheduleClueReveals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-10T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reveals additional clues at clueRevealTime intervals until clues are exhausted', async () => {
    const room = buildRoundWithClues(5)
    const { io, emit } = buildIo()

    scheduleClueReveals(io, room)

    expect(emit).not.toHaveBeenCalled()
    expect(room.currentRound!.revealedClueCount).toBe(1)

    // Clue 2 at 5s
    await vi.advanceTimersByTimeAsync(5000)
    expect(room.currentRound!.revealedClueCount).toBe(2)
    expect(emit).toHaveBeenLastCalledWith('CLUE_REVEALED', { clue: { order: 2, text: 'Clue 2' } })

    // Clue 3 at 10s
    await vi.advanceTimersByTimeAsync(5000)
    expect(room.currentRound!.revealedClueCount).toBe(3)
    expect(emit).toHaveBeenLastCalledWith('CLUE_REVEALED', { clue: { order: 3, text: 'Clue 3' } })

    // Clue 4 at 15s
    await vi.advanceTimersByTimeAsync(5000)
    expect(room.currentRound!.revealedClueCount).toBe(4)
    expect(emit).toHaveBeenLastCalledWith('CLUE_REVEALED', { clue: { order: 4, text: 'Clue 4' } })

    // Clue 5 at 20s
    await vi.advanceTimersByTimeAsync(5000)
    expect(room.currentRound!.revealedClueCount).toBe(5)
    expect(emit).toHaveBeenLastCalledWith('CLUE_REVEALED', { clue: { order: 5, text: 'Clue 5' } })

    // No clue 6 — even if more time passes, no further emits
    await vi.advanceTimersByTimeAsync(10000)
    expect(emit).toHaveBeenCalledTimes(4)
  })

  it('skips any reveal that would land inside the round tail buffer', async () => {
    const room = buildRoundWithClues(5)
    // Each interval is 10s, round is 30s. Clue 2 at 10s, clue 3 at 20s. Clue
    // 4 would land at 30s, which is inside the 1.5s tail buffer, so it
    // should not fire.
    room.settings.clueRevealTime = 10000
    const { io, emit } = buildIo()

    scheduleClueReveals(io, room)

    await vi.advanceTimersByTimeAsync(10000)
    await vi.advanceTimersByTimeAsync(10000)
    await vi.advanceTimersByTimeAsync(10000)

    expect(room.currentRound!.revealedClueCount).toBe(3)
    expect(emit).toHaveBeenCalledTimes(2)
  })

  it('stops scheduling once the round has ended', async () => {
    const room = buildRoundWithClues(4)
    const { io, emit } = buildIo()

    scheduleClueReveals(io, room)

    await vi.advanceTimersByTimeAsync(5000)
    expect(emit).toHaveBeenCalledTimes(1)

    room.currentRound!.phase = 'ended'

    await vi.advanceTimersByTimeAsync(20000)
    expect(emit).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the entity has only one clue', () => {
    const room = buildRoundWithClues(1)
    const { io, emit } = buildIo()

    scheduleClueReveals(io, room)

    expect(emit).not.toHaveBeenCalled()
    expect(room.currentRound!.timers.clueReveal).toBeNull()
  })
})
