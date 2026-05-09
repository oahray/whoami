import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { wrapSync, wrapAsync, safeTimer } from './dispatch.js'
import { logger } from '../utils/logger.js'

function makeFakeSocket() {
  return {
    id: 's-test',
    emit: vi.fn()
  } as any
}

const fakeIo = {} as any

describe('socket dispatch wrappers', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('wrapSync', () => {
    it('forwards args to the handler when no error is thrown', () => {
      const handler = vi.fn()
      const dispatched = wrapSync('TEST_EVENT', handler)
      const socket = makeFakeSocket()

      dispatched(fakeIo, socket, { foo: 'bar' })

      expect(handler).toHaveBeenCalledWith(fakeIo, socket, { foo: 'bar' })
      expect(socket.emit).not.toHaveBeenCalled()
    })

    it('emits ROOM_ERROR and logs when handler throws', () => {
      const handler = vi.fn(() => {
        throw new Error('kaboom')
      })
      const dispatched = wrapSync('TEST_EVENT', handler)
      const socket = makeFakeSocket()

      dispatched(fakeIo, socket, {})

      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('unexpected error')
      })
      expect(logger.error).toHaveBeenCalled()
    })

    it('does not emit when silent: true', () => {
      const handler = vi.fn(() => {
        throw new Error('quiet')
      })
      const dispatched = wrapSync('LEAVE_ROOM', handler, { silent: true })
      const socket = makeFakeSocket()

      dispatched(fakeIo, socket, {})

      expect(socket.emit).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('wrapAsync', () => {
    it('awaits async handlers and does not emit on success', async () => {
      const handler = vi.fn(async () => {})
      const dispatched = wrapAsync('TEST_EVENT', handler)
      const socket = makeFakeSocket()

      dispatched(fakeIo, socket, { foo: 'bar' })
      await vi.waitFor(() => expect(handler).toHaveBeenCalled())

      expect(socket.emit).not.toHaveBeenCalled()
    })

    it('emits ROOM_ERROR when async handler rejects', async () => {
      const handler = vi.fn(async () => {
        throw new Error('async-boom')
      })
      const dispatched = wrapAsync('TEST_EVENT', handler)
      const socket = makeFakeSocket()

      dispatched(fakeIo, socket, {})

      await vi.waitFor(() => expect(socket.emit).toHaveBeenCalled())
      expect(socket.emit).toHaveBeenCalledWith('ROOM_ERROR', {
        code: 'INTERNAL_ERROR',
        message: expect.any(String)
      })
      expect(logger.error).toHaveBeenCalled()
    })

    it('also catches sync throws inside an async handler', async () => {
      const handler: any = () => {
        throw new Error('sync-throw-from-async')
      }
      const dispatched = wrapAsync('TEST_EVENT', handler)
      const socket = makeFakeSocket()

      dispatched(fakeIo, socket, {})

      await vi.waitFor(() => expect(socket.emit).toHaveBeenCalled())
    })
  })

  describe('safeTimer', () => {
    it('runs the callback and swallows errors', () => {
      expect(() =>
        safeTimer('test', () => {
          throw new Error('timer-boom')
        })
      ).not.toThrow()
      expect(logger.error).toHaveBeenCalled()
    })

    it('runs the callback and does not log on success', () => {
      const fn = vi.fn()
      safeTimer('test', fn)
      expect(fn).toHaveBeenCalledOnce()
      expect(logger.error).not.toHaveBeenCalled()
    })
  })
})
