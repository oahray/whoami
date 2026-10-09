import { Router, Response } from 'express'
import { getPlayCountsForDay, utcPlayCountDate } from '../../analytics/playCounts.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

/** Historical play totals. This chunk serves the current UTC day only. */
router.get('/play-totals', async (req: AuthRequest, res: Response) => {
  const range = typeof req.query.range === 'string' ? req.query.range : 'today'
  if (range !== 'today') {
    res.status(400).json({ error: 'Only today is available' })
    return
  }

  const day = utcPlayCountDate()
  const counts = await getPlayCountsForDay(day)
  res.json({
    range: 'today',
    timeZone: 'UTC',
    day,
    multiplayer: {
      roomsCreated: counts.multiplayerRoomsCreated,
      gamesStarted: counts.multiplayerGamesStarted,
      gamesCompleted: counts.multiplayerGamesCompleted,
      abandonedBeforeStart: counts.multiplayerAbandonedBeforeStart,
      playerConnections: counts.multiplayerPlayerConnections
    },
    solo: {
      classic: { started: counts.soloClassicStarted, completed: counts.soloClassicCompleted },
      daily: { started: counts.soloDailyStarted, completed: counts.soloDailyCompleted },
      endurance: { started: counts.soloEnduranceStarted, completed: counts.soloEnduranceCompleted },
      review: { started: counts.soloReviewStarted, completed: counts.soloReviewCompleted }
    }
  })
})

export default router
