import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { API_BASE_URL } from '../lib/apiBase'
import {
  fetchInPersonEligibility,
  firstPlayableDifficulty,
  IN_PERSON_DIFFICULTY_OPTIONS,
  isDifficultyPlayable,
  type InPersonEligibility
} from '../lib/inPersonEligibility'
import {
  DEFAULT_ENTITY_TYPE_FILTER,
  ENTITY_TYPE_FIELD_LABEL,
  ENTITY_TYPE_HINT_IN_PERSON,
  ENTITY_TYPE_OPTIONS,
  entityTypeCountLabel,
  type EntityTypeFilter
} from '../lib/entityTypeFilter'
import { fetchInPersonDeck } from '../lib/inPersonDeck'
import type { GameDifficultyMode, PublicDataset } from '../types'

function PlaySetup() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<PublicDataset[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [entityType, setEntityType] = useState<EntityTypeFilter>(DEFAULT_ENTITY_TYPE_FILTER)
  const [difficulty, setDifficulty] = useState<GameDifficultyMode>('any')
  const [eligibility, setEligibility] = useState<InPersonEligibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )

  const showDatasetPicker = datasets.length > 1
  const selectedDataset = datasets.find((d) => d.id === datasetId)
  const selectedCount = eligibility?.modes[difficulty] ?? 0
  const canStart =
    Boolean(datasetId) &&
    !offline &&
    !starting &&
    !eligibilityLoading &&
    selectedCount > 0

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${API_BASE_URL}/datasets`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load content (${res.status})`)
        return (await res.json()) as PublicDataset[]
      })
      .then((rows) => {
        if (cancelled) return
        setDatasets(rows)
        const initial =
          rows.find((d) => d.is_default)?.id ?? rows[0]?.id ?? ''
        setDatasetId(initial)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load content')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!datasetId || offline) {
      setEligibility(null)
      return
    }

    let cancelled = false
    setEligibilityLoading(true)
    setError(null)

    fetchInPersonEligibility(datasetId, entityType)
      .then((data) => {
        if (cancelled) return
        setEligibility(data)
        if (!isDifficultyPlayable(data.modes, difficulty)) {
          const fallback = firstPlayableDifficulty(data.modes)
          if (fallback) setDifficulty(fallback)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEligibility(null)
          setError(err instanceof Error ? err.message : 'Failed to load eligibility')
        }
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [datasetId, entityType, offline, difficulty])

  const handleStart = async () => {
    if (!canStart) return
    setStarting(true)
    setError(null)
    try {
      await fetchInPersonDeck(datasetId, difficulty, entityType)
      const params = new URLSearchParams({ datasetId, difficulty, entityType })
      navigate(`/play/cards?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start cards')
    } finally {
      setStarting(false)
    }
  }

  const noPlayableModes =
    eligibility &&
    !eligibilityLoading &&
    IN_PERSON_DIFFICULTY_OPTIONS.every((opt) => (eligibility.modes[opt.value] ?? 0) === 0)

  return (
    <div className="min-h-screen bg-background-light font-display text-slate-900 antialiased">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3">
          <Link
            to="/"
            className="flex size-9 md:size-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="Back to home"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">Play in person</h1>
            <p className="text-slate-500 text-xs truncate">One phone · read clues aloud</p>
          </div>
          <Link to="/about" className="text-primary text-sm font-semibold shrink-0">
            Help
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 pb-8 md:px-4 md:py-6 md:pb-10 space-y-3 md:space-y-4">
        {offline && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm flex gap-2">
            <span className="material-symbols-outlined text-lg shrink-0">wifi_off</span>
            <p>Internet required to load cards. Reconnect to start.</p>
          </div>
        )}

        {loading && (
          <LoadingState label="Loading content" layout="page" className="flex-none py-8" />
        )}

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!loading && !error && datasets.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-8">No content is available right now.</p>
        )}

        {!loading && datasets.length > 0 && (
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5 space-y-4 md:space-y-5">
            {showDatasetPicker ? (
              <div>
                <label htmlFor="playDataset" className="block text-slate-700 text-sm font-semibold mb-2">
                  Content
                </label>
                <select
                  id="playDataset"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className="w-full bg-slate-50 border-0 rounded-lg text-slate-900 focus:ring-2 focus:ring-primary py-2.5 px-3"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {selectedDataset?.description && (
                  <p className="text-xs text-slate-500 mt-1">{selectedDataset.description}</p>
                )}
              </div>
            ) : (
              selectedDataset && (
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Content</p>
                  <p className="text-slate-900 font-bold mt-1">{selectedDataset.name}</p>
                </div>
              )
            )}

            <div>
              <label htmlFor="playEntityType" className="block text-slate-700 text-sm font-semibold mb-2">
                {ENTITY_TYPE_FIELD_LABEL}
              </label>
              <select
                id="playEntityType"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as EntityTypeFilter)}
                disabled={eligibilityLoading || Boolean(noPlayableModes)}
                className="w-full bg-slate-50 border-0 rounded-lg text-slate-900 focus:ring-2 focus:ring-primary py-2.5 px-3 disabled:opacity-60"
              >
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">{ENTITY_TYPE_HINT_IN_PERSON}</p>
            </div>

            <div>
              <label htmlFor="playDifficulty" className="block text-slate-700 text-sm font-semibold mb-2">
                Difficulty
              </label>
              <select
                id="playDifficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as GameDifficultyMode)}
                disabled={eligibilityLoading || Boolean(noPlayableModes)}
                className="w-full bg-slate-50 border-0 rounded-lg text-slate-900 focus:ring-2 focus:ring-primary py-2.5 px-3 disabled:opacity-60"
              >
                {IN_PERSON_DIFFICULTY_OPTIONS.map((opt) => {
                  const count = eligibility?.modes[opt.value] ?? 0
                  const disabled = eligibility !== null && count === 0
                  return (
                    <option key={opt.value} value={opt.value} disabled={disabled}>
                      {opt.label}
                    </option>
                  )
                })}
              </select>
              {eligibilityLoading && (
                <div className="mt-1">
                  <LoadingState
                    label="Checking available cards"
                    layout="compact"
                    showSpinner
                    showEllipsis
                  />
                </div>
              )}
              {!eligibilityLoading && eligibility && selectedCount > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {entityTypeCountLabel(entityType, selectedCount)}. Clues are shuffled every card.
                </p>
              )}
              {!eligibilityLoading && noPlayableModes && (
                <p className="text-xs text-amber-700 mt-1">
                  Not enough clues for any difficulty in this content pack.
                </p>
              )}
              {!eligibilityLoading &&
                eligibility &&
                !noPlayableModes &&
                selectedCount === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    No entities have enough clues for this difficulty. Choose another.
                  </p>
                )}
            </div>

            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!canStart}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 md:py-4 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">style</span>
              {starting ? 'Starting…' : 'Start cards'}
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default PlaySetup
