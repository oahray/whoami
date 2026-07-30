import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DifficultyMultiSelect } from '../components/DifficultyMultiSelect'
import LoadingState from '../components/LoadingState'
import MaintenanceBanner from '../components/MaintenanceBanner'
import PreferencesMenu from '../components/PreferencesMenu'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import { API_BASE_URL } from '../lib/apiBase'
import {
  coerceDifficultySelection,
  encodeDifficultySelection,
  type DifficultySelection
} from '../lib/difficultySelection'
import {
  DEFAULT_ENTITY_TYPE_FILTER,
  ENTITY_TYPE_FIELD_LABEL,
  ENTITY_TYPE_OPTIONS,
  type EntityTypeFilter
} from '../lib/entityTypeFilter'
import {
  fetchInPersonEligibility,
  isDifficultySelectionPlayable,
  type InPersonEligibility
} from '../lib/inPersonEligibility'
import { isMaintenanceBlockingNewGames } from '../lib/maintenance'
import {
  createSoloSession,
  formatSoloTime,
  getSoloRecord,
  listSoloRecords,
  loadSoloSetupPreferences,
  saveSoloSession,
  saveSoloSetupPreferences,
  soloConfigSummary,
  type SoloConfig,
  type SoloVariation
} from '../lib/soloSession'
import { fadeOutMenuMusic } from '../lib/menuMusic'
import { playSound, unlockAudio } from '../lib/sounds'
import { useMenuMusic } from '../hooks/useMenuMusic'
import type { PublicDataset } from '../types'

const TIMER_OPTIONS = [15, 30, 45, 60]
const CLUE_INTERVAL_OPTIONS = [5, 10, 15]

