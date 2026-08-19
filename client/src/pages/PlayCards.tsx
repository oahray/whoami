import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import MaintenanceBanner from '../components/MaintenanceBanner'
import SoundToggle from '../components/SoundToggle'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import {
  coerceDifficultySelection
} from '../lib/difficultySelection'
import {
  getInPersonCard,
  isLostCardError,
  prefetchInPersonCard
} from '../lib/inPersonCardFetch'
import {
  advanceToNextDeck,
  currentDeckEntityIds,
  currentEntityId,
  deckProgressLabel,
  fetchInPersonDeck,
  hasNextDeck,
  isDeckExhausted,
  isSessionComplete,
  loadDeckSession,
  remainingEntityCount,
  saveDeckSession,
  snapshotForIndex,
  upcomingEntityId,
  updateCardSnapshot,
  type InPersonCardSnapshot,
  type InPersonDeckSession
} from '../lib/inPersonDeck'
import { DEFAULT_ENTITY_TYPE_FILTER, type EntityTypeFilter } from '../lib/entityTypeFilter'
import { IN_PERSON_MASK_PLACEHOLDER } from '../lib/inPersonMask'
import {
  isMaintenanceBlockingNewGames,
  MAINTENANCE_NEW_DECK_COPY,
  MAINTENANCE_PASS_PLAY_STUCK_COPY
} from '../lib/maintenance'
import { playSound, unlockAudio, warmSoundCache } from '../lib/sounds'
import type { InPersonCard } from '../types'

