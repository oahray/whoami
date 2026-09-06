import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoom } from '../../rooms/store.js'
import { ROUND_START_DELAY_MS } from '../../game/multiplayerDefaults.js'
import {
  rearmRoomTimers,
  scheduleClueReveals,
  scheduleRoundActivation,
  scheduleRoundEnd
} from './utils.js'

function buildIo() {
  const emit = vi.fn()
  const io = {
    to: vi.fn(() => ({ emit })),
    emit: vi.fn()
  } as any
  return { io, emit }
}

function buildRound(overrides: {
  phase?: 'starting' | 'active' | 'clue_revealed' | 'ended'
  serverStartTime?: number
  activeStartTime?: number | null
  revealedClueCount?: number
  roundEndedAt?: number | null
  roundDuration?: number
  clueCount?: number
} = {}) {
  const room = createRoom('host-1', 'Host')
  room.status = 'in_progress'
  room.settings.roundDuration = overrides.roundDuration ?? 30_000
  room.settings.clueRevealTime = 5_000
  const now = Date.now()
  const clueCount = overrides.clueCount ?? 3
  room.currentRound = {
    roundNumber: 1,
    entity: {
      id: 'entity-1',
      name: 'Moses',
      type: 'character',
      is_published: true
    },
    clues: Array.from({ length: clueCount }, (_, i) => ({
      id: `c${i + 1}`,
      order: i + 1,
      text: `Clue ${i + 1}`,
      citations: null
    })),
    phase: overrides.phase ?? 'active',
    serverStartTime: overrides.serverStartTime ?? now,
    activeStartTime: overrides.activeStartTime === undefined ? now : overrides.activeStartTime,
    revealedClueCount: overrides.revealedClueCount ?? 1,
    roundEndedAt: overrides.roundEndedAt ?? null,
    correctGuesses: [],
    timers: {
      clueReveal: null,
      roundEnd: null
    }
  }
  return room
}

describe('wall-clock round timers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-10T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('scheduleRoundEnd uses remaining time from activeStartTime', () => {
    const { io, emit } = buildIo()
    const startedAt = Date.now()
    const room = buildRound({
      activeStartTime: startedAt,
      roundDuration: 10_000,
      clueCount: 1
    })

    vi.setSystemTime(startedAt + 4_000)
    scheduleRoundEnd(io, room)

    vi.advanceTimersByTime(5_999)
    expect(room.currentRound!.phase).toBe('active')

    vi.advanceTimersByTime(1)
    expect(room.currentRound!.phase).toBe('ended')
    expect(room.currentRound!.roundEndedAt).not.toBeNull()
    expect(emit).toHaveBeenCalledWith('ROUND_ENDED', expect.any(Object))
  })

  it('scheduleRoundActivation activates after the remaining pre-round delay', () => {
    const { io } = buildIo()
    const startedAt = Date.now()
    const room = buildRound({
      phase: 'starting',
      serverStartTime: startedAt,
      activeStartTime: null,
      clueCount: 1
    })

    vi.setSystemTime(startedAt + 1_000)
    scheduleRoundActivation(io, room)

    vi.advanceTimersByTime(ROUND_START_DELAY_MS - 1_001)
    expect(room.currentRound!.phase).toBe('starting')

    vi.advanceTimersByTime(1)
    expect(room.currentRound!.phase).toBe('active')
    expect(room.currentRound!.activeStartTime).not.toBeNull()
    expect(room.currentRound!.timers.roundEnd).not.toBeNull()
  })

  it('rearmRoomTimers resumes clue reveals for an active round', () => {
    const { io, emit } = buildIo()
    const startedAt = Date.now()
    const room = buildRound({
      phase: 'active',
      activeStartTime: startedAt,
      revealedClueCount: 1
    })

    vi.setSystemTime(startedAt + 5_000)
    rearmRoomTimers(io, room)
    vi.advanceTimersByTime(0)

    expect(emit).toHaveBeenCalledWith('CLUE_REVEALED', {
      clue: { order: 2, text: 'Clue 2' }
    })
    expect(room.currentRound!.revealedClueCount).toBe(2)
  })

  it('rearmRoomTimers immediately ends a round whose deadline already passed', () => {
    const { io, emit } = buildIo()
    const startedAt = Date.now()
    const room = buildRound({
      phase: 'active',
      activeStartTime: startedAt,
      roundDuration: 10_000,
      clueCount: 1
    })

    vi.setSystemTime(startedAt + 12_000)
    rearmRoomTimers(io, room)
    vi.advanceTimersByTime(0)

    expect(room.currentRound!.phase).toBe('ended')
    expect(emit).toHaveBeenCalledWith('ROUND_ENDED', expect.any(Object))
  })
})

describe('scheduleClueReveals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-10T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules subsequent clues from activeStartTime', () => {
    const { io, emit } = buildIo()
    const room = buildRound()
    scheduleClueReveals(io, room)

    vi.advanceTimersByTime(4_999)
    expect(emit).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(emit).toHaveBeenCalledWith('CLUE_REVEALED', {
      clue: { order: 2, text: 'Clue 2' }
    })
  })
})
