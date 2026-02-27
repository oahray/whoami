import express from 'express'
import { adminAuth } from '../auth.js'
import entitiesRoutes from './entities.js'
import cluesRoutes from './clues.js'
import statsRoutes from './stats.js'

const router = express.Router()

router.use(adminAuth)
router.use(entitiesRoutes)
router.use(cluesRoutes)
router.use(statsRoutes)

export default router
