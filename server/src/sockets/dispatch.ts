import type { Server, Socket } from 'socket.io'
import { logger } from '../utils/logger.js'

/**
 * Outer safety net for socket event handlers. Each handler already does its
 * own `try/catch`, so this only fires for unexpected regressions (a handler
 * file accidentally throws before its own catch runs, or an async handler's
 * promise rejects). The goal: never crash the Node process and always tell
 * the client *something* friendly.
 */

type SyncHandler = (io: Server, socket: Socket, payload: any) => void
type AsyncHandler = (io: Server, socket: Socket, payload: any) => Promise<void>

interface DispatchOptions {
  /**
   * If true, errors are logged but no `ROOM_ERROR` is emitted to the client.
   * Use for events like LEAVE_ROOM/disconnect where there is nothing
   * meaningful to tell the user.
   */
  silent?: boolean
}

function emitFallbackError(socket: Socket, eventName: string) {
  socket.emit('ROOM_ERROR', {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again.'
  })

  // Tag this as the outer net firing so it's distinguishable from the
  // per-handler catch in production logs.
  logger.warn('Outer dispatch safety net fired', {
    eventName,
    socketId: socket.id
  })
}

export function wrapSync(
  eventName: string,
  handler: SyncHandler,
  options: DispatchOptions = {}
): (io: Server, socket: Socket, payload?: any) => void {
  return (io, socket, payload) => {
    try {
      handler(io, socket, payload)
    } catch (error) {
      logger.error(`Unhandled error in ${eventName}`, error, { socketId: socket.id })
      if (!options.silent) {
        emitFallbackError(socket, eventName)
      }
    }
  }
}

export function wrapAsync(
  eventName: string,
  handler: AsyncHandler,
  options: DispatchOptions = {}
): (io: Server, socket: Socket, payload?: any) => void {
  return (io, socket, payload) => {
    Promise.resolve()
      .then(() => handler(io, socket, payload))
      .catch((error) => {
        logger.error(`Unhandled async error in ${eventName}`, error, { socketId: socket.id })
        if (!options.silent) {
          emitFallbackError(socket, eventName)
        }
      })
  }
}

/**
 * Wrap a `setTimeout` callback so its errors are logged instead of crashing
 * the Node event loop. Useful for the deferred round-state work scheduled
 * from `handleStartGame`, `handleDisconnect`, and `broadcastRoundEnd`.
 */
export function safeTimer(name: string, fn: () => void) {
  try {
    fn()
  } catch (error) {
    logger.error(`Unhandled error in timer ${name}`, error)
  }
}
