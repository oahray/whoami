import { Router, Response } from 'express'
import { getPlayCountsForRange, parsePlayCountRange } from '../../analytics/playCountRange.js'
import type { PlayCounts } from '../../analytics/playCounts.js'
import type { AuthRequest } from '../auth.js'

const router = Router()

function present(counts: PlayCounts) {
  return {
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
    },
    passAndPlay: {
      gamesStarted: counts.passAndPlayStarted,
      charactersLoaded: counts.passAndPlayCharactersLoaded
    }
  }
}

/** Historical play totals. Today is live. Longer ranges add closed days. */
router.get('/play-totals', async (req: AuthRequest, res: Response) => {
  const raw = typeof req.query.range === 'string' ? req.query.range : 'today'
  const range = parsePlayCountRange(raw)
  if (!range) {
    res.status(400).json({ error: 'Range must be today, yesterday, week, month, or all' })
    return
  }

  const { span, counts } = await getPlayCountsForRange(range)
  res.set('Cache-Control', 'no-store')
  res.json({
    range,
    timeZone: 'UTC',
    from: span.from,
    to: span.to,
    day: span.to,
    ...present(counts)
  })
})

export default router
