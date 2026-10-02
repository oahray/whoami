import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import MaintenanceBanner from '../components/MaintenanceBanner'
import SoundToggle from '../components/SoundToggle'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import { useStickToBottom } from '../hooks/useStickToBottom'
import { useVisualViewportLock } from '../hooks/useVisualViewportLock'
import { encodeDifficultySelection } from '../lib/difficultySelection'
import {
  saveDailyResult,
  type DailyProgress
} from '../lib/dailySolo'
import { validateGuess } from '../lib/guessValidation'
import {
  getInPersonCard,
  isLostCardError,
  prefetchInPersonCard,
  rememberCard
} from '../lib/inPersonCardFetch'
import {
  isMaintenanceBlockingNewGames,
  MAINTENANCE_SOLO_ENDED_COPY
} from '../lib/maintenance'
import {
  cardForCurrentSoloRound,
  clearSoloSession,
  continueEndurancePool,
  createSoloSession,
  formatSoloScore,
  formatSoloTime,
  listSoloRecords,
  loadSoloSession,
  saveSoloRecord,
  saveSoloSession,
  saveSoloSetupPreferences,
  shouldPrefetchNextSoloCard,
  soloRecordAverageClues,
  soloRecordFirstClueCorrectCount,
  soloSessionScore,
  type SoloRecord,
  type SoloRoundPerformance,
  type SoloScoreBreakdown,
  type SoloSession
} from '../lib/soloSession'
import { scoreSoloRound } from '../lib/soloScoring'
import { applyMasteryOutcome } from '../lib/soloMastery'
import { playSound } from '../lib/sounds'
import { API_BASE_URL } from '../lib/apiBase'
import type { InPersonCard } from '../types'

type RoundStatus = 'active' | 'correct' | 'timeout' | 'finished'

const ZERO_SCORE_BREAKDOWN: SoloScoreBreakdown = {
  score: 0,
  basePoints: 1000,
  cluePenalty: 0,
  timePenalty: 0,
  incorrectGuessPenalty: 0,
  bonusPoints: 0
}

function revealedCluesAt(
  session: Pick<SoloSession, 'roundDurationMs' | 'clueRevealIntervalMs'>,
  card: InPersonCard,
  elapsedMs: number
): number {
  return Math.min(
    card.clues.length,
    Math.max(1, 1 + Math.floor(elapsedMs / session.clueRevealIntervalMs))
  )
}

function scoreBreakdownLabel(breakdown: SoloScoreBreakdown): string {
  const penalties = [
    breakdown.cluePenalty > 0 ? `${formatSoloScore(breakdown.cluePenalty)} clues` : null,
    breakdown.timePenalty > 0 ? `${formatSoloScore(breakdown.timePenalty)} time` : null,
    breakdown.incorrectGuessPenalty > 0
      ? `${formatSoloScore(breakdown.incorrectGuessPenalty)} guesses`
      : null
  ].filter(Boolean)
  return penalties.length > 0
    ? `${formatSoloScore(breakdown.basePoints)} base − ${penalties.join(' − ')}`
    : `${formatSoloScore(breakdown.basePoints)} base`
}

