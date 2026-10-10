import { Router } from 'express'
import { recordPlayCount, type PlayCountMetric } from '../analytics/playCounts.js'

const router = Router()

const MODES = ['classic', 'daily', 'endurance', 'review'] as const
const EVENTS = ['started', 'completed'] as const
const PASS_EVENTS = ['started', 'loaded'] as const

type SoloMode = (typeof MODES)[number]
type SoloEvent = (typeof EVENTS)[number]

function soloMetric(mode: SoloMode, event: SoloEvent): PlayCountMetric {
  const modeName = mode.charAt(0).toUpperCase() + mode.slice(1)
  const eventName = event.charAt(0).toUpperCase() + event.slice(1)
  return `solo${modeName}${eventName}` as PlayCountMetric
}

/** Count one solo start or finish, or one pass & play start. Extra fields are ignored. */
router.post('/play-totals', (req, res) => {
  const mode = req.body?.mode
  const event = req.body?.event
  if (mode === 'pass') {
    if (!PASS_EVENTS.includes(event)) {
      res.status(400).json({ error: 'mode and event are required' })
      return
    }
    recordPlayCount(event === 'started' ? 'passAndPlayStarted' : 'passAndPlayCharactersLoaded')
    res.status(204).end()
    return
  }
  if (!MODES.includes(mode) || !EVENTS.includes(event)) {
    res.status(400).json({ error: 'mode and event are required' })
    return
  }
  recordPlayCount(soloMetric(mode, event))
  res.status(204).end()
})

export default router
