import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import MaintenanceBanner from '../components/MaintenanceBanner'
import SoundToggle from '../components/SoundToggle'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import { useStickToBottom } from '../hooks/useStickToBottom'
import { useVisualViewportLock } from '../hooks/useVisualViewportLock'
import { encodeDifficultySelection } from '../lib/difficultySelection'
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
  formatSoloTime,
  listSoloRecords,
  loadSoloSession,
  saveSoloRecord,
  saveSoloSession,
  saveSoloSetupPreferences,
  shouldPrefetchNextSoloCard,
  type SoloRecord,
  type SoloSession
} from '../lib/soloSession'
import { playSound } from '../lib/sounds'
import { API_BASE_URL } from '../lib/apiBase'
import type { InPersonCard } from '../types'

type RoundStatus = 'active' | 'correct' | 'timeout' | 'finished'

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
  } | null>(null)
  const [restarting, setRestarting] = useState(false)
  const { status: maintenanceStatus } = useMaintenanceStatus({ poll: true })
  const maintenanceBlocking = isMaintenanceBlockingNewGames(maintenanceStatus)
  const roundStartedAt = useRef(0)
  const activeSession = useRef<SoloSession | null>(null)
  const guessInputRef = useRef<HTMLInputElement | null>(null)
  const advanceButtonRef = useRef<HTMLButtonElement | null>(null)
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
              : 'active'
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
      achievedAt: new Date().toISOString()
    }
    const saved = saveSoloRecord(record)
    clearSoloSession()
    setError(null)
    setStatus('finished')
    setResult({
      record,
      isPersonalBest: saved.isPersonalBest,
      endedByMaintenance: opts?.endedByMaintenance
    })
    if (record.correctCount > 0) playSound('yay')
  }, [])

  const advance = useCallback(async (correct: boolean) => {
    const current = activeSession.current
    if (!current || status === 'finished') return
    const elapsed = Math.min(current.roundDurationMs, Math.max(0, Date.now() - roundStartedAt.current))
    let updated: SoloSession = {
      ...current,
      index: current.index + 1,
      correctCount: current.correctCount + (correct ? 1 : 0),
      activeElapsedMs: current.activeElapsedMs + elapsed
    }

    if (updated.variation === 'endurance' && !correct) {
      activeSession.current = updated
      setSession(updated)
      finishRun(updated)
      return
    }

    if (updated.variation === 'challenge' && updated.index >= updated.entityIds.length) {
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
      roundStatus: null
    })
    playSound('card-flip')
    const loadError = await loadCard(
      {
        ...updated,
        currentCard: null,
        roundStartedAt: null,
        roundRemainingMs: null,
        roundStatus: null
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
        const settled = { ...current, roundStatus: 'timeout' as const, roundRemainingMs: 0 }
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
      const { entityIds } = (await response.json()) as { entityIds: string[] }
      const nextSession = createSoloSession(
        {
          datasetId: session.datasetId,
          difficulty: session.difficulty,
          entityType: session.entityType,
          variation: session.variation,
          roundDurationMs: session.roundDurationMs,
          clueRevealIntervalMs: session.clueRevealIntervalMs
        },
        entityIds
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
      const frozenRemainingMs = Math.max(
        0,
        current.roundDurationMs - (Date.now() - roundStartedAt.current)
      )
      setRemainingMs(frozenRemainingMs)
      const settled = {
        ...current,
        roundStatus: 'correct' as const,
        roundRemainingMs: frozenRemainingMs
      }
      activeSession.current = settled
      setSession(settled)
      saveSoloSession(settled)
    }
  }

  if (result && session) {
    const heading = session.variation === 'challenge' ? 'Challenge complete!' : 'Endurance complete!'
    return (
      <div className="min-h-screen bg-app-bg font-display text-foreground flex items-center justify-center p-4">
        <main className="w-full max-w-lg rounded-xl border border-edge bg-surface p-6 text-center shadow-sm space-y-5">
          <MaintenanceBanner status={maintenanceStatus} />
          <span className="material-symbols-outlined text-5xl text-primary">emoji_events</span>
          <div>
            <h1 className="text-2xl font-black">{heading}</h1>
            <p className="mt-1 text-foreground-muted">{session.variation === 'challenge' ? 'Your 10-round result' : 'Your final streak'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary/10 p-4"><p className="text-3xl font-black text-primary">{result.record.correctCount}</p><p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Correct</p></div>
            <div className="rounded-lg bg-surface-muted p-4"><p className="text-3xl font-black">{formatSoloTime(result.record.activeElapsedMs)}</p><p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Active time</p></div>
          </div>
          {result.isPersonalBest && (
            <p role="status" className="banner-success font-semibold">
              New personal best on this device!
            </p>
          )}
          {!result.isPersonalBest && (
            <p className="text-sm text-foreground-muted">
              Personal best: {listSoloRecords(session.variation, session.datasetId)[0]?.correctCount ?? 0} correct.
            </p>
          )}
          {result.endedByMaintenance && (
            <p role="status" className="banner-warning">
              {MAINTENANCE_SOLO_ENDED_COPY}
            </p>
          )}
          {error && (
            <p role="alert" className="banner-danger">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/solo" className="rounded-lg border-2 border-edge py-3 font-semibold">
              New setup
            </Link>
            <button
              type="button"
              onClick={() => void tryAgain()}
              disabled={restarting || maintenanceBlocking}
              className="rounded-lg bg-primary py-3 font-bold text-white disabled:opacity-50"
            >
              {restarting ? 'Starting…' : 'Try again'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!session) return <LoadingState label="Loading solo mode" layout="page" />

  const settled = status === 'correct' || status === 'timeout'
  const settleAdvanceLabel =
    session.variation === 'endurance' && status !== 'correct' ? 'See results' : 'Next round'
  const revealedCount = card
    ? Math.min(card.clues.length, 1 + Math.floor((session.roundDurationMs - remainingMs) / session.clueRevealIntervalMs))
    : 0
  const visibleClues = card?.clues.slice(0, revealedCount) ?? []

  return (
    <div
      className={`bg-app-bg font-display text-foreground flex flex-col overflow-hidden ${viewportLocked ? '' : 'min-h-dvh'}`}
      style={viewportStyle}
    >
      <header className="shrink-0 border-b border-edge bg-surface px-3 py-2">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/solo" aria-label="Back to solo setup" className="flex size-10 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated"><span className="material-symbols-outlined">arrow_back</span></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{session.variation === 'challenge' ? 'Solo challenge' : 'Endurance'}</p>
            <p className="text-sm font-bold">{session.variation === 'challenge' ? `Round ${Math.min(session.index + 1, 10)} of 10` : `${session.correctCount} correct`}</p>
          </div>
          <div className="rounded-lg bg-primary/10 px-3 py-1 text-right"><p className="text-[10px] font-bold uppercase text-primary">Time</p><p className="font-black">{Math.ceil(remainingMs / 1000)}s</p></div>
          <SoundToggle />
        </div>
      </header>
      <main
        ref={cluesScrollRef}
        onScroll={onCluesScroll}
        className="flex-1 min-h-0 max-w-lg w-full mx-auto overflow-y-auto px-3 py-4 space-y-3"
      >
        <MaintenanceBanner status={maintenanceStatus} />
        {loading && <LoadingState label="Loading card" layout="page" />}
        {error && (
          <div className="space-y-3">
            <p role="alert" className="banner-danger">{error}</p>
            <button type="button" onClick={() => void loadCard(session)} className="w-full rounded-lg border-2 border-edge py-3 font-semibold">
              Try again
            </button>
          </div>
        )}
        {card && !loading && (
          <>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground-muted"><span>Clues</span><span>{visibleClues.length} revealed</span></div>
            {visibleClues.map((clue) => (
              <article key={clue.order} className="rounded-lg border border-edge bg-surface p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Clue {clue.order}</p>
                <p className="mt-1 font-medium">{clue.text}</p>
                {settled && clue.citations && (
                  <p className="mt-1 text-xs font-medium text-foreground-muted">{clue.citations}</p>
                )}
              </article>
            ))}
            {status === 'correct' && (
              <section
                role="status"
                aria-live="polite"
                className="banner-success-emphasis p-4 text-center"
              >
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">Correct!</p>
                <p className="mt-1 text-2xl font-black text-green-950 dark:text-green-50">{card.entity.name}</p>
                {card.entity.aliases.length > 0 && (
                  <p className="mt-0.5 text-sm font-semibold text-green-900/80 dark:text-green-100/80">
                    {card.entity.aliases.join(', ')}
                  </p>
                )}
                <button
                  ref={advanceButtonRef}
                  type="button"
                  onClick={() => void advance(true)}
                  className="mt-4 w-full rounded-lg bg-primary py-3 font-bold text-white"
                >
                  {settleAdvanceLabel}
                </button>
              </section>
            )}
            {status === 'timeout' && (
              <section
                role="status"
                aria-live="polite"
                className="banner-warning border-amber-300 p-4 text-center dark:border-amber-700"
              >
                <p className="text-sm text-amber-900 dark:text-amber-100">Time&apos;s up. The answer was</p>
                <p className="mt-1 text-2xl font-black text-amber-950 dark:text-amber-50">{card.entity.name}</p>
                {card.entity.aliases.length > 0 && (
                  <p className="mt-0.5 text-sm font-semibold text-amber-900/80 dark:text-amber-100/80">
                    {card.entity.aliases.join(', ')}
                  </p>
                )}
                <button
                  ref={advanceButtonRef}
                  type="button"
                  onClick={() => void advance(false)}
                  className="mt-4 w-full rounded-lg bg-primary py-3 font-bold text-white"
                >
                  {settleAdvanceLabel}
                </button>
              </section>
            )}
          </>
        )}
      </main>
      {card && status === 'active' && (
        <footer
          className="shrink-0 border-t border-edge bg-surface px-3 pt-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-lg mx-auto space-y-2">
            {feedback && (
              <p role="status" aria-live="polite" className="banner-warning px-3 py-2 text-center font-semibold">
                {feedback}
              </p>
            )}
            <form
              className="flex gap-2"
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
                placeholder="Enter your guess…"
                enterKeyHint="go"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg bg-surface-muted px-3 py-3 text-base font-medium"
              />
              <button
                type="submit"
                disabled={!guess.trim()}
                className="rounded-lg bg-primary px-4 font-bold text-white disabled:opacity-50"
              >
                Guess
              </button>
            </form>
          </div>
        </footer>
      )}
    </div>
  )
}

export default SoloGame
