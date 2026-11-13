import express, { type RequestHandler } from 'express'
import { BULK_IMPORT_JSON_BODY_LIMIT, DEFAULT_JSON_BODY_LIMIT } from '../config/bodyLimits.js'

const defaultParser = express.json({ limit: DEFAULT_JSON_BODY_LIMIT })

/**
 * Skips the bulk import route, which parses its own larger body inside the admin router
 * after adminAuth, so an anonymous request cannot make the server read 20 MB.
 */
export const jsonBody: RequestHandler = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/admin/bulk-import') return next()
  return defaultParser(req, res, next)
}

export const bulkImportJsonBody = express.json({ limit: BULK_IMPORT_JSON_BODY_LIMIT })
