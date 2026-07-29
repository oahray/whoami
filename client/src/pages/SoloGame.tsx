import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import SoundToggle from '../components/SoundToggle'
import { useVisualViewportLock } from '../hooks/useVisualViewportLock'
import { API_BASE_URL } from '../lib/apiBase'
import { validateGuess } from '../lib/guessValidation'
import {
  clearSoloSession,
  continueEndurancePool,
  createSoloSession,
  formatSoloTime,
  getSoloRecord,
  loadSoloSession,
  saveSoloRecord,
  saveSoloSession,
  type SoloRecord,
  type SoloSession
} from '../lib/soloSession'
import { playSound } from '../lib/sounds'
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
  const [result, setResult] = useState<{ record: SoloRecord; isPersonalBest: boolean } | null>(null)
  const [restarting, setRestarting] = useState(false)
  const roundStartedAt = useRef(0)
  const activeSession = useRef<SoloSession | null>(null)
  const guessInputRef = useRef<HTMLInputElement | null>(null)
  const viewportStyle = useVisualViewportLock()

  const loadCard = useCallback(async (nextSession: SoloSession) => {
    const entityId = nextSession.entityIds[nextSession.index]
    if (!entityId) return
    setLoading(true)
    setError(null)
    setCard(null)
    setGuess('')
    setFeedback(null)
    setStatus('active')
    try {
      const query = new URLSearchParams({
        datasetId: nextSession.datasetId,
        difficulty: nextSession.difficulty,
        entityType: nextSession.entityType
      })
      const response = await fetch(`${API_BASE_URL}/cards/entity/${encodeURIComponent(entityId)}?${query}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to load card (${response.status})`)
      }
      setCard((await response.json()) as InPersonCard)
      roundStartedAt.current = Date.now()
      setRemainingMs(nextSession.roundDurationMs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card')
    } finally {
      setLoading(false)
    }
  }, [])

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

  const finishRun = useCallback((completed: SoloSession) => {
    const record: SoloRecord = {
      ...completed,
      achievedAt: new Date().toISOString()
    }
    const saved = saveSoloRecord(record)
    clearSoloSession()
    setStatus('finished')
    // Use this run's stats even when it did not beat the personal best.
    setResult({ record, isPersonalBest: saved.isPersonalBest })
  }, [])

  const advance = useCallback((correct: boolean) => {
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
    saveSoloSession(updated)
    void loadCard(updated)
  }, [finishRun, loadCard, status])

  useEffect(() => {
    if (!session || !card || status !== 'active' || loading) return
    const tick = () => {
      const next = Math.max(0, session.roundDurationMs - (Date.now() - roundStartedAt.current))
      setRemainingMs(next)
      if (next === 0) {
        setStatus('timeout')
        playSound('round-end')
      }
    }
    tick()
    const interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [session, card, status, loading])

  useEffect(() => {
    if (status !== 'timeout') return
    const timeout = window.setTimeout(() => advance(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [status, advance])

  useEffect(() => {
    if (status !== 'active' || loading || !card) return
    guessInputRef.current?.focus({ preventScroll: true })
  }, [status, loading, card?.entity.id])

  const tryAgain = async () => {
    if (!session || restarting) return
    setRestarting(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        datasetId: session.datasetId,
        difficulty: session.difficulty,
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
      await loadCard(nextSession)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart')
    } finally {
      setRestarting(false)
    }
  }

  const submitGuess = () => {
    if (!card || status !== 'active' || !guess.trim()) return
    if (!validateGuess(guess, card.entity.name, card.entity.aliases)) {
      setFeedback('Not quite — keep trying.')
      setGuess('')
      return
    }
    setStatus('correct')
    setFeedback('Correct!')
    playSound('success-small')
    window.setTimeout(() => advance(true), 800)
  }

  if (result && session) {
    const heading = session.variation === 'challenge' ? 'Challenge complete!' : 'Endurance complete!'
    return (
      <div className="min-h-screen bg-app-bg font-display text-foreground flex items-center justify-center p-4">
        <main className="w-full max-w-lg rounded-xl border border-edge bg-surface p-6 text-center shadow-sm space-y-5">
          <span className="material-symbols-outlined text-5xl text-primary">emoji_events</span>
          <div>
            <h1 className="text-2xl font-black">{heading}</h1>
            <p className="mt-1 text-foreground-muted">{session.variation === 'challenge' ? 'Your 10-round result' : 'Your final streak'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary/10 p-4"><p className="text-3xl font-black text-primary">{result.record.correctCount}</p><p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Correct</p></div>
            <div className="rounded-lg bg-surface-muted p-4"><p className="text-3xl font-black">{formatSoloTime(result.record.activeElapsedMs)}</p><p className="text-xs font-bold uppercase tracking-wider text-foreground-muted">Active time</p></div>
          </div>
          {result.isPersonalBest && <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">New personal best on this device!</p>}
          {!result.isPersonalBest && <p className="text-sm text-foreground-muted">Personal best: {getSoloRecord(session)?.correctCount ?? 0} correct.</p>}
          {error && (
            <p className="rounded-lg border border-red-400 bg-red-100 p-3 text-sm text-red-700">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/solo" className="rounded-lg border-2 border-edge py-3 font-semibold">
              New setup
            </Link>
            <button
              type="button"
              onClick={() => void tryAgain()}
              disabled={restarting}
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

  const revealedCount = card
    ? Math.min(card.clues.length, 1 + Math.floor((session.roundDurationMs - remainingMs) / session.clueRevealIntervalMs))
    : 0
  const visibleClues = card?.clues.slice(0, revealedCount) ?? []

  return (
    <div
      className="min-h-dvh overflow-hidden bg-app-bg font-display text-foreground flex flex-col"
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
      <main className="flex-1 min-h-0 max-w-lg w-full mx-auto overflow-y-auto px-3 py-4 space-y-3">
        {loading && <LoadingState label="Loading card" layout="page" />}
        {error && <div className="space-y-3"><p className="rounded-lg border border-red-400 bg-red-100 p-3 text-sm text-red-700">{error}</p><button type="button" onClick={() => void loadCard(session)} className="w-full rounded-lg border-2 border-edge py-3 font-semibold">Try again</button></div>}
        {card && !loading && (
          <>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-foreground-muted"><span>Clues</span><span>{visibleClues.length} revealed</span></div>
            {visibleClues.map((clue) => <article key={clue.order} className="rounded-lg border border-edge bg-surface p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Clue {clue.order}</p><p className="mt-1 font-medium">{clue.text}</p></article>)}
            {status === 'correct' && <p className="rounded-lg bg-green-50 p-3 text-center font-semibold text-green-800">Correct! {card.entity.name}</p>}
            {status === 'timeout' && (
              <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-center">
                <p className="text-sm text-amber-900">Time&apos;s up — the answer was</p>
                <p className="mt-1 text-2xl font-black text-amber-950">{card.entity.name}</p>
                <button
                  type="button"
                  onClick={() => advance(false)}
                  className="mt-4 w-full rounded-lg bg-primary py-3 font-bold text-white"
                >
                  {session.variation === 'challenge' ? 'Next round' : 'See results'}
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
          <div className="max-w-lg mx-auto flex gap-2">
            <input
              ref={guessInputRef}
              type="text"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submitGuess()}
              placeholder="Enter your guess…"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg bg-surface-muted px-3 py-3 text-base font-medium"
            />
            <button type="button" onClick={submitGuess} disabled={!guess.trim()} className="rounded-lg bg-primary px-4 font-bold text-white disabled:opacity-50">Guess</button>
          </div>
          {feedback && <p className="mt-2 text-center text-sm font-medium text-foreground-muted">{feedback}</p>}
        </footer>
      )}
    </div>
  )
}

export default SoloGame
