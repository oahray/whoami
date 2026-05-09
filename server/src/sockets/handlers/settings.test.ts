import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../rooms/store.js', async () => {
  const actual = await vi.importActual<typeof import('../../rooms/store.js')>('../../rooms/store.js')
  return {
    ...actual,
    getRoomBySocket: vi.fn()
  }
})

vi.mock('../../db/entities.js', () => ({
  getDataset: vi.fn()
}))

import { createRoom, getRoomBySocket } from '../../rooms/store.js'
import { handleUpdateSettings } from './settings.js'
import { getDataset } from '../../db/entities.js'

describe('handleUpdateSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets a finished room and applies new settings for the host', async () => {
    const room = createRoom('host-socket', 'Host')
    const emitToRoom = vi.fn()
    const io = {
      to: vi.fn(() => ({ emit: emitToRoom }))
    } as any
    const socket = {
      id: 'host-socket',
      emit: vi.fn()
    } as any

    room.status = 'finished'
    room.currentRound = {
      roundNumber: 3,
      entity: {
        id: 'entity-1',
        name: 'Moses',
        type: 'character',
        is_published: true
      },
      clues: [],
      phase: 'ended',
      serverStartTime: Date.now(),
      correctGuesses: [],
      timers: {
        clueReveal: null,
        roundEnd: null
      }
    }
    room.roundHistory = [{ roundNumber: 1 }]
    room.entityPool = [{ id: 'entity-1', name: 'Moses', type: 'character', is_published: true }]
    room.usedEntityIds.add('entity-1')
    room.scores.set('host-socket', 900)
    room.finalScoreboard = [{ playerId: 'host-socket', nickname: 'Host', score: 900 }]

    const host = room.players.get('host-socket')!
    host.guessCount = 4
    host.lastGuessAt = Date.now()
    host.isLocked = true

    vi.mocked(getRoomBySocket).mockReturnValue(room)

    await handleUpdateSettings(io, socket, {
      strictMode: true,
      totalRounds: 6
    })

    expect(room.status).toBe('waiting')
    expect(room.currentRound).toBeNull()
    expect(room.roundHistory).toEqual([])
    expect(room.entityPool).toEqual([])
    expect(room.usedEntityIds.size).toBe(0)
    expect(room.scores.size).toBe(0)
    expect(room.finalScoreboard).toBeUndefined()
    expect(host.guessCount).toBe(0)
    expect(host.lastGuessAt).toBeNull()
    expect(host.isLocked).toBe(false)
    expect(room.settings.strictMode).toBe(true)
    expect(room.settings.totalRounds).toBe(6)
    expect(io.to).toHaveBeenCalledWith(room.code)
    expect(emitToRoom).toHaveBeenCalledWith('SETTINGS_UPDATED', room.settings)
    expect(socket.emit).not.toHaveBeenCalledWith(
      'ROOM_ERROR',
      expect.objectContaining({ code: 'GAME_IN_PROGRESS' })
    )
  })

  it('rejects updates while a game is still in progress', async () => {
    const room = createRoom('host-socket', 'Host')
    const io = {
      to: vi.fn(() => ({ emit: vi.fn() }))
    } as any
    const socket = {
      id: 'host-socket',
      emit: vi.fn()
    } as any

    room.status = 'in_progress'
    vi.mocked(getRoomBySocket).mockReturnValue(room)

    await handleUpdateSettings(io, socket, {
      strictMode: true
    })

    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'GAME_IN_PROGRESS',
      message: 'Cannot update settings during game'
    })
  })

  it('applies datasetId when the dataset exists and is enabled', async () => {
    const room = createRoom('host-socket', 'Host')
    const emitToRoom = vi.fn()
    const io = { to: vi.fn(() => ({ emit: emitToRoom })) } as any
    const socket = { id: 'host-socket', emit: vi.fn() } as any

    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(getDataset).mockResolvedValue({
      id: 'ds-bible',
      name: 'Bible',
      source: null,
      description: null,
      is_official: true,
      is_enabled: true,
      is_default: true
    } as any)

    await handleUpdateSettings(io, socket, { datasetId: 'ds-bible' })

    expect(room.settings.datasetId).toBe('ds-bible')
    expect(emitToRoom).toHaveBeenCalledWith('SETTINGS_UPDATED', room.settings)
    expect(socket.emit).not.toHaveBeenCalledWith('ROOM_ERROR', expect.anything())
  })

  it('rejects datasetId when the dataset is disabled', async () => {
    const room = createRoom('host-socket', 'Host')
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) } as any
    const socket = { id: 'host-socket', emit: vi.fn() } as any

    vi.mocked(getRoomBySocket).mockReturnValue(room)
    vi.mocked(getDataset).mockResolvedValue({
      id: 'ds-disabled',
      name: 'Old',
      source: null,
      description: null,
      is_official: false,
      is_enabled: false,
      is_default: false
    } as any)

    await handleUpdateSettings(io, socket, { datasetId: 'ds-disabled' })

    expect(room.settings.datasetId).toBeNull()
    expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
      code: 'DATASET_DISABLED',
      message: 'Selected dataset is disabled'
    })
  })
})
