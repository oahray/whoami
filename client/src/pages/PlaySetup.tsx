import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DifficultyMultiSelect } from '../components/DifficultyMultiSelect'
import LoadingState from '../components/LoadingState'
import MaintenanceBanner from '../components/MaintenanceBanner'
import PreferencesMenu from '../components/PreferencesMenu'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import { isMaintenanceBlockingNewGames } from '../lib/maintenance'
import { API_BASE_URL } from '../lib/apiBase'
import {
  encodeDifficultySelection,
  type DifficultySelection
} from '../lib/difficultySelection'
import {
  fetchInPersonEligibility,
  isDifficultySelectionPlayable,
  type InPersonEligibility
} from '../lib/inPersonEligibility'
import {
  DEFAULT_ENTITY_TYPE_FILTER,
  ENTITY_TYPE_FIELD_LABEL,
  ENTITY_TYPE_HINT_IN_PERSON,
  ENTITY_TYPE_OPTIONS,
  type EntityTypeFilter
} from '../lib/entityTypeFilter'
import { fetchInPersonDeck } from '../lib/inPersonDeck'
import { unlockAudio } from '../lib/sounds'
import type { PublicDataset } from '../types'

function PlaySetup() {
  const navigate = useNavigate()
  const { status: maintenanceStatus } = useMaintenanceStatus()
  const maintenanceBlocking = isMaintenanceBlockingNewGames(maintenanceStatus)
  const [datasets, setDatasets] = useState<PublicDataset[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [entityType, setEntityType] = useState<EntityTypeFilter>(DEFAULT_ENTITY_TYPE_FILTER)
  const [difficulty, setDifficulty] = useState<DifficultySelection>([])
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
  const selectionPlayable = isDifficultySelectionPlayable(eligibility, difficulty)
  const canStart =
    Boolean(datasetId) &&
    !offline &&
    !starting &&
    !eligibilityLoading &&
    !maintenanceBlocking &&
    selectionPlayable

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

    fetchInPersonEligibility(datasetId, entityType, { difficulty })
      .then((data) => {
        if (cancelled) return
        setEligibility(data)
        if (!isDifficultySelectionPlayable(data, difficulty) && (data.modes.any ?? 0) > 0) {
          setDifficulty([])
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
  }, [datasetId, entityType, difficulty, offline])

  const handleStart = async () => {
    if (!canStart) return
    setStarting(true)
    setError(null)
    unlockAudio()
    try {
      await fetchInPersonDeck(datasetId, difficulty, entityType)
      const params = new URLSearchParams({
        datasetId,
        difficulty: encodeDifficultySelection(difficulty),
        entityType
      })
      navigate(`/play/cards?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start cards')
    } finally {
      setStarting(false)
    }
  }

  const noPlayableModes =
    eligibility && !eligibilityLoading && (eligibility.modes.any ?? 0) === 0

  return (
    <div className="min-h-screen bg-app-bg font-display text-foreground antialiased">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3">
          <Link
            to="/"
            className="flex size-9 md:size-10 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated"
            aria-label="Back to home"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">Pass &amp; play</h1>
            <p className="text-foreground-muted text-xs truncate">One phone · read clues aloud</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <PreferencesMenu />
            <Link to="/about" className="text-primary text-sm font-semibold px-2">
              Help
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4 pb-8 md:px-4 md:py-6 md:pb-10 space-y-3 md:space-y-4">
        <MaintenanceBanner status={maintenanceStatus} />
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
          <div className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {!loading && !error && datasets.length === 0 && (
          <p className="text-foreground-muted text-sm text-center py-8">No content is available right now.</p>
        )}

        {!loading && datasets.length > 0 && (
          <section className="bg-surface rounded-lg border border-edge shadow-sm p-4 md:p-5 space-y-4 md:space-y-5">
            {showDatasetPicker ? (
              <div>
                <label htmlFor="playDataset" className="block text-foreground text-sm font-semibold mb-2">
                  Content
                </label>
                <select
                  id="playDataset"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  className="w-full bg-surface-muted border-0 rounded-lg text-foreground focus:ring-2 focus:ring-primary py-2.5 px-3"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {selectedDataset?.description && (
                  <p className="text-xs text-foreground-muted mt-1">{selectedDataset.description}</p>
                )}
              </div>
            ) : (
              selectedDataset && (
                <div>
                  <p className="text-foreground-muted text-xs font-semibold uppercase tracking-wider">Content</p>
                  <p className="text-foreground font-bold mt-1">{selectedDataset.name}</p>
                </div>
              )
            )}

            <div>
              <label htmlFor="playEntityType" className="block text-foreground text-sm font-semibold mb-2">
                {ENTITY_TYPE_FIELD_LABEL}
              </label>
              <select
                id="playEntityType"
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as EntityTypeFilter)}
                disabled={eligibilityLoading}
                className="w-full bg-surface-muted border-0 rounded-lg text-foreground focus:ring-2 focus:ring-primary py-2.5 px-3 disabled:opacity-60"
              >
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-foreground-muted mt-1">{ENTITY_TYPE_HINT_IN_PERSON}</p>
              {!eligibilityLoading && noPlayableModes && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Not enough clues for this card type. Try characters or places above.
                </p>
              )}
            </div>

            <div>
              <DifficultyMultiSelect
                id="playDifficulty"
                value={difficulty}
                onChange={setDifficulty}
                disabled={eligibilityLoading || Boolean(noPlayableModes)}
                anyCount={eligibility?.modes.any}
                tierCounts={{
                  easy: eligibility?.modes.easy,
                  medium: eligibility?.modes.medium,
                  hard: eligibility?.modes.hard,
                  nightmare: eligibility?.modes.nightmare
                }}
              />
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
              {!eligibilityLoading && eligibility && selectionPlayable && (
                <p className="text-xs text-foreground-muted mt-1">
                  Clues are shuffled every card.
                </p>
              )}
              {!eligibilityLoading && eligibility && !noPlayableModes && !selectionPlayable && (
                <p className="text-xs text-amber-700 mt-1">
                  Not enough clues for this difficulty mix. Choose another.
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
