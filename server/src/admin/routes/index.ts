import express from 'express'
import { adminAuth } from '../auth.js'
import { clearContentCache } from '../../game/contentCache.js'
import entitiesRoutes from './entities.js'
import cluesRoutes from './clues.js'
import statsRoutes from './stats.js'
import liveRoutes from './live.js'
import playTotalsRoutes from './playTotals.js'
import bulkImportRoutes from './bulkImport.js'
import datasetsRoutes from './datasets.js'
import maintenanceRoutes from './maintenance.js'

const router = express.Router()

router.use(adminAuth)
// Content edits show up straight away instead of after the public cache expires.
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode < 400) clearContentCache()
    })
  }
  next()
})
router.use(datasetsRoutes)
router.use(maintenanceRoutes)
router.use(entitiesRoutes)
router.use(cluesRoutes)
router.use(statsRoutes)
router.use(liveRoutes)
router.use(playTotalsRoutes)
router.use(bulkImportRoutes)

export default router