function PlayCards() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const datasetId = searchParams.get('datasetId') ?? ''
  const difficultyParam = searchParams.get('difficulty') ?? 'any'
  const difficulty = useMemo(
    () => coerceDifficultySelection(difficultyParam),
    [difficultyParam]
  )
  const entityType = (searchParams.get('entityType') ??
    DEFAULT_ENTITY_TYPE_FILTER) as EntityTypeFilter

  const [card, setCard] = useState<InPersonCard | null>(null)
  const [deckSession, setDeckSession] = useState<InPersonDeckSession | null>(null)
  const [deckComplete, setDeckComplete] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [revealedCount, setRevealedCount] = useState(1)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingDeck, setLoadingDeck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const [advanceBlocked, setAdvanceBlocked] = useState(false)
  const [advanceNotice, setAdvanceNotice] = useState<string | null>(null)
  const cluesScrollRef = useRef<HTMLElement>(null)
  const { status: maintenanceStatus } = useMaintenanceStatus({ poll: true })
  const maintenanceBlocking = isMaintenanceBlockingNewGames(maintenanceStatus)

  const cardQuery = useMemo(
    () => ({ datasetId, difficulty: difficultyParam, entityType }),
    [datasetId, difficultyParam, entityType]
  )

  const syncDeckSession = useCallback(() => {
    const session = loadDeckSession(datasetId, difficulty, entityType)
    setDeckSession(session)
    return session
  }, [datasetId, difficulty, entityType])

  const applySnapshot = useCallback((snapshot: InPersonCardSnapshot) => {
    setCard(snapshot.card)
    setRevealedCount(snapshot.revealedCount)
    setShowAnswer(snapshot.showAnswer)
    setDeckComplete(false)
    setSessionComplete(false)
    setError(null)
    setAdvanceBlocked(false)
    setAdvanceNotice(null)
  }, [])

  const persistSnapshot = useCallback(
    (
      session: InPersonDeckSession,
      snapshotCard: InPersonCard,
      snapshotRevealed: number,
      snapshotShowAnswer: boolean
    ) => {
      const updated = updateCardSnapshot(session, {
        card: snapshotCard,
        revealedCount: snapshotRevealed,
        showAnswer: snapshotShowAnswer
      })
      saveDeckSession(updated)
      setDeckSession(updated)
      return updated
    },
    []
  )

  const loadCardForEntity = useCallback(
    async (
      entityId: string,
      session: InPersonDeckSession,
      snapshot?: InPersonCardSnapshot | null
    ) => {
      if (!datasetId) {
        setError('Missing content selection. Go back and choose a dataset.')
        setLoading(false)
        return
      }

      if (snapshot) {
        applySnapshot(snapshot)
        setLoading(false)
        return
      }

      if (!navigator.onLine) {
        setOffline(true)
        setError('Internet required to load cards.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setShowAnswer(false)
      setRevealedCount(1)
      setDeckComplete(false)
      setSessionComplete(false)
      setAdvanceBlocked(false)

      try {
        const data = await getInPersonCard(entityId, cardQuery)
        setCard(data)
        const updated = updateCardSnapshot(session, {
          card: data,
          revealedCount: 1,
          showAnswer: false
        })
        saveDeckSession(updated)
        setDeckSession(updated)
      } catch (err) {
        setCard(null)
        setError(err instanceof Error ? err.message : 'Failed to load card')
      } finally {
        setLoading(false)
      }
    },
    [datasetId, applySnapshot, cardQuery]
  )

  const loadCurrentCard = useCallback(async () => {
    const session = syncDeckSession()
    if (!session) {
      navigate('/play', { replace: true })
      return
    }

    if (isSessionComplete(session)) {
      setSessionComplete(true)
      setDeckComplete(true)
      setLoading(false)
      return
    }

    if (isDeckExhausted(session)) {
      setDeckComplete(true)
      setSessionComplete(false)
      setLoading(false)
      return
    }

    const entityId = currentEntityId(session)
    if (!entityId) {
      navigate('/play', { replace: true })
      return
    }

    const snapshot = snapshotForIndex(session, session.index)
    await loadCardForEntity(entityId, session, snapshot)
  }, [syncDeckSession, navigate, loadCardForEntity])

  useEffect(() => {
    if (!datasetId) {
      navigate('/play', { replace: true })
      return
    }
    warmSoundCache()
    void loadCurrentCard()
  }, [datasetId, navigate, loadCurrentCard])

  useEffect(() => {
    if (!deckSession || deckComplete || !card) return
    const nextId = upcomingEntityId(deckSession)
    if (!nextId) return
    prefetchInPersonCard(nextId, cardQuery)
  }, [deckSession, deckComplete, card, cardQuery])

  useEffect(() => {
    const onOnline = () => {
      setOffline(false)
      if (!card && !loading && !deckComplete) void loadCurrentCard()
    }
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [card, loading, deckComplete, loadCurrentCard])

  useEffect(() => {
    const el = cluesScrollRef.current
    if (!el) return
    const top = el.scrollHeight
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top, behavior: 'smooth' })
    } else {
      el.scrollTop = top
    }
  }, [revealedCount, card?.entity.id])

  const visibleClues = card?.clues.slice(0, revealedCount) ?? []
  const canRevealMore = card ? revealedCount < card.clues.length : false
  const canGoBack = deckSession !== null && deckSession.index > 0 && !deckComplete
  const canAdvanceDeck =
    deckSession !== null &&
    !deckComplete &&
    deckSession.index < currentDeckEntityIds(deckSession).length

  const handleToggleAnswer = () => {
    if (!deckSession || !card) return
    unlockAudio()
    warmSoundCache()
    const next = !showAnswer
    setShowAnswer(next)
    persistSnapshot(deckSession, card, revealedCount, next)
  }

  const handleNextClue = () => {
    if (!card || !deckSession || revealedCount >= card.clues.length) return
    const nextRevealed = revealedCount + 1
    setRevealedCount(nextRevealed)
    persistSnapshot(deckSession, card, nextRevealed, showAnswer)
    playSound('clue-pop')
  }

  const handlePreviousCard = () => {
    const session = syncDeckSession()
    if (!session || session.index <= 0 || !card) return

    playSound('card-flip')
    persistSnapshot(session, card, revealedCount, showAnswer)

    const prevIndex = session.index - 1
    const updated = { ...session, index: prevIndex }
    saveDeckSession(updated)
    setDeckSession(updated)

    const snapshot = snapshotForIndex(updated, prevIndex)
    if (snapshot) {
      applySnapshot(snapshot)
      return
    }

    const entityId = currentEntityId(updated)
    if (entityId) void loadCardForEntity(entityId, updated)
  }

  const handleNextCard = async () => {
    const session = syncDeckSession()
    if (!session || !card) {
      navigate('/play', { replace: true })
      return
    }

    const sessionWithSnapshot = persistSnapshot(session, card, revealedCount, showAnswer)
    const nextIndex = sessionWithSnapshot.index + 1

    if (nextIndex >= currentDeckEntityIds(sessionWithSnapshot).length) {
      playSound('card-flip')
      const updated = { ...sessionWithSnapshot, index: nextIndex }
      saveDeckSession(updated)
      setDeckSession(updated)
      setDeckComplete(true)
      setSessionComplete(isSessionComplete(updated))
      return
    }

    const nextEntityId = currentDeckEntityIds(sessionWithSnapshot)[nextIndex]
    if (!nextEntityId) return

    const snapshot = snapshotForIndex(sessionWithSnapshot, nextIndex)
    if (snapshot) {
      playSound('card-flip')
      const updated = { ...sessionWithSnapshot, index: nextIndex }
      saveDeckSession(updated)
      setDeckSession(updated)
      applySnapshot(snapshot)
      setAdvanceBlocked(false)
      return
    }

    try {
      const nextCard = await getInPersonCard(nextEntityId, cardQuery)
      playSound('card-flip')
      const moved = { ...sessionWithSnapshot, index: nextIndex }
      const withCard = updateCardSnapshot(moved, {
        card: nextCard,
        revealedCount: 1,
        showAnswer: false
      })
      saveDeckSession(withCard)
      setDeckSession(withCard)
      setCard(nextCard)
      setRevealedCount(1)
      setShowAnswer(false)
      setDeckComplete(false)
      setSessionComplete(false)
      setAdvanceBlocked(false)
      setAdvanceNotice(null)
    } catch (err) {
      if (isLostCardError(err) || maintenanceBlocking) {
        setAdvanceBlocked(true)
        setAdvanceNotice(MAINTENANCE_PASS_PLAY_STUCK_COPY)
      } else {
        setAdvanceNotice(err instanceof Error ? err.message : 'Failed to load card')
      }
    }
  }

  const handleNextDeck = async () => {
    const session = syncDeckSession()
    if (!session || !hasNextDeck(session)) return

    const nextSession = advanceToNextDeck(session)
    const entityId = currentEntityId(nextSession)
    if (!entityId) return

    try {
      await getInPersonCard(entityId, cardQuery)
      playSound('card-flip')
      saveDeckSession(nextSession)
      setDeckSession(nextSession)
      setDeckComplete(false)
      setSessionComplete(false)
      setAdvanceBlocked(false)
      setAdvanceNotice(null)
      await loadCardForEntity(entityId, nextSession)
    } catch (err) {
      if (isLostCardError(err) || maintenanceBlocking) {
        setAdvanceNotice(MAINTENANCE_PASS_PLAY_STUCK_COPY)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load card')
      }
    }
  }

  const handlePlayAgain = async () => {
    if (!datasetId || offline) return
    if (maintenanceBlocking) {
      setAdvanceNotice(MAINTENANCE_NEW_DECK_COPY)
      return
    }
    setLoadingDeck(true)
    setError(null)
    try {
      const session = await fetchInPersonDeck(
        datasetId,
        difficulty,
        entityType
      )
      setDeckSession(session)
      setDeckComplete(false)
      setSessionComplete(false)
      const entityId = currentEntityId(session)
      if (entityId) await loadCardForEntity(entityId, session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deck')
    } finally {
      setLoadingDeck(false)
    }
  }

  const showFooter = (card && !loading && !error) || deckComplete

  return (
    <div className="h-dvh bg-app-bg font-display text-foreground flex flex-col overflow-hidden antialiased">
      <header className="shrink-0 border-b border-edge bg-surface/95 backdrop-blur-sm px-3 py-2 md:px-4 md:py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2 md:gap-3">
          <Link
            to="/play"
            className="flex size-9 md:size-10 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated shrink-0"
            aria-label="Back to setup"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="text-center min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Pass &amp; play</p>
            {deckSession && (
              <p className="text-foreground-muted text-xs truncate">
                {sessionComplete
                  ? 'All characters played'
                  : deckComplete
                    ? 'Deck complete'
                    : deckProgressLabel(deckSession)}
              </p>
            )}
            {card && !deckComplete && (
              <p className="text-foreground-muted text-[10px] truncate">
                Clue {Math.min(revealedCount, card.clues.length)} of {card.clues.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SoundToggle />
            <Link to="/" className="text-foreground-muted text-sm font-medium px-2">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-3 py-2 md:px-4 md:py-4 flex flex-col gap-2 md:gap-4 min-h-0 overflow-hidden">
        <MaintenanceBanner status={maintenanceStatus} />
        {advanceNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg text-sm">
            {advanceNotice}
          </div>
        )}
        {offline && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
            You are offline. Cards need internet to load.
          </div>
        )}

        {deckComplete && !loading && !sessionComplete && deckSession && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-sm text-center">
            All cards in this deck have been played.
            {remainingEntityCount(deckSession) > 0 && (
              <span className="block mt-1">
                {remainingEntityCount(deckSession)} characters remaining in this session.
              </span>
            )}
          </div>
        )}

        {sessionComplete && !loading && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-sm text-center">
            You&apos;ve played every character in this session.
          </div>
        )}

        {loading && (
          <LoadingState
            label={loadingDeck ? 'Loading deck' : 'Loading card'}
            layout="page"
            className="flex-1"
          />
        )}

        {error && !loading && (
          <div className="space-y-3">
            <div className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm">
              {error}
            </div>
            <button
              type="button"
              onClick={() => void loadCurrentCard()}
              disabled={offline}
              className="w-full py-3 rounded-lg border-2 border-edge font-semibold text-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              Try again
            </button>
            <Link to="/play" className="block text-center text-primary text-sm font-semibold">
              Back to setup
            </Link>
          </div>
        )}

        {card && !loading && !error && !deckComplete && (
          <>
            <section className="bg-surface rounded-xl p-3 md:p-5 border border-edge shadow-sm text-center shrink-0">
              <p className="text-foreground-muted text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 capitalize">
                {card.entity.type}
              </p>
              {showAnswer ? (
                <>
                  <p className="text-foreground text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">
                    {card.entity.name}
                  </p>
                  {card.entity.aliases.length > 0 && (
                    <p className="text-foreground-muted text-sm md:text-base font-semibold mt-0.5 md:mt-1">
                      {card.entity.aliases.join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p
                    className="text-foreground-muted text-2xl md:text-3xl font-black tracking-widest leading-tight"
                    aria-hidden
                  >
                    {IN_PERSON_MASK_PLACEHOLDER}
                  </p>
                  {card.entity.aliases.length > 0 && (
                    <p
                      className="text-foreground-muted text-sm md:text-base font-semibold tracking-widest mt-0.5 md:mt-1"
                      aria-hidden
                    >
                      {IN_PERSON_MASK_PLACEHOLDER}
                    </p>
                  )}
                </>
              )}
            </section>

            <section
              ref={cluesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 -mx-1 px-1"
              aria-label="Clues"
            >
              <h2 className="text-foreground-muted text-xs font-bold uppercase tracking-widest px-1 sticky top-0 bg-app-bg py-1 z-10">
                Clues (read aloud)
              </h2>
              <div className="space-y-2 pb-1">
                {visibleClues.map((clue) => (
                  <div
                    key={clue.order}
                    className="bg-surface rounded-lg p-3 md:p-4 border border-edge shadow-sm"
                  >
                    <div className="flex items-start gap-2 md:gap-3">
                      <div className="size-8 md:size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-lg md:text-xl">auto_stories</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
                          Clue {clue.order}
                        </p>
                        <p className="text-foreground font-medium leading-snug mt-1">{clue.text}</p>
                        {showAnswer && clue.citations && (
                          <p className="text-foreground-muted text-xs mt-1">{clue.citations}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {showFooter && (
        <div
          className="shrink-0 border-t border-edge bg-surface px-3 pt-2 pb-2 md:p-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
        >
          <div className="max-w-lg mx-auto w-full flex flex-col gap-1.5 md:gap-2">
            {!deckComplete && canRevealMore && (
              <button
                type="button"
                onClick={handleNextClue}
                className="w-full bg-primary text-white font-bold py-2.5 md:py-3 rounded-lg flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">visibility</span>
                Next clue
              </button>
            )}
            {deckComplete ? (
              <>
                {sessionComplete ? (
                  <button
                    type="button"
                    onClick={() => void handlePlayAgain()}
                    disabled={loadingDeck || offline || maintenanceBlocking}
                    className="w-full bg-primary text-white font-bold py-2.5 md:py-3 rounded-lg disabled:opacity-50"
                  >
                    {loadingDeck ? 'Loading…' : 'Play again'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleNextDeck()}
                    disabled={loading || offline}
                    className="w-full bg-primary text-white font-bold py-2.5 md:py-3 rounded-lg disabled:opacity-50"
                  >
                    Next deck
                  </button>
                )}
                <Link
                  to="/play"
                  className="block text-center py-2.5 text-primary text-sm font-semibold"
                >
                  Back to setup
                </Link>
              </>
            ) : (
              <div className="flex gap-2">
                {canGoBack && (
                  <button
                    type="button"
                    onClick={handlePreviousCard}
                    disabled={loading}
                    className="flex-1 py-2.5 md:py-3 rounded-lg border-2 border-edge font-semibold text-foreground hover:bg-surface-muted disabled:opacity-50"
                  >
                    Previous card
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleAnswer}
                  className="flex-1 py-2.5 md:py-3 rounded-lg border-2 border-edge font-semibold text-foreground hover:bg-surface-muted"
                >
                  {showAnswer ? 'Hide answer' : 'Reveal answer'}
                </button>
                {canAdvanceDeck && (
                  <button
                    type="button"
                    onClick={() => void handleNextCard()}
                    disabled={loading || offline || advanceBlocked}
                    className="flex-1 py-2.5 md:py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50"
                  >
                    Next card
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayCards
