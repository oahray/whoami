import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import SoundToggle from '../components/SoundToggle'
import { API_BASE_URL } from '../lib/apiBase'
import {
  currentEntityId,
  deckProgressLabel,
  fetchInPersonDeck,
  isDeckExhausted,
  loadDeckSession,
  saveDeckSession,
  type InPersonDeckSession
} from '../lib/inPersonDeck'
import { DEFAULT_ENTITY_TYPE_FILTER, type EntityTypeFilter } from '../lib/entityTypeFilter'
import { IN_PERSON_MASK_PLACEHOLDER } from '../lib/inPersonMask'
import { playSound, unlockAudio } from '../lib/sounds'
import type { InPersonCard } from '../types'

function PlayCards() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const datasetId = searchParams.get('datasetId') ?? ''
  const difficulty = searchParams.get('difficulty') ?? 'any'
  const entityType = (searchParams.get('entityType') ??
    DEFAULT_ENTITY_TYPE_FILTER) as EntityTypeFilter

  const [card, setCard] = useState<InPersonCard | null>(null)
  const [deckSession, setDeckSession] = useState<InPersonDeckSession | null>(null)
  const [deckComplete, setDeckComplete] = useState(false)
  const [revealedCount, setRevealedCount] = useState(1)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reshuffling, setReshuffling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )
  const cluesScrollRef = useRef<HTMLElement>(null)

  const syncDeckSession = useCallback(() => {
    const session = loadDeckSession(
      datasetId,
      difficulty as InPersonDeckSession['difficulty'],
      entityType
    )
    setDeckSession(session)
    return session
  }, [datasetId, difficulty, entityType])

  const loadCardForEntity = useCallback(
    async (entityId: string) => {
      if (!datasetId) {
        setError('Missing content selection. Go back and choose a dataset.')
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

      const params = new URLSearchParams({ datasetId, difficulty, entityType })
      try {
        const res = await fetch(
          `${API_BASE_URL}/cards/entity/${encodeURIComponent(entityId)}?${params.toString()}`
        )
        if (res.status === 404) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Card not found for this character.')
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Failed to load card (${res.status})`)
        }
        const data = (await res.json()) as InPersonCard
        setCard(data)
        const sessionAfterLoad = syncDeckSession()
        if (sessionAfterLoad?.index === 0) {
          playSound('round-start')
        }
      } catch (err) {
        setCard(null)
        setError(err instanceof Error ? err.message : 'Failed to load card')
      } finally {
        setLoading(false)
      }
    },
    [datasetId, difficulty, entityType, syncDeckSession]
  )

  const loadCurrentCard = useCallback(async () => {
    const session = syncDeckSession()
    if (!session) {
      navigate('/play', { replace: true })
      return
    }
    if (isDeckExhausted(session)) {
      setDeckComplete(true)
      setLoading(false)
      return
    }
    const entityId = currentEntityId(session)
    if (!entityId) {
      navigate('/play', { replace: true })
      return
    }
    await loadCardForEntity(entityId)
  }, [syncDeckSession, navigate, loadCardForEntity])

  useEffect(() => {
    if (!datasetId) {
      navigate('/play', { replace: true })
      return
    }
    void loadCurrentCard()
  }, [datasetId, navigate, loadCurrentCard])

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
  const canAdvanceDeck =
    deckSession !== null &&
    !deckComplete &&
    deckSession.index < deckSession.entityIds.length

  const handleNextClue = () => {
    if (card && revealedCount < card.clues.length) {
      setRevealedCount((n) => n + 1)
    }
  }

  const handleNextCard = () => {
    const session = syncDeckSession()
    if (!session) {
      navigate('/play', { replace: true })
      return
    }

    const nextIndex = session.index + 1
    const updated = { ...session, index: nextIndex }
    saveDeckSession(updated)
    setDeckSession(updated)

    if (nextIndex >= session.entityIds.length) {
      setDeckComplete(true)
      playSound('round-end')
      return
    }

    const nextEntityId = session.entityIds[nextIndex]
    if (nextEntityId) void loadCardForEntity(nextEntityId)
  }

  const handleShuffleAgain = async () => {
    if (!datasetId || offline) return
    setReshuffling(true)
    setError(null)
    try {
      const session = await fetchInPersonDeck(
        datasetId,
        difficulty as InPersonDeckSession['difficulty'],
        entityType
      )
      setDeckSession(session)
      setDeckComplete(false)
      const entityId = currentEntityId(session)
      if (entityId) await loadCardForEntity(entityId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to shuffle deck')
    } finally {
      setReshuffling(false)
    }
  }

  const showFooter = (card && !loading && !error) || deckComplete

  return (
    <div className="h-dvh bg-background-light font-display text-slate-900 flex flex-col overflow-hidden antialiased">
      <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2 md:px-4 md:py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2 md:gap-3">
          <Link
            to="/play"
            className="flex size-9 md:size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Back to setup"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="text-center min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">In person</p>
            {deckSession && (
              <p className="text-slate-600 text-xs truncate">
                {deckComplete ? 'Deck complete' : deckProgressLabel(deckSession)}
              </p>
            )}
            {card && !deckComplete && (
              <p className="text-slate-500 text-[10px] truncate">
                Clue {Math.min(revealedCount, card.clues.length)} of {card.clues.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <SoundToggle />
            <Link to="/" className="text-slate-500 text-sm font-medium px-2">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-3 py-2 md:px-4 md:py-4 flex flex-col gap-2 md:gap-4 min-h-0 overflow-hidden">
        {offline && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm">
            You are offline. Cards need internet to load.
          </div>
        )}

        {deckComplete && !loading && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-900 rounded-lg text-sm text-center">
            All cards in this deck have been played.
          </div>
        )}

        {loading && (
          <LoadingState
            label={reshuffling ? 'Shuffling deck' : 'Loading card'}
            layout="page"
            className="flex-1"
          />
        )}

        {error && !loading && (
          <div className="space-y-3">
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
            <button
              type="button"
              onClick={() => void loadCurrentCard()}
              disabled={offline}
              className="w-full py-3 rounded-lg border-2 border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Try again
            </button>
            <Link to="/play" className="block text-center text-primary text-sm font-semibold">
              Back to setup
            </Link>
          </div>
        )}

        {card && !loading && !error && (
          <>
            <section className="bg-white rounded-xl p-3 md:p-5 border border-slate-200 shadow-sm text-center shrink-0">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 capitalize">
                {card.entity.type}
              </p>
              {showAnswer ? (
                <>
                  <p className="text-slate-900 text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">
                    {card.entity.name}
                  </p>
                  {card.entity.aliases.map((alias) => (
                    <p key={alias} className="text-slate-600 text-base md:text-lg font-semibold mt-0.5 md:mt-1">
                      {alias}
                    </p>
                  ))}
                </>
              ) : (
                <>
                  <p
                    className="text-slate-400 text-2xl md:text-3xl font-black tracking-widest leading-tight"
                    aria-hidden
                  >
                    {IN_PERSON_MASK_PLACEHOLDER}
                  </p>
                  {card.entity.aliases.map((alias) => (
                    <p
                      key={alias}
                      className="text-slate-300 text-base md:text-lg font-semibold tracking-widest mt-0.5 md:mt-1"
                      aria-hidden
                    >
                      {IN_PERSON_MASK_PLACEHOLDER}
                    </p>
                  ))}
                </>
              )}
            </section>

            <section
              ref={cluesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 -mx-1 px-1"
              aria-label="Clues"
            >
              <h2 className="text-slate-500 text-xs font-bold uppercase tracking-widest px-1 sticky top-0 bg-background-light py-1 z-10">
                Clues (read aloud)
              </h2>
              <div className="space-y-2 pb-1">
                {visibleClues.map((clue) => (
                  <div
                    key={clue.order}
                    className="bg-white rounded-lg p-3 md:p-4 border border-slate-200 shadow-sm"
                  >
                    <div className="flex items-start gap-2 md:gap-3">
                      <div className="size-8 md:size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-lg md:text-xl">auto_stories</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Clue {clue.order}
                        </p>
                        <p className="text-slate-800 font-medium leading-snug mt-1">{clue.text}</p>
                        {showAnswer && clue.citations && (
                          <p className="text-slate-500 text-xs mt-1">{clue.citations}</p>
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
          className="shrink-0 border-t border-slate-200 bg-white px-3 pt-2 pb-2 md:p-3"
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
                <button
                  type="button"
                  onClick={() => void handleShuffleAgain()}
                  disabled={reshuffling || offline}
                  className="w-full bg-primary text-white font-bold py-2.5 md:py-3 rounded-lg disabled:opacity-50"
                >
                  {reshuffling ? 'Shuffling…' : 'Shuffle again'}
                </button>
                <Link
                  to="/play"
                  className="block text-center py-2.5 text-primary text-sm font-semibold"
                >
                  Back to setup
                </Link>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio()
                    setShowAnswer((v) => {
                      if (!v) playSound('card-flip')
                      return !v
                    })
                  }}
                  className="flex-1 py-2.5 md:py-3 rounded-lg border-2 border-slate-200 font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {showAnswer ? 'Hide answer' : 'Reveal answer'}
                </button>
                {canAdvanceDeck && (
                  <button
                    type="button"
                    onClick={handleNextCard}
                    disabled={loading || offline}
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