function SoloGame() {
  const navigate = useNavigate()
  const [session, setSession] = useState<SoloSession | null>(null)
  const [card, setCard] = useState<InPersonCard | null>(null)
  const [status, setStatus] = useState<RoundStatus>('active')
  const [remainingMs, setRemainingMs] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    record: SoloRecord
    isPersonalBest: boolean
    endedByMaintenance?: boolean
    dailyProgress?: DailyProgress
  } | null>(null)
  const [restarting, setRestarting] = useState(false)
  const { status: maintenanceStatus } = useMaintenanceStatus({ poll: true })
  const maintenanceBlocking = isMaintenanceBlockingNewGames(maintenanceStatus)
  const roundStartedAt = useRef(0)
  const activeSession = useRef<SoloSession | null>(null)
  const guessInputRef = useRef<HTMLInputElement | null>(null)
  const advanceButtonRef = useRef<HTMLButtonElement | null>(null)
  const settlePanelRef = useRef<HTMLSectionElement | null>(null)
  const lastClueCountRef = useRef(0)
  const settledOnceRef = useRef(false)
  const viewportStyle = useVisualViewportLock()
  const viewportLocked = Object.keys(viewportStyle).length > 0

  const settledForScroll = status === 'correct' || status === 'timeout'
  const revealedCountForScroll =
    session && card
      ? Math.min(
          card.clues.length,
          1 + Math.floor((session.roundDurationMs - remainingMs) / session.clueRevealIntervalMs)
        )
      : 0
  const { ref: cluesScrollRef, onScroll: onCluesScroll, resetStick } = useStickToBottom<HTMLElement>([
    revealedCountForScroll,
    settledForScroll,
    loading
  ])

  const cardQuery = useCallback((nextSession: SoloSession) => ({
    datasetId: nextSession.datasetId,
    difficulty: encodeDifficultySelection(nextSession.difficulty),
    entityType: nextSession.entityType
  }), [])

  const loadCard = useCallback(async (nextSession: SoloSession, opts?: { freshRound?: boolean }) => {
    const entityId = nextSession.entityIds[nextSession.index]
    if (!entityId) return null
    const freshRound = opts?.freshRound ?? !nextSession.roundStartedAt
    setLoading(true)
    setError(null)
    setCard(null)
    setGuess('')
    setFeedback(null)
    lastClueCountRef.current = 0
    try {
      const storedCard = cardForCurrentSoloRound(nextSession)
      const loadedCard = storedCard ?? await getInPersonCard(entityId, cardQuery(nextSession))
      rememberCard(nextSession.datasetId, entityId, loadedCard)
      setCard(loadedCard)

      const startedAt = freshRound ? Date.now() : (nextSession.roundStartedAt as number)
      roundStartedAt.current = startedAt
      const restoredStatus = nextSession.roundStatus
      const settledRound =
        !freshRound && (restoredStatus === 'correct' || restoredStatus === 'timeout')
      const remaining = settledRound && nextSession.roundRemainingMs != null
        ? nextSession.roundRemainingMs
        : Math.max(0, nextSession.roundDurationMs - (Date.now() - startedAt))
      const expiredOnRestore = !freshRound && !settledRound && remaining === 0
      const restoredTimeoutPerformance: SoloRoundPerformance | null = expiredOnRestore
        ? {
            entityId: loadedCard.entity.id,
            correct: false,
            revealedClueCount: revealedCluesAt(
              nextSession,
              loadedCard,
              nextSession.roundDurationMs
            ),
            incorrectGuessCount: nextSession.currentIncorrectGuessCount ?? 0,
            elapsedMs: nextSession.roundDurationMs,
            score: 0,
            breakdown: ZERO_SCORE_BREAKDOWN
          }
        : null
      const restoredMasteryChange = restoredTimeoutPerformance
        ? applyMasteryOutcome({
            eventId: `${nextSession.datasetId}:${loadedCard.entity.id}:${startedAt}`,
            datasetId: nextSession.datasetId,
            entityId: loadedCard.entity.id,
            entityName: loadedCard.entity.name,
            correct: false,
            revealedClueCount: restoredTimeoutPerformance.revealedClueCount
          })
        : null
      setRemainingMs(remaining)

      if (settledRound) {
        settledOnceRef.current = true
        setStatus(restoredStatus)
      } else if (!freshRound && remaining === 0) {
        settledOnceRef.current = true
        setStatus('timeout')
      } else {
        settledOnceRef.current = false
        setStatus('active')
      }

      lastClueCountRef.current = Math.min(
        loadedCard.clues.length,
        Math.max(
          1,
          1 + Math.floor((nextSession.roundDurationMs - remaining) / nextSession.clueRevealIntervalMs)
        )
      )

      const withRound: SoloSession = {
        ...nextSession,
        currentCard: loadedCard,
        roundStartedAt: startedAt,
        roundRemainingMs: settledRound ? remaining : null,
        roundStatus:
          settledRound
            ? restoredStatus
            : remaining === 0 && !freshRound
              ? 'timeout'
              : 'active',
        currentIncorrectGuessCount: freshRound
          ? 0
          : (nextSession.currentIncorrectGuessCount ?? 0),
        settledRoundPerformance: freshRound
          ? null
          : (nextSession.settledRoundPerformance ?? restoredTimeoutPerformance),
        settledMasteryChange: freshRound
          ? null
          : (nextSession.settledMasteryChange ?? restoredMasteryChange)
      }
      activeSession.current = withRound
      setSession(withRound)
      saveSoloSession(withRound)
      return null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card')
      return err
    } finally {
      setLoading(false)
    }
  }, [cardQuery])

  useEffect(() => {
    const stored = loadSoloSession()
    if (!stored) {
      navigate('/solo', { replace: true })
      return
    }
    setSession(stored)
    activeSession.current = stored
    void loadCard(stored)
  }, [navigate, loadCard])

  const finishRun = useCallback((completed: SoloSession, opts?: { endedByMaintenance?: boolean }) => {
    const record: SoloRecord = {
      datasetId: completed.datasetId,
      difficulty: completed.difficulty,
      entityType: completed.entityType,
      variation: completed.variation,
      roundDurationMs: completed.roundDurationMs,
      clueRevealIntervalMs: completed.clueRevealIntervalMs,
      correctCount: completed.correctCount,
      activeElapsedMs: completed.activeElapsedMs,
      score: soloSessionScore(completed),
      rounds: completed.rounds ?? [],
      achievedAt: new Date().toISOString()
    }
    const saved =
      completed.variation === 'review'
        ? { record, isPersonalBest: false }
        : saveSoloRecord(record)
    const dailyProgress =
      completed.variation === 'daily' &&
      completed.dailyChallengeId &&
      completed.dailyDateKey
        ? saveDailyResult({
            challengeId: completed.dailyChallengeId,
            dateKey: completed.dailyDateKey,
            completedAt: record.achievedAt,
            record
          })
        : undefined
    clearSoloSession()
    setError(null)
    setStatus('finished')
    setResult({
      record,
      isPersonalBest: saved.isPersonalBest,
      endedByMaintenance: opts?.endedByMaintenance,
      dailyProgress
    })
    if (record.correctCount > 0) playSound('yay')
  }, [])

  const advance = useCallback(async (correct: boolean) => {
    const current = activeSession.current
    if (!current || status === 'finished') return
    const elapsed = Math.min(
      current.roundDurationMs,
      Math.max(0, Date.now() - roundStartedAt.current)
    )
    const performance: SoloRoundPerformance =
      current.settledRoundPerformance ?? {
        entityId: current.entityIds[current.index] ?? '',
        correct,
        revealedClueCount: current.currentCard
          ? revealedCluesAt(current, current.currentCard, elapsed)
          : 1,
        incorrectGuessCount: current.currentIncorrectGuessCount ?? 0,
        elapsedMs: elapsed,
        score: 0,
        breakdown: ZERO_SCORE_BREAKDOWN
      }
    let updated: SoloSession = {
      ...current,
      index: current.index + 1,
      correctCount: current.correctCount + (correct ? 1 : 0),
      activeElapsedMs: current.activeElapsedMs + performance.elapsedMs,
      score: soloSessionScore(current) + performance.score,
      rounds: [...(current.rounds ?? []), performance],
      currentIncorrectGuessCount: 0,
      settledRoundPerformance: null,
      settledMasteryChange: null
    }

    if (updated.variation === 'endurance' && !correct) {
      activeSession.current = updated
      setSession(updated)
      finishRun(updated)
      return
    }

    if (
      (updated.variation === 'challenge' ||
        updated.variation === 'daily' ||
        updated.variation === 'review') &&
      updated.index >= updated.entityIds.length
    ) {
      activeSession.current = updated
      setSession(updated)
      finishRun(updated)
      return
    }

    if (updated.variation === 'endurance' && updated.index >= updated.entityIds.length) {
      const lastEntityId = current.entityIds[current.index] ?? ''
      updated = continueEndurancePool(updated, lastEntityId)
    }

    activeSession.current = updated
    setSession(updated)
    saveSoloSession({
      ...updated,
      currentCard: null,
      roundStartedAt: null,
      roundRemainingMs: null,
      roundStatus: null,
      currentIncorrectGuessCount: 0,
      settledRoundPerformance: null,
      settledMasteryChange: null
    })
    playSound('card-flip')
    const loadError = await loadCard(
      {
        ...updated,
        currentCard: null,
        roundStartedAt: null,
        roundRemainingMs: null,
        roundStatus: null,
        currentIncorrectGuessCount: 0,
        settledRoundPerformance: null,
        settledMasteryChange: null
      },
      { freshRound: true }
    )
    if (loadError && isLostCardError(loadError)) {
      finishRun(updated, { endedByMaintenance: true })
    }
  }, [finishRun, loadCard, status])

  const nextPrefetchId =
    session && shouldPrefetchNextSoloCard(session, status)
      ? session.entityIds[session.index + 1] ?? null
      : null

  useEffect(() => {
    if (!nextPrefetchId || !session) return
    prefetchInPersonCard(nextPrefetchId, cardQuery(session))
  }, [nextPrefetchId, session, cardQuery])

  useEffect(() => {
    if (!session || !card || status !== 'active' || loading) return
    let interval = 0
    const tick = (): boolean => {
      const next = Math.max(0, session.roundDurationMs - (Date.now() - roundStartedAt.current))
      setRemainingMs(next)
      if (next > 0) return false
      window.clearInterval(interval)
      if (settledOnceRef.current) return true
      settledOnceRef.current = true
      setStatus('timeout')
      playSound('uh-oh')
      const current = activeSession.current
      if (current) {
        const performance: SoloRoundPerformance = {
          entityId: card.entity.id,
          correct: false,
          revealedClueCount: revealedCluesAt(
            current,
            card,
            current.roundDurationMs
          ),
          incorrectGuessCount: current.currentIncorrectGuessCount ?? 0,
          elapsedMs: current.roundDurationMs,
          score: 0,
          breakdown: ZERO_SCORE_BREAKDOWN
        }
        const settled = {
          ...current,
          roundStatus: 'timeout' as const,
          roundRemainingMs: 0,
          settledRoundPerformance: performance,
          settledMasteryChange: applyMasteryOutcome({
            eventId: `${current.datasetId}:${card.entity.id}:${roundStartedAt.current}`,
            datasetId: current.datasetId,
            entityId: card.entity.id,
            entityName: card.entity.name,
            correct: false,
            revealedClueCount: performance.revealedClueCount
          })
        }
        activeSession.current = settled
        setSession(settled)
        saveSoloSession(settled)
      }
      return true
    }
    if (tick()) return
    interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [session, card, status, loading])

  useEffect(() => {
    if (!session || !card || status !== 'active' || loading) return
    const revealedCount = Math.min(
      card.clues.length,
      1 + Math.floor((session.roundDurationMs - remainingMs) / session.clueRevealIntervalMs)
    )
    if (revealedCount > lastClueCountRef.current) {
      if (lastClueCountRef.current > 0) playSound('clue-pop')
      lastClueCountRef.current = revealedCount
    }
  }, [session, card, status, loading, remainingMs])

  useEffect(() => {
    if (status !== 'active' || loading || !card) return
    guessInputRef.current?.focus({ preventScroll: true })
  }, [status, loading, card?.entity.id])

  useEffect(() => {
    if (status !== 'correct' && status !== 'timeout') return

    // Focus the CTA so Enter activates it natively; also handle Enter if focus
    // landed elsewhere (e.g. body after the guess field unmounted).
    advanceButtonRef.current?.focus({ preventScroll: true })
    settlePanelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.repeat) {
        return
      }
      const target = event.target
      if (target instanceof HTMLTextAreaElement) return
      if (
        target instanceof HTMLInputElement &&
        target.type !== 'button' &&
        target.type !== 'submit' &&
        target.type !== 'reset'
      ) {
        return
      }
      if (
        target === advanceButtonRef.current ||
        document.activeElement === advanceButtonRef.current
      ) {
        // Let the focused button's native Enter → click path run alone.
        return
      }
      event.preventDefault()
      void advance(status === 'correct')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, card?.entity.id, advance])

  useEffect(() => {
    resetStick()
  }, [card?.entity.id, resetStick])

  const tryAgain = async () => {
    if (!session || restarting || maintenanceBlocking) return
    setRestarting(true)
    setError(null)
    playSound('go')
    try {
      const query = new URLSearchParams({
        datasetId: session.datasetId,
        difficulty: encodeDifficultySelection(session.difficulty),
        entityType: session.entityType
      })
      const response = await fetch(`${API_BASE_URL}/cards/deck?${query}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to load cards (${response.status})`)
      }
      const { entityIds, scoringVersion, scoringRules } = (await response.json()) as {
        entityIds: string[]
        scoringVersion?: number
        scoringRules?: SoloSession['scoringRules']
      }
      const nextSession = createSoloSession(
        {
          datasetId: session.datasetId,
          difficulty: session.difficulty,
          entityType: session.entityType,
          variation: session.variation,
          roundDurationMs: session.roundDurationMs,
          clueRevealIntervalMs: session.clueRevealIntervalMs
        },
        entityIds,
        scoringVersion != null && scoringRules
          ? { version: scoringVersion, rules: scoringRules }
          : session.scoringVersion != null && session.scoringRules
            ? { version: session.scoringVersion, rules: session.scoringRules }
            : undefined
      )
      saveSoloSession(nextSession)
      activeSession.current = nextSession
      setSession(nextSession)
      setResult(null)
      saveSoloSetupPreferences({
        datasetId: nextSession.datasetId,
        difficulty: nextSession.difficulty,
        entityType: nextSession.entityType,
        variation: nextSession.variation,
        roundDurationMs: nextSession.roundDurationMs,
        clueRevealIntervalMs: nextSession.clueRevealIntervalMs
      })
      await loadCard(
        { ...nextSession, roundStartedAt: null, roundRemainingMs: null, roundStatus: null },
        { freshRound: true }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart')
    } finally {
      setRestarting(false)
    }
  }

  const submitGuess = () => {
    if (!card || status !== 'active' || !guess.trim()) return
    if (!validateGuess(guess, card.entity.name, card.entity.aliases)) {
      setFeedback('Not quite. Keep trying.')
      setGuess('')
      const current = activeSession.current
      if (current) {
        const updated = {
          ...current,
          currentIncorrectGuessCount:
            (current.currentIncorrectGuessCount ?? 0) + 1
        }
        activeSession.current = updated
        setSession(updated)
        saveSoloSession(updated)
      }
      // Keep focus so the mobile keyboard stays open for the next try.
      guessInputRef.current?.focus({ preventScroll: true })
      return
    }
    setStatus('correct')
    settledOnceRef.current = true
    setFeedback('Correct!')
    playSound('correct')
    const current = activeSession.current
    if (current) {
      const elapsedMs = Math.min(
        current.roundDurationMs,
        Math.max(0, Date.now() - roundStartedAt.current)
      )
      const frozenRemainingMs = Math.max(
        0,
        current.roundDurationMs - elapsedMs
      )
      setRemainingMs(frozenRemainingMs)
      const pending = {
        ...current,
        roundStatus: 'correct' as const,
        roundRemainingMs: frozenRemainingMs
      }
      activeSession.current = pending
      setSession(pending)
      saveSoloSession(pending)

      const breakdown = scoreSoloRound(
        {
          correct: true,
          elapsedMs,
          revealedClueCount: revealedCluesAt(current, card, elapsedMs),
          incorrectGuessCount: current.currentIncorrectGuessCount ?? 0
        },
        current.scoringRules
      )

      const performance: SoloRoundPerformance = {
        entityId: card.entity.id,
        correct: true,
        revealedClueCount: revealedCluesAt(current, card, elapsedMs),
        incorrectGuessCount: current.currentIncorrectGuessCount ?? 0,
        elapsedMs,
        score: breakdown.score,
        breakdown
      }
      const settled = {
        ...pending,
        settledRoundPerformance: performance,
        settledMasteryChange: applyMasteryOutcome({
          eventId: `${current.datasetId}:${card.entity.id}:${roundStartedAt.current}`,
          datasetId: current.datasetId,
          entityId: card.entity.id,
          entityName: card.entity.name,
          correct: true,
          revealedClueCount: performance.revealedClueCount
        })
      }
      activeSession.current = settled
      setSession(settled)
      saveSoloSession(settled)
    }
  }

  if (result && session) {
    const heading =
      session.variation === 'daily'
        ? 'Daily challenge complete!'
        : session.variation === 'review'
          ? 'Review complete!'
        : session.variation === 'challenge'
          ? 'Challenge complete!'
          : 'Endurance complete!'
    const averageClues = soloRecordAverageClues(result.record)
    const firstClueCorrect = soloRecordFirstClueCorrectCount(result.record)
    const personalBestScore =
      session.variation === 'review'
        ? null
        : listSoloRecords(session.variation, session.datasetId)[0]?.score
    const isSingleAction =
      session.variation === 'daily' || session.variation === 'review'
    return (
      <div className="min-h-screen bg-app-bg font-display text-foreground flex items-end justify-center md:items-center p-0 md:p-6">
        <main className="w-full max-w-lg rounded-t-2xl border border-edge bg-surface p-6 text-center shadow-2xl md:rounded-2xl md:p-8">
          <MaintenanceBanner status={maintenanceStatus} />
          <span className="material-symbols-outlined text-5xl text-primary" aria-hidden>
            emoji_events
          </span>
          <div className="mt-3">
            <h1 className="text-2xl font-black">{heading}</h1>
            <p className="mt-1 text-foreground-muted">
              {session.variation === 'endurance'
                ? 'Your final streak'
                : session.variation === 'review'
                  ? 'Your review result'
                  : session.variation === 'daily'
                    ? 'Come back tomorrow for a new set'
                    : 'Your 10-round result'}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-primary/10 p-4">
              <p className="text-3xl font-black text-primary">
                {formatSoloScore(result.record.score ?? 0)}
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Score</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-4">
              <p className="text-3xl font-black">{result.record.correctCount}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Correct</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-4">
              <p className="text-3xl font-black">
                {averageClues == null ? '—' : averageClues.toFixed(1)}
              </p>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Avg clues</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-4">
              <p className="text-3xl font-black">{firstClueCorrect}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">First clue</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-foreground-muted">
            Active time: {formatSoloTime(result.record.activeElapsedMs)}
          </p>
          {result.isPersonalBest && (
            <p role="status" className="banner-success mt-4 font-semibold">
              New personal best on this device!
            </p>
          )}
          {result.dailyProgress && (
            <p role="status" className="banner-success mt-4 font-semibold">
              {result.dailyProgress.currentStreak}-day daily streak
              {result.dailyProgress.bestStreak > result.dailyProgress.currentStreak
                ? ` · Best ${result.dailyProgress.bestStreak}`
                : ''}
            </p>
          )}
          {!result.isPersonalBest &&
            personalBestScore != null &&
            session.variation !== 'daily' &&
            session.variation !== 'review' && (
            <p className="mt-3 text-sm text-foreground-muted">
              Personal best: {formatSoloScore(personalBestScore)} points.
            </p>
          )}
          {result.endedByMaintenance && (
            <p role="status" className="banner-warning mt-4">
              {MAINTENANCE_SOLO_ENDED_COPY}
            </p>
          )}
          {error && (
            <p role="alert" className="banner-danger mt-4">{error}</p>
          )}
          <div className={`mt-6 ${isSingleAction ? '' : 'grid grid-cols-2 gap-3'}`}>
            {isSingleAction ? (
              <Link
                to="/solo"
                className="flex w-full items-center justify-center rounded-lg bg-primary py-3.5 font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90"
              >
                Done
              </Link>
            ) : (
              <>
                <Link
                  to="/solo"
                  className="flex items-center justify-center rounded-lg border-2 border-edge py-3 font-semibold hover:bg-surface-muted"
                >
                  New setup
                </Link>
                <button
                  type="button"
                  onClick={() => void tryAgain()}
                  disabled={restarting || maintenanceBlocking}
                  className="rounded-lg bg-primary py-3 font-bold text-white shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
                >
                  {restarting ? 'Starting…' : 'Try again'}
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (!session) return <LoadingState label="Loading solo mode" layout="page" />

  const settled = status === 'correct' || status === 'timeout'
  const isLastChallengeRound =
    (session.variation === 'challenge' ||
      session.variation === 'daily' ||
      session.variation === 'review') &&
    session.index >= session.entityIds.length - 1
  const settleAdvanceLabel =
    (session.variation === 'endurance' && status !== 'correct') || isLastChallengeRound
      ? 'See results'
      : 'Next round'
  const revealedCount = card
    ? Math.min(card.clues.length, 1 + Math.floor((session.roundDurationMs - remainingMs) / session.clueRevealIntervalMs))
    : 0
  const visibleClues = card?.clues.slice(0, revealedCount) ?? []
  const settledPerformance = session.settledRoundPerformance ?? null
  const masteryChange = session.settledMasteryChange ?? null
  const masteryChangeLabel =
    masteryChange?.changed
      ? masteryChange.state === 'mastered'
        ? 'Mastered · solid recall'
        : masteryChange.state === 'needs_review'
          ? 'Needs review · tap Review on Solo setup'
          : 'Now learning · saved in Progress'
      : null
  const displayedScore =
    soloSessionScore(session) + (settledPerformance?.score ?? 0)

  const modeLabel =
    session.variation === 'daily'
      ? 'Daily challenge'
      : session.variation === 'review'
        ? 'Review'
        : session.variation === 'challenge'
          ? 'Solo challenge'
          : 'Endurance'
  const roundLabel =
    session.variation !== 'endurance'
      ? `Round ${Math.min(session.index + 1, session.entityIds.length)} of ${session.entityIds.length}`
      : `${session.correctCount} correct`
  const secondsLeft = Math.ceil(remainingMs / 1000)
  const timerProgressPct = Math.max(
    0,
    Math.min(100, (remainingMs / session.roundDurationMs) * 100)
  )
  const latestClueOrder = visibleClues[visibleClues.length - 1]?.order

  return (
    <div
      className={`bg-app-bg font-display text-foreground flex flex-col ${viewportLocked ? 'overflow-hidden' : 'min-h-dvh'} lg:min-h-screen`}
      style={viewportStyle}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col overflow-hidden bg-surface lg:max-w-7xl lg:bg-transparent lg:shadow-none">
        <header
          className="shrink-0 border-b border-primary/10 bg-surface/95 px-4 pb-2 backdrop-blur-sm lg:rounded-b-2xl lg:border lg:border-edge lg:px-8 lg:pb-3 lg:shadow-sm"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
        >
          <div className="flex items-center justify-between gap-3 pt-1 lg:pt-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                to="/solo"
                aria-label="Back to solo setup"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-none lg:text-lg">
                  {roundLabel}
                </h2>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary lg:text-xs">
                  {modeLabel}
                  <span className="text-primary/70">·</span>
                  {formatSoloScore(displayedScore)} pts
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <SoundToggle />
              <div className="flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-1.5">
                <span className="material-symbols-outlined text-base text-primary">timer</span>
                <div className="leading-tight">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-primary">Time</p>
                  <p className="text-base font-black text-foreground">{secondsLeft}s</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main
          className={`min-h-0 flex-1 px-3 py-3 md:px-6 md:py-6 lg:px-8 ${
            status === 'active'
              ? 'flex flex-col overflow-hidden lg:block lg:overflow-y-auto'
              : 'overflow-y-auto'
          }`}
        >
          <MaintenanceBanner status={maintenanceStatus} />
          {loading && <LoadingState label="Loading card" layout="page" />}
          {error && (
            <div className="mb-4 space-y-3">
              <p role="alert" className="banner-danger">{error}</p>
              <button
                type="button"
                onClick={() => void loadCard(session)}
                className="w-full rounded-lg border-2 border-edge py-3 font-semibold"
              >
                Try again
              </button>
            </div>
          )}

          <div
            className={`gap-4 lg:gap-6 ${
              status === 'active'
                ? 'flex min-h-0 flex-1 flex-col lg:grid lg:h-auto lg:flex-none lg:grid-cols-[minmax(0,1.8fr)_320px] xl:grid-cols-[minmax(0,2fr)_360px]'
                : 'grid lg:grid-cols-[minmax(0,1.8fr)_320px] xl:grid-cols-[minmax(0,2fr)_360px]'
            }`}
          >
            <div
              className={
                status === 'active'
                  ? 'flex min-h-0 flex-1 flex-col gap-2 lg:block lg:flex-none lg:space-y-6 lg:gap-0'
                  : 'space-y-4 lg:space-y-6'
              }
            >
              {card && !loading && (
                <section
                  className={
                    status === 'active'
                      ? 'flex min-h-0 flex-1 flex-col space-y-2 lg:block lg:flex-none lg:space-y-4'
                      : 'space-y-4'
                  }
                >
                  <div className="flex shrink-0 items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground lg:text-base">Current Clues</h3>
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {visibleClues.length} Revealed
                    </span>
                  </div>
                  <div
                    ref={cluesScrollRef}
                    onScroll={onCluesScroll}
                    className={`min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 lg:flex-none lg:space-y-3 ${
                      settled ? 'lg:max-h-[12rem]' : 'lg:max-h-[26rem]'
                    }`}
                  >
                    {visibleClues.map((clue) => {
                      const isLatest = clue.order === latestClueOrder && !settled
                      return (
                        <article
                          key={clue.order}
                          className={`rounded-lg border p-3 shadow-sm lg:p-5 ${
                            isLatest
                              ? 'border-primary/35 bg-primary/5 ring-1 ring-primary/10'
                              : 'border-edge bg-surface'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 lg:gap-4">
                            <div
                              className={`flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ${
                                isLatest ? 'size-10 lg:size-12' : 'size-9 lg:size-11'
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined ${
                                  isLatest ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'
                                }`}
                              >
                                auto_stories
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-widest ${
                                    isLatest ? 'text-primary' : 'text-foreground-muted'
                                  }`}
                                >
                                  Clue {clue.order}
                                  {isLatest ? ' · New' : ''}
                                </span>
                                {status === 'correct' && (
                                  <span className="material-symbols-outlined shrink-0 text-sm text-green-500">
                                    check_circle
                                  </span>
                                )}
                              </div>
                              <p
                                className={`font-medium leading-snug lg:leading-relaxed ${
                                  isLatest
                                    ? 'text-base text-foreground lg:text-lg'
                                    : 'text-sm text-foreground-muted lg:text-base'
                                }`}
                              >
                                {clue.text}
                              </p>
                              {status === 'correct' && clue.citations && (
                                <p className="mt-1 text-xs font-medium text-foreground-muted">
                                  {clue.citations}
                                </p>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )}

              {status === 'correct' && card && (
                <section
                  ref={settlePanelRef}
                  role="status"
                  aria-live="polite"
                  className="banner-success-emphasis shrink-0 p-3 text-center lg:p-3"
                >
                  <p className="text-sm font-semibold text-foreground">
                    <span className="material-symbols-outlined mr-1 align-middle text-base text-green-500">
                      check_circle
                    </span>
                    Correct!
                  </p>
                  <p className="mt-1 text-xl font-black text-foreground lg:text-2xl">
                    {card.entity.name}
                  </p>
                  {card.entity.aliases.length > 0 && (
                    <p className="mt-0.5 text-sm font-semibold text-foreground-muted">
                      {card.entity.aliases.join(', ')}
                    </p>
                  )}
                  {settledPerformance && (
                    <div className="mt-2 rounded-lg bg-surface-muted px-3 py-2 lg:mt-3 lg:py-3">
                      <p className="text-sm text-foreground">
                        Answered after {settledPerformance.revealedClueCount}{' '}
                        {settledPerformance.revealedClueCount === 1 ? 'clue' : 'clues'}
                        <span className="mx-1.5 text-foreground-muted">·</span>
                        <span className="font-black text-primary">
                          +{formatSoloScore(settledPerformance.score)} points
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-foreground-muted">
                        {scoreBreakdownLabel(settledPerformance.breakdown)}
                      </p>
                    </div>
                  )}
                  {masteryChangeLabel && (
                    <p className="mt-2 text-sm font-bold text-foreground lg:mt-3">
                      {masteryChangeLabel}
                    </p>
                  )}
                </section>
              )}

              {status === 'timeout' && card && (
                <section
                  ref={settlePanelRef}
                  role="status"
                  aria-live="polite"
                  className="banner-warning shrink-0 border-amber-300 p-3 text-center dark:border-amber-700"
                >
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Time&apos;s up
                  </p>
                  <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">
                    Answer hidden so you can practice it later.
                  </p>
                  <div className="mt-2 rounded-lg bg-surface-muted/80 px-3 py-2 dark:bg-black/15 lg:mt-3 lg:py-3">
                    <p className="text-lg font-black text-primary lg:text-2xl">+0 points</p>
                    <p className="mt-0.5 text-xs text-foreground-muted">Round timed out</p>
                  </div>
                  {masteryChangeLabel && (
                    <p className="mt-2 text-sm font-bold text-amber-950 dark:text-amber-50 lg:mt-3">
                      {masteryChangeLabel}
                    </p>
                  )}
                </section>
              )}
            </div>

            <aside className="hidden space-y-4 lg:block lg:space-y-6">
              <div className="rounded-2xl bg-primary p-6 text-white shadow-xl shadow-primary/20">
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                  Time remaining
                </p>
                <p className="mt-3 text-5xl font-black leading-none">{secondsLeft}s</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface/20">
                  <div
                    className="h-full rounded-full bg-surface/80 transition-all"
                    style={{ width: `${timerProgressPct}%` }}
                  />
                </div>
              </div>
              <section className="space-y-3 rounded-2xl border border-edge bg-surface p-5 shadow-sm">
                <h3 className="text-base font-bold text-foreground">Your score</h3>
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <span className="text-sm font-semibold">This run</span>
                  <span className="text-sm font-black text-primary">
                    {formatSoloScore(displayedScore)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
                  <span className="text-sm font-medium text-foreground-muted">Correct</span>
                  <span className="text-sm font-black text-foreground">
                    {session.correctCount + (status === 'correct' ? 1 : 0)}
                  </span>
                </div>
                {card && (
                  <div className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
                    <span className="text-sm font-medium text-foreground-muted">Clues</span>
                    <span className="text-sm font-black text-foreground">
                      {visibleClues.length} / {card.clues.length}
                    </span>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </main>

        {card && status === 'active' && (
          <div
            className="shrink-0 border-t border-edge bg-surface px-3 py-2 lg:px-8 lg:py-3"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {feedback && (
              <p
                role="status"
                aria-live="polite"
                className="banner-warning mx-auto mb-2 max-w-7xl px-3 py-2 text-center font-semibold"
              >
                {feedback}
              </p>
            )}
            <form
              className="mx-auto flex max-w-7xl gap-2 lg:gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                submitGuess()
              }}
            >
              <input
                ref={guessInputRef}
                id="solo-guess"
                type="text"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                aria-label="Your guess"
                placeholder="Enter your guess..."
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-muted px-3 py-3 text-base font-medium text-foreground placeholder:text-foreground-muted transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={!guess.trim()}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:px-6"
              >
                <span>Guess</span>
                <span className="material-symbols-outlined text-xl" aria-hidden>
                  send
                </span>
              </button>
            </form>
          </div>
        )}

        {card && settled && (
          <div
            className="shrink-0 border-t border-edge bg-surface px-3 py-2 lg:px-8 lg:py-3"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              ref={advanceButtonRef}
              type="button"
              onClick={() => void advance(status === 'correct')}
              className="mx-auto block w-full max-w-7xl rounded-lg bg-primary py-3 font-bold text-white hover:bg-primary/90"
            >
              {settleAdvanceLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SoloGame
