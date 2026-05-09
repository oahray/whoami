import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

/**
 * Final-fallback Express error middleware. Each route already does its own
 * try/catch, but this catches anything that escapes (sync throws, an async
 * route that forgot a try/catch, `next(err)` calls) and prevents the default
 * Express HTML stack-trace response from leaking to clients.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error('Unhandled REST error', err, {
    method: req.method,
    path: req.path
  })

  if (res.headersSent) {
    return
  }

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  })
}
