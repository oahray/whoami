import express from 'express'
import { adminAuth } from '../auth.js'
import entitiesRoutes from './entities.js'
import cluesRoutes from './clues.js'
import statsRoutes from './stats.js'
import liveRoutes from './live.js'
import bulkImportRoutes from './bulkImport.js'
import datasetsRoutes from './datasets.js'
import maintenanceRoutes from './maintenance.js'

const router = express.Router()

router.use(adminAuth)
router.use(datasetsRoutes)
router.use(maintenanceRoutes)
router.use(entitiesRoutes)
router.use(cluesRoutes)
router.use(statsRoutes)
router.use(liveRoutes)
router.use(bulkImportRoutes)

export default router