function SoloSetup() {
  const navigate = useNavigate()
  useMenuMusic()
  const { status: maintenanceStatus } = useMaintenanceStatus()
  const maintenanceBlocking = isMaintenanceBlockingNewGames(maintenanceStatus)
  const savedPrefs = loadSoloSetupPreferences()
  const [datasets, setDatasets] = useState<PublicDataset[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [entityType, setEntityType] = useState<EntityTypeFilter>(
    savedPrefs?.entityType ?? DEFAULT_ENTITY_TYPE_FILTER
  )
  const [difficulty, setDifficulty] = useState<DifficultySelection>(
    coerceDifficultySelection(savedPrefs?.difficulty)
  )
  const [variation, setVariation] = useState<SoloVariation>(savedPrefs?.variation ?? 'challenge')
  const [roundSeconds, setRoundSeconds] = useState(
    savedPrefs ? savedPrefs.roundDurationMs / 1000 : 30
  )
  const [clueIntervalSeconds, setClueIntervalSeconds] = useState(
    savedPrefs ? savedPrefs.clueRevealIntervalMs / 1000 : 5
  )
  const [eligibility, setEligibility] = useState<InPersonEligibility | null>(null)
  const [loading, setLoading] = useState(true)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)

  const selectionPlayable = isDifficultySelectionPlayable(eligibility, difficulty)
  const canStart =
    Boolean(datasetId) &&
    selectionPlayable &&
    !starting &&
    !eligibilityLoading &&
    !offline &&
    !maintenanceBlocking

  const currentConfig: SoloConfig | null = datasetId
    ? {
        datasetId,
        difficulty,
        entityType,
        variation,
        roundDurationMs: roundSeconds * 1000,
        clueRevealIntervalMs: clueIntervalSeconds * 1000
      }
    : null

  const currentBest = currentConfig ? getSoloRecord(currentConfig) : null
  const challengeRecords = datasetId ? listSoloRecords('challenge', datasetId) : []
  const enduranceRecords = datasetId ? listSoloRecords('endurance', datasetId) : []
  const hasAnyRecords = challengeRecords.length > 0 || enduranceRecords.length > 0
  const selectedDatasetName = datasets.find((dataset) => dataset.id === datasetId)?.name

  const renderRecordList = (records: typeof challengeRecords) => (
    <ul className="space-y-2">
      {records.map((record) => {
        const isCurrent =
          currentConfig !== null &&
          record.difficulty === currentConfig.difficulty &&
          record.entityType === currentConfig.entityType &&
          record.roundDurationMs === currentConfig.roundDurationMs &&
          record.clueRevealIntervalMs === currentConfig.clueRevealIntervalMs
        return (
          <li
            key={`${record.achievedAt}:${record.correctCount}:${record.activeElapsedMs}:${record.roundDurationMs}`}
            className={`rounded-lg border p-3 ${
              isCurrent ? 'border-primary bg-primary/5' : 'border-edge bg-surface-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {soloConfigSummary(record, { includeVariation: false })}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-primary">{record.correctCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
                  {formatSoloTime(record.activeElapsedMs)}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )

  useEffect(() => {
    const online = () => setOffline(false)
    const offlineHandler = () => setOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offlineHandler)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/datasets`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to load content (${response.status})`)
        return (await response.json()) as PublicDataset[]
      })
      .then((rows) => {
        if (cancelled) return
        setDatasets(rows)
        const prefs = loadSoloSetupPreferences()
        const preferred =
          (prefs?.datasetId && rows.some((row) => row.id === prefs.datasetId) && prefs.datasetId) ||
          rows.find((dataset) => dataset.is_default)?.id ||
          rows[0]?.id ||
          ''
        setDatasetId(preferred)
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load content'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!datasetId || offline) return
    let cancelled = false
    setEligibilityLoading(true)
    fetchInPersonEligibility(datasetId, entityType, { difficulty })
      .then((data) => {
        if (cancelled) return
        setEligibility(data)
        if (!isDifficultySelectionPlayable(data, difficulty) && (data.modes.any ?? 0) > 0) {
          setDifficulty([])
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load eligibility'))
      .finally(() => !cancelled && setEligibilityLoading(false))
    return () => {
      cancelled = true
    }
  }, [datasetId, entityType, difficulty, offline])

  const persistSetup = (
    overrides: Partial<Pick<SoloConfig, 'datasetId' | 'difficulty' | 'entityType' | 'variation'>> & {
      roundDurationMs?: number
      clueRevealIntervalMs?: number
    } = {}
  ) => {
    const nextDatasetId = overrides.datasetId ?? datasetId
    if (!nextDatasetId) return
    saveSoloSetupPreferences({
      datasetId: nextDatasetId,
      difficulty: overrides.difficulty ?? difficulty,
      entityType: overrides.entityType ?? entityType,
      variation: overrides.variation ?? variation,
      roundDurationMs: overrides.roundDurationMs ?? roundSeconds * 1000,
      clueRevealIntervalMs: overrides.clueRevealIntervalMs ?? clueIntervalSeconds * 1000
    })
  }

  const start = async () => {
    if (!canStart) return
    setStarting(true)
    setError(null)
    unlockAudio()
    fadeOutMenuMusic()
    playSound('go')
    try {
      const query = new URLSearchParams({
        datasetId,
        difficulty: encodeDifficultySelection(difficulty),
        entityType
      })
      const response = await fetch(`${API_BASE_URL}/cards/deck?${query}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to load cards (${response.status})`)
      }
      const { entityIds } = (await response.json()) as { entityIds: string[] }
      const config = {
        datasetId,
        difficulty,
        entityType,
        variation,
        roundDurationMs: roundSeconds * 1000,
        clueRevealIntervalMs: clueIntervalSeconds * 1000
      }
      const session = createSoloSession(config, entityIds)
      saveSoloSetupPreferences(config)
      saveSoloSession(session)
      navigate('/solo/play')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start solo mode')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg font-display text-foreground">
      <header className="border-b border-edge bg-surface/95 px-3 py-2">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="flex size-10 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Solo mode</h1>
            <p className="text-xs text-foreground-muted">Set a personal best on this device</p>
          </div>
          <PreferencesMenu />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-3 py-4 space-y-4">
        <MaintenanceBanner status={maintenanceStatus} />
        {offline && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Internet required to load cards. Reconnect to start.
          </p>
        )}
        {loading && <LoadingState label="Loading content" layout="page" />}
        {error && (
          <p className="rounded-lg border border-red-400 bg-red-100 p-3 text-sm text-red-700">{error}</p>
        )}
        {!loading && datasets.length > 0 && (
          <section className="space-y-4 rounded-lg border border-edge bg-surface p-4 shadow-sm">
            {datasets.length > 1 && (
              <label className="block text-sm font-semibold">
                Content
                <select
                  value={datasetId}
                  onChange={(event) => {
                    setDatasetId(event.target.value)
                    persistSetup({ datasetId: event.target.value })
                  }}
                  className="mt-2 w-full rounded-lg bg-surface-muted p-2.5 font-normal"
                >
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm font-semibold">
              {ENTITY_TYPE_FIELD_LABEL}
              <select
                value={entityType}
                onChange={(event) => {
                  const nextEntityType = event.target.value as EntityTypeFilter
                  setEntityType(nextEntityType)
                  persistSetup({ entityType: nextEntityType })
                }}
                className="mt-2 w-full rounded-lg bg-surface-muted p-2.5 font-normal"
              >
                {ENTITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <DifficultyMultiSelect
              value={difficulty}
              onChange={(next) => {
                setDifficulty(next)
                persistSetup({ difficulty: next })
              }}
              disabled={eligibilityLoading}
              // anyCount={eligibility?.modes.any}
              tierCounts={{
                easy: eligibility?.modes.easy,
                medium: eligibility?.modes.medium,
                hard: eligibility?.modes.hard,
                nightmare: eligibility?.modes.nightmare
              }}
            />
            {!eligibilityLoading && eligibility && !selectionPlayable && (
              <p className="text-xs font-normal text-amber-700 dark:text-amber-300">
                Not enough clues for this difficulty mix. Choose another.
              </p>
            )}
            <fieldset>
              <legend className="text-sm font-semibold">Variation</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'challenge', label: 'Solo challenge', hint: '10 rounds' },
                    { value: 'endurance', label: 'Endurance', hint: 'Keep your streak alive' }
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setVariation(option.value)
                      persistSetup({ variation: option.value })
                    }}
                    className={`rounded-lg border p-3 text-left ${
                      variation === option.value ? 'border-primary bg-primary/10' : 'border-edge'
                    }`}
                  >
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="text-xs text-foreground-muted">{option.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">
                Card timer
                <select
                  value={roundSeconds}
                  onChange={(event) => {
                    const nextRoundSeconds = Number(event.target.value)
                    setRoundSeconds(nextRoundSeconds)
                    persistSetup({ roundDurationMs: nextRoundSeconds * 1000 })
                  }}
                  className="mt-2 w-full rounded-lg bg-surface-muted p-2.5 font-normal"
                >
                  {TIMER_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} seconds
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                New clue every
                <select
                  value={clueIntervalSeconds}
                  onChange={(event) => {
                    const nextClueIntervalSeconds = Number(event.target.value)
                    setClueIntervalSeconds(nextClueIntervalSeconds)
                    persistSetup({ clueRevealIntervalMs: nextClueIntervalSeconds * 1000 })
                  }}
                  className="mt-2 w-full rounded-lg bg-surface-muted p-2.5 font-normal"
                >
                  {CLUE_INTERVAL_OPTIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} seconds
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {currentBest && (
              <div className="rounded-lg bg-primary/10 p-3 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Best for this setup
                </p>
                <p className="mt-1 font-bold">
                  {currentBest.correctCount} correct · {formatSoloTime(currentBest.activeElapsedMs)}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void start()}
              disabled={!canStart}
              className="w-full rounded-lg bg-primary py-3 font-bold text-white disabled:opacity-50"
            >
              {starting
                ? 'Starting…'
                : variation === 'challenge'
                  ? 'Start 10-round challenge'
                  : 'Start Endurance'}
            </button>
          </section>
        )}

        {!loading && (
          <section className="rounded-lg border border-edge bg-surface p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">leaderboard</span>
              <h2 className="text-base font-bold">Personal bests</h2>
            </div>
            <p className="text-xs text-foreground-muted">
              Top 5 per mode on this device
              {selectedDatasetName ? ` · ${selectedDatasetName}` : ''}.
            </p>
            {!hasAnyRecords ? (
              <p className="text-sm text-foreground-muted">No records yet. Finish a run to set one.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold">Solo challenge</h3>
                  {challengeRecords.length === 0 ? (
                    <p className="text-sm text-foreground-muted">No challenge records yet.</p>
                  ) : (
                    renderRecordList(challengeRecords)
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold">Endurance</h3>
                  {enduranceRecords.length === 0 ? (
                    <p className="text-sm text-foreground-muted">No endurance records yet.</p>
                  ) : (
                    renderRecordList(enduranceRecords)
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default SoloSetup
