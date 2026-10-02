import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DifficultyMultiSelect } from '../components/DifficultyMultiSelect'
import LoadingState from '../components/LoadingState'
import MaintenanceBanner from '../components/MaintenanceBanner'
import PreferencesMenu from '../components/PreferencesMenu'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import { API_BASE_URL } from '../lib/apiBase'
import {
  fetchDailyChallenge,
  loadDailyProgress,
  type DailyChallenge
} from '../lib/dailySolo'
import {
  downloadSoloDailyPng,
  shareSoloDailyPng
} from '../lib/exportSoloDailyPng'
import { fetchOkJson } from '../lib/fetchOkJson'
import {
  logSetupLoadError,
  SETUP_CONTENT_LOAD_ERROR,
  SETUP_ELIGIBILITY_LOAD_ERROR,
  SETUP_START_ERROR
} from '../lib/setupLoadErrors'
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
  clearMasteryForDataset,
  getMasterySummary,
  getNeedsReviewEntityIds,
  rekeyMasteryToCatalog
} from '../lib/soloMastery'
import {
  createSoloSession,
  formatSoloRecordAchievedAt,
  formatSoloScore,
  formatSoloTime,
  getSoloRecord,
  listSoloRecords,
  loadSoloSession,
  loadSoloSetupPreferences,
  saveSoloSession,
  saveSoloSetupPreferences,
  soloConfigSummary,
  SOLO_CHALLENGE_ROUNDS,
  type KnowledgeScoreRules,
  type SoloConfig,
  type SoloRecord,
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
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [dailyError, setDailyError] = useState<string | null>(null)
  const [dailyProgress] = useState(loadDailyProgress)
  const [dailyShareState, setDailyShareState] = useState<
    'idle' | 'working' | 'shared' | 'downloaded' | 'error'
  >('idle')
  const [masteryTick, setMasteryTick] = useState(0)
  const [clearProgressOpen, setClearProgressOpen] = useState(false)
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
  const masterySummary = getMasterySummary(datasetId || undefined)
  const todayResult = dailyChallenge
    ? dailyProgress.results[dailyChallenge.challengeId]
    : undefined

  const renderRecordRow = (record: SoloRecord, opts?: { highlightCurrent?: boolean }) => {
    const isCurrent =
      opts?.highlightCurrent !== false &&
      currentConfig !== null &&
      record.difficulty === currentConfig.difficulty &&
      record.entityType === currentConfig.entityType &&
      record.roundDurationMs === currentConfig.roundDurationMs &&
      record.clueRevealIntervalMs === currentConfig.clueRevealIntervalMs
    const when = formatSoloRecordAchievedAt(record.achievedAt)
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-bold ${isCurrent ? 'text-primary' : ''}`}>
            {soloConfigSummary(record, { includeVariation: false })}
          </p>
          {when && <p className="mt-0.5 text-xs text-foreground-muted">{when}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-primary">
            {record.score == null
              ? record.correctCount
              : `${formatSoloScore(record.score)} pts`}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-foreground-muted">
            {record.correctCount} correct · {formatSoloTime(record.activeElapsedMs)}
          </p>
        </div>
      </div>
    )
  }

  const renderRecordMode = (title: string, records: SoloRecord[]) => {
    if (records.length === 0) {
      return (
        <div className="space-y-1">
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-sm text-foreground-muted">No records yet.</p>
        </div>
      )
    }

    const [best, ...rest] = records
    return (
      <details className="group rounded-lg border border-edge bg-surface-muted open:bg-surface">
        <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold">{title}</h3>
                {rest.length > 0 && (
                  <span className="material-symbols-outlined text-base text-foreground-muted transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                )}
              </div>
              <div className="mt-2">{renderRecordRow(best)}</div>
            </div>
          </div>
        </summary>
        {rest.length > 0 && (
          <ul className="space-y-2 border-t border-edge px-3 pb-3 pt-2">
            {rest.map((record) => (
              <li key={`${record.achievedAt}:${record.correctCount}:${record.activeElapsedMs}`}>
                {renderRecordRow(record)}
              </li>
            ))}
          </ul>
        )}
      </details>
    )
  }

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
    if (offline) {
      setDailyLoading(false)
      return
    }
    let cancelled = false
    setDailyLoading(true)
    fetchDailyChallenge()
      .then((challenge) => {
        if (!cancelled) setDailyChallenge(challenge)
      })
      .catch(() => {
        if (!cancelled) setDailyError('Today’s challenge could not load.')
      })
      .finally(() => {
        if (!cancelled) setDailyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [offline])

  useEffect(() => {
    let cancelled = false
    fetchOkJson<PublicDataset[]>(
      `${API_BASE_URL}/datasets`,
      (status) => `datasets ${status}`
    )
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
      .catch((err) => {
        if (cancelled) return
        logSetupLoadError('Solo setup: datasets', err)
        setError(SETUP_CONTENT_LOAD_ERROR)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!datasetId || offline) {
      setEligibilityLoading(false)
      return
    }
    let cancelled = false
    setEligibilityLoading(true)
    fetchInPersonEligibility(datasetId, entityType)
      .then((data) => {
        if (cancelled) return
        setEligibility(data)
        setDifficulty((current) => {
          if (!isDifficultySelectionPlayable(data, current) && (data.modes.any ?? 0) > 0) {
            return []
          }
          return current
        })
      })
      .catch((err) => {
        if (cancelled) return
        logSetupLoadError('Solo setup: eligibility', err)
        setError(SETUP_ELIGIBILITY_LOAD_ERROR)
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [datasetId, entityType, offline])

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
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        if (response.status === 503 && typeof body.error === 'string' && body.error.trim()) {
          throw new Error(body.error)
        }
        throw new Error(SETUP_START_ERROR)
      }
      const { entityIds, scoringVersion, scoringRules } = (await response.json()) as {
        entityIds: string[]
        scoringVersion?: number
        scoringRules?: KnowledgeScoreRules
      }
      const config = {
        datasetId,
        difficulty,
        entityType,
        variation,
        roundDurationMs: roundSeconds * 1000,
        clueRevealIntervalMs: clueIntervalSeconds * 1000
      }
      const session = createSoloSession(
        config,
        entityIds,
        scoringVersion != null && scoringRules
          ? { version: scoringVersion, rules: scoringRules }
          : undefined
      )
      saveSoloSetupPreferences(config)
      saveSoloSession(session)
      navigate('/solo/play')
    } catch (err) {
      logSetupLoadError('Solo setup: start', err)
      setError(err instanceof Error ? err.message : SETUP_START_ERROR)
    } finally {
      setStarting(false)
    }
  }

  const startDaily = () => {
    if (!dailyChallenge || offline || maintenanceBlocking) return
    const existing = loadSoloSession()
    if (
      existing?.variation === 'daily' &&
      existing.dailyChallengeId === dailyChallenge.challengeId
    ) {
      navigate('/solo/play')
      return
    }
    const session = createSoloSession(
      {
        datasetId: dailyChallenge.datasetId,
        difficulty: [],
        entityType: 'all',
        variation: 'daily',
        roundDurationMs: dailyChallenge.roundDurationMs,
        clueRevealIntervalMs: dailyChallenge.clueRevealIntervalMs,
        dailyChallengeId: dailyChallenge.challengeId,
        dailyDateKey: dailyChallenge.dateKey
      },
      dailyChallenge.entityIds,
      {
        version: dailyChallenge.scoringVersion,
        rules: dailyChallenge.scoringRules
      }
    )
    saveSoloSession(session)
    unlockAudio()
    fadeOutMenuMusic()
    playSound('go')
    navigate('/solo/play')
  }

  const canStartReview =
    Boolean(datasetId) &&
    masterySummary.needsReview > 0 &&
    !starting &&
    !offline &&
    !maintenanceBlocking

  const startReview = async () => {
    if (!canStartReview) return
    setStarting(true)
    setError(null)
    unlockAudio()
    fadeOutMenuMusic()
    playSound('go')
    try {
      // Ignore Custom game filters so missed cards stay reachable.
      const query = new URLSearchParams({
        datasetId,
        difficulty: 'any',
        entityType: 'all'
      })
      const response = await fetch(`${API_BASE_URL}/cards/deck?${query}`)
      if (!response.ok) throw new Error(SETUP_START_ERROR)
      const { entityIds, entities, scoringVersion, scoringRules } = (await response.json()) as {
        entityIds: string[]
        entities?: Array<{ id: string; name: string }>
        scoringVersion?: number
        scoringRules?: KnowledgeScoreRules
      }
      // Reimports mint new ids; remap Progress by name onto the live catalog.
      const catalog =
        entities ??
        entityIds.map((id) => ({ id, name: id }))
      const { remapped, removed } = rekeyMasteryToCatalog(datasetId, catalog)
      if (remapped > 0 || removed > 0) setMasteryTick((tick) => tick + 1)

      const eligibleIds = new Set(entityIds)
      const reviewDeck = getNeedsReviewEntityIds(datasetId).filter((id) => eligibleIds.has(id))
      if (reviewDeck.length === 0) {
        throw new Error(
          removed > 0 || remapped > 0
            ? 'Those review cards no longer match the current content. Miss a few again to rebuild Review.'
            : 'Those review cards are no longer available. Try again after the next update.'
        )
      }
      const session = createSoloSession(
        {
          datasetId,
          difficulty: [],
          entityType: 'all',
          variation: 'review',
          roundDurationMs: roundSeconds * 1000,
          clueRevealIntervalMs: clueIntervalSeconds * 1000
        },
        reviewDeck.slice(0, SOLO_CHALLENGE_ROUNDS),
        scoringVersion != null && scoringRules
          ? { version: scoringVersion, rules: scoringRules }
          : undefined
      )
      saveSoloSession(session)
      navigate('/solo/play')
    } catch (err) {
      setError(err instanceof Error ? err.message : SETUP_START_ERROR)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg font-display text-foreground">
      <header className="border-b border-edge bg-surface/95 px-3 py-2">
        <div className="setup-shell flex items-center gap-3">
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
      <main className="setup-shell space-y-4 px-3 py-4 md:px-4 md:py-6">
        <MaintenanceBanner status={maintenanceStatus} />
        {offline && (
          <p role="status" className="banner-warning">
            Internet required to load cards. Reconnect to start.
          </p>
        )}
        {loading && <LoadingState label="Loading content" layout="page" />}
        {error && (
          <p role="alert" className="banner-danger">{error}</p>
        )}
        {!dailyLoading && dailyChallenge && (
          <section className="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm md:p-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-2xl text-primary" aria-hidden>
                today
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Today&apos;s challenge
                </p>
                <h2 className="mt-1 text-lg font-black">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'long',
                    timeZone: 'UTC'
                  }).format(new Date(`${dailyChallenge.dateKey}T00:00:00Z`))}
                </h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {dailyChallenge.entityIds.length} cards · {dailyChallenge.datasetName}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  Current streak: {dailyProgress.currentStreak}{' '}
                  {dailyProgress.currentStreak === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>
            {todayResult ? (
              <div className="mt-4 space-y-2">
                <div className="banner-success flex items-center gap-2 py-2.5">
                  <p className="min-w-0 flex-1 text-left font-semibold">
                    Completed today · {formatSoloScore(todayResult.record.score ?? 0)} points
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDailyShareState('working')
                          void shareSoloDailyPng({
                            dateKey: dailyChallenge.dateKey,
                            datasetName: dailyChallenge.datasetName,
                            record: todayResult.record,
                            currentStreak: dailyProgress.currentStreak,
                            bestStreak: dailyProgress.bestStreak
                          })
                            .then(() => {
                              setDailyShareState('shared')
                              window.setTimeout(() => setDailyShareState('idle'), 2200)
                            })
                            .catch((err) => {
                              if (err instanceof Error && err.name === 'AbortError') {
                                setDailyShareState('idle')
                                return
                              }
                              console.warn('Solo daily share failed:', err)
                              setDailyShareState('error')
                              window.setTimeout(() => setDailyShareState('idle'), 2200)
                            })
                        }}
                        disabled={dailyShareState === 'working'}
                        aria-label="Share daily result image"
                        className="flex size-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-lg" aria-hidden>
                          {dailyShareState === 'working'
                            ? 'hourglass_top'
                            : dailyShareState === 'shared'
                              ? 'check'
                              : dailyShareState === 'error'
                                ? 'error'
                                : 'share'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDailyShareState('working')
                        void downloadSoloDailyPng({
                          dateKey: dailyChallenge.dateKey,
                          datasetName: dailyChallenge.datasetName,
                          record: todayResult.record,
                          currentStreak: dailyProgress.currentStreak,
                          bestStreak: dailyProgress.bestStreak
                        })
                          .then(() => {
                            setDailyShareState('downloaded')
                            window.setTimeout(() => setDailyShareState('idle'), 2200)
                          })
                          .catch((err) => {
                            console.warn('Solo daily download failed:', err)
                            setDailyShareState('error')
                            window.setTimeout(() => setDailyShareState('idle'), 2200)
                          })
                      }}
                      disabled={dailyShareState === 'working'}
                      aria-label="Download daily result image"
                      className="flex size-9 items-center justify-center rounded-lg border border-edge bg-surface text-foreground hover:bg-surface-muted disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden>
                        {dailyShareState === 'working'
                          ? 'hourglass_top'
                          : dailyShareState === 'downloaded'
                            ? 'check'
                            : dailyShareState === 'error'
                              ? 'error'
                              : 'download'}
                      </span>
                    </button>
                  </div>
                </div>
                <p className="text-center text-xs text-foreground-muted">
                  Save or share the image if you want to keep today&apos;s result.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={startDaily}
                disabled={offline || maintenanceBlocking}
                className="mt-4 w-full rounded-lg bg-primary py-3 font-bold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Play today
              </button>
            )}
          </section>
        )}
        {!dailyLoading && dailyError && !dailyChallenge && (
          <p className="text-center text-xs text-foreground-muted">{dailyError}</p>
        )}
        {!loading && (
          <section
            key={masteryTick}
            className="space-y-4 rounded-lg border border-edge bg-surface p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" aria-hidden>
                school
              </span>
              <div>
                <h2 className="text-base font-bold">Progress</h2>
                <p className="text-xs text-foreground-muted">
                  {selectedDatasetName
                    ? `Saved on this device for ${selectedDatasetName}.`
                    : 'Saved on this device.'}
                </p>
              </div>
            </div>
            <details className="rounded-lg bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                How learning works
              </summary>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-foreground-muted">
                <li>
                  <span className="font-semibold text-foreground">Needs review:</span> you missed or
                  ran out of time. Tap{' '}
                  <span className="font-semibold text-foreground">Review</span> below to try those
                  again.
                </li>
                <li>
                  <span className="font-semibold text-foreground">Learning:</span> you got it right
                  at least once.
                </li>
                <li>
                  <span className="font-semibold text-foreground">Mastered:</span> several right
                  answers, including one from the first clue.
                </li>
              </ul>
            </details>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  {
                    icon: 'visibility',
                    value: String(masterySummary.encountered),
                    label: 'Encountered',
                    iconClass: 'bg-primary/10 text-primary'
                  },
                  {
                    icon: 'verified',
                    value: String(masterySummary.mastered),
                    label: 'Mastered',
                    iconClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  },
                  {
                    icon: 'replay',
                    value: String(masterySummary.needsReview),
                    label: 'Needs review',
                    iconClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                  },
                  {
                    icon: 'bolt',
                    value:
                      masterySummary.firstClueAccuracy == null
                        ? '—'
                        : `${Math.round(masterySummary.firstClueAccuracy * 100)}%`,
                    label: 'First clue',
                    iconClass: 'bg-primary/10 text-primary'
                  }
                ] as const
              ).map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-w-0 flex-col gap-1 rounded-md border border-edge bg-surface p-3 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${stat.iconClass}`}
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden>
                        {stat.icon}
                      </span>
                    </div>
                    <p className="min-w-0 text-xs font-medium leading-tight text-foreground sm:text-sm">
                      {stat.label}
                    </p>
                  </div>
                  <p className="pl-10 text-xl font-bold tabular-nums text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
            {masterySummary.needsReview > 0 ? (
              <button
                type="button"
                onClick={() => void startReview()}
                disabled={!canStartReview}
                className="w-full rounded-lg bg-primary py-3 font-bold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {starting ? 'Starting…' : `Review ${masterySummary.needsReview} missed`}
              </button>
            ) : (
              <p className="rounded-lg border border-dashed border-edge px-3 py-3 text-center text-sm text-foreground-muted">
                Miss or time out a card in Daily, Classic, or Endurance.{' '}
                <span className="font-semibold text-foreground">Review</span> will show up here.
              </p>
            )}
            {masterySummary.encountered > 0 && (
              <button
                type="button"
                onClick={() => setClearProgressOpen(true)}
                className="w-full text-sm font-semibold text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear learning progress
              </button>
            )}
          </section>
        )}
        {!loading && datasets.length > 0 && (
          <section className="space-y-4 rounded-lg border border-edge bg-surface p-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold">Custom game</h2>
              <p className="text-xs text-foreground-muted">
                Choose your own content, difficulty, and timing.
              </p>
            </div>
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
              <p role="status" className="text-xs font-normal text-amber-700 dark:text-amber-300">
                Not enough clues for this difficulty mix. Choose another.
              </p>
            )}
            <fieldset>
              <legend className="text-sm font-semibold">Variation</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'challenge', label: 'Classic', hint: '10 rounds' },
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
                  {currentBest.score == null
                    ? `${currentBest.correctCount} correct · ${formatSoloTime(currentBest.activeElapsedMs)}`
                    : `${formatSoloScore(currentBest.score)} points · ${currentBest.correctCount} correct`}
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
                  ? 'Start Classic'
                  : 'Start Endurance'}
            </button>
          </section>
        )}

        {clearProgressOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm md:items-center md:p-6"
            role="presentation"
            onClick={() => setClearProgressOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-progress-title"
              className="w-full max-w-md rounded-t-2xl border border-edge bg-surface p-6 shadow-2xl md:rounded-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 id="clear-progress-title" className="text-lg font-black text-foreground">
                Clear learning progress?
              </h3>
              <p className="mt-2 text-sm text-foreground-muted">
                This clears which cards you&apos;ve met, mastered, or need to review
                {selectedDatasetName ? ` for ${selectedDatasetName}` : ''}. Personal bests and your
                daily streak stay put.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setClearProgressOpen(false)}
                  className="rounded-lg border-2 border-edge py-3 font-semibold hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (datasetId) clearMasteryForDataset(datasetId)
                    setMasteryTick((tick) => tick + 1)
                    setClearProgressOpen(false)
                  }}
                  className="rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-700"
                >
                  Clear progress
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <section className="rounded-lg border border-edge bg-surface p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">leaderboard</span>
              <h2 className="text-base font-bold">Personal bests</h2>
            </div>
            <p className="text-xs text-foreground-muted">
              {selectedDatasetName
                ? `Top 10 per mode on this device for ${selectedDatasetName}.`
                : 'Top 10 per mode on this device.'}
            </p>
            {!hasAnyRecords ? (
              <p className="text-sm text-foreground-muted">No records yet. Finish a run to set one.</p>
            ) : (
              <div className="space-y-2">
                {renderRecordMode('Classic', challengeRecords)}
                {renderRecordMode('Endurance', enduranceRecords)}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

export default SoloSetup
