import { Router } from 'express'
import { recordPlayCount, type PlayCountMetric } from '../analytics/playCounts.js'

const router = Router()

const MODES = ['classic', 'daily', 'endurance', 'review'] as const
const EVENTS = ['started', 'completed'] as const

type SoloMode = (typeof MODES)[number]
type SoloEvent = (typeof EVENTS)[number]

function soloMetric(mode: SoloMode, event: SoloEvent): PlayCountMetric {
  const modeName = mode.charAt(0).toUpperCase() + mode.slice(1)
  const eventName = event.charAt(0).toUpperCase() + event.slice(1)
  return `solo${modeName}${eventName}` as PlayCountMetric
}

/** Count one solo start or finish. Extra fields are ignored. */
router.post('/play-totals', (req, res) => {
  const mode = req.body?.mode
  const event = req.body?.event
  if (!MODES.includes(mode) || !EVENTS.includes(event)) {
    res.status(400).json({ error: 'mode and event are required' })
    return
  }
  recordPlayCount(soloMetric(mode, event))
  res.status(204).end()
})

export default router
