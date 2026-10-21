import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PreferencesMenu from '../components/PreferencesMenu'
import { loadDailyProgress } from '../lib/dailySolo'
import { listEntityMastery, masteryStage } from '../lib/soloMastery'
import { formatSoloScore, formatSoloTime } from '../lib/soloSession'
import {
  computeDailyExtras,
  computeModeStats,
  findNemesis,
  STATS_MIN_DAYS,
  statsDayFromDaily,
  statsDayFromTrend,
  type ModeStats
} from '../lib/soloStats'
import { describeSoloSetup, listTrendDays, parseSetupKey, type TimeOfDay } from '../lib/soloTrends'

type Mode = 'daily' | 'challenge' | 'endurance'

const MODES: Array<{ id: Mode; label: string; runs: string; run: string }> = [
  { id: 'daily', label: 'Daily', runs: 'Dailies', run: 'Daily' },
  { id: 'challenge', label: 'Classic', runs: 'Classic runs', run: 'run' },
  { id: 'endurance', label: 'Endurance', runs: 'Endurance runs', run: 'run' }
]

const TIME_OF_DAY: Record<TimeOfDay, string> = {
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
  night: 'Nights'
}

const percent = (value: number | null) => (value == null ? '—' : `${Math.round(value * 100)}%`)
const score = (value: number | null) => (value == null ? '—' : formatSoloScore(value))
const seconds = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`)
const oneDecimal = (value: number | null) => (value == null ? '—' : value.toFixed(1))
const shortDate = (dateKey: string) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${dateKey}T00:00:00Z`)
  )
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
const weekdayName = (weekday: number) =>
  // 4 Jan 2026 was a Sunday, so day `weekday` of that week has the right name.
  new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 0, 4 + weekday))
  )

function Section({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-edge bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary" aria-hidden>
          {icon}
        </span>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Tiles({ items }: { items: Array<{ label: string; value: string; hint?: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-md border border-edge bg-surface-muted/40 p-3">
          <dt className="text-xs font-medium text-foreground-muted">{item.label}</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-foreground">{item.value}</dd>
          {item.hint && <dd className="mt-0.5 text-xs text-foreground-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** Plain CSS columns; the list underneath carries the same numbers for screen readers. */
function Columns({ caption, bars }: { caption: string; bars: Array<{ label: string; value: number; display: string }> }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  return (
    <figure>
      <figcaption className="text-xs font-semibold text-foreground-muted">{caption}</figcaption>
      <div className="mt-2 flex h-36 gap-1.5" aria-hidden>
        {bars.map((bar) => (
          <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-foreground-muted">{bar.display}</span>
            <div className="relative w-full flex-1">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t bg-primary/70"
                style={{ height: `${Math.max(4, (bar.value / max) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-foreground-muted">{bar.label}</span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {bars.map((bar) => (
          <li key={bar.label}>
            {bar.label}: {bar.display}
          </li>
        ))}
      </ul>
    </figure>
  )
}

function ClueBars({ solvedOnClue }: { solvedOnClue: number[] }) {
  const max = Math.max(1, ...solvedOnClue)
  return (
    <figure>
      <figcaption className="text-xs font-semibold text-foreground-muted">Cards solved on each clue</figcaption>
      <ul className="mt-2 space-y-1.5">
        {solvedOnClue.map((count, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span className="w-12 shrink-0 font-medium text-foreground-muted">Clue {index + 1}</span>
            <span className="h-3 flex-1 rounded bg-surface-muted" aria-hidden>
              <span className="block h-full rounded bg-primary/70" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-foreground">{count}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function FavouriteSetup({ stats }: { stats: ModeStats }) {
  const favourite = stats.favouriteSetup
  const setup = favourite ? parseSetupKey(favourite.key) : null
  if (!favourite || !setup) return null
  const { what, timing } = describeSoloSetup(setup)
  return (
    <div className="rounded-md border border-edge bg-surface-muted/40 p-3">
      <p className="text-xs font-medium text-foreground-muted">Your usual setup</p>
      <p className="mt-1 font-bold text-foreground">{what}</p>
      <p className="text-sm text-foreground">{timing}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">
        {favourite.share === 1 ? 'Every run so far' : `${percent(favourite.share)} of your runs`}
      </p>
    </div>
  )
}

function ModeSections({ mode, stats }: { mode: Mode; stats: ModeStats }) {
  const { run } = MODES.find((entry) => entry.id === mode)!
  const endurance = mode === 'endurance'
  return (
    <>
      <Section title="Scores" icon="trending_up">
        <Tiles
          items={[
            { label: 'Average', value: score(stats.averageScore) },
            {
              label: 'Best',
              value: score(stats.bestScore?.score ?? null),
              hint: stats.bestScore ? shortDate(stats.bestScore.dateKey) : undefined
            },
            { label: 'Last 30 days', value: score(stats.last30Average), hint: 'average' }
          ]}
        />
        {stats.months.length > 1 &&
          (endurance ? (
            <Columns
              caption="Longest run each month"
              bars={stats.months.map((month) => ({
                label: monthLabel(month.month),
                value: month.longestRun,
                display: String(month.longestRun)
              }))}
            />
          ) : (
            <Columns
              caption="Average score each month"
              bars={stats.months.map((month) => ({
                label: monthLabel(month.month),
                value: month.averageScore ?? 0,
                display: month.averageScore == null ? '—' : `${(month.averageScore / 1000).toFixed(1)}k`
              }))}
            />
          ))}
      </Section>

      <Section title="Clues" icon="lightbulb">
        <Tiles
          items={[
            ...(endurance ? [] : [{ label: 'Cards right', value: percent(stats.accuracy) }]),
            { label: 'Clues per correct card', value: oneDecimal(stats.averageClues) },
            { label: 'Solved on clue 1', value: percent(stats.firstClueRate) }
          ]}
        />
        {stats.solvedOnClue.length > 0 && <ClueBars solvedOnClue={stats.solvedOnClue} />}
      </Section>

      <Section title="Speed" icon="timer">
        <Tiles
          items={[
            { label: `Time per ${run}`, value: stats.averageTimeMs == null ? '—' : formatSoloTime(stats.averageTimeMs) },
            { label: 'Time per card', value: seconds(stats.averageTimePerCardMs) },
            { label: 'Fastest solve', value: seconds(stats.fastestSolveMs) }
          ]}
        />
      </Section>

      <Section title="Guessing" icon="edit_note">
        <Tiles
          items={[
            { label: `Wrong guesses per ${run}`, value: oneDecimal(stats.averageWrongGuesses) },
            ...(mode === 'daily' ? [{ label: 'Clean Dailies', value: String(stats.cleanDays), hint: 'no wrong guesses' }] : [])
          ]}
        />
      </Section>

      <Section title="Habits" icon="schedule">
        <Tiles
          items={[
            { label: 'You usually play', value: stats.usualTimeOfDay ? TIME_OF_DAY[stats.usualTimeOfDay] : '—' },
            {
              label: 'Best day',
              value: stats.bestWeekday ? weekdayName(stats.bestWeekday.weekday) : '—',
              hint: stats.bestWeekday ? `${formatSoloScore(stats.bestWeekday.average)} average` : 'needs two of the same weekday'
            }
          ]}
        />
      </Section>

      {stats.byType.place[1] > 0 && (
        <Section title="Characters and places" icon="category">
          <Tiles
            items={[
              { label: 'Characters right', value: percent(stats.byType.character[0] / Math.max(1, stats.byType.character[1])) },
              { label: 'Places right', value: percent(stats.byType.place[0] / stats.byType.place[1]) }
            ]}
          />
        </Section>
      )}
    </>
  )
}

function SoloStats() {
  const [mode, setMode] = useState<Mode>('daily')
  const dailyProgress = useMemo(loadDailyProgress, [])
  const days = useMemo(
    () => ({
      daily: Object.values(dailyProgress.summaries).map(statsDayFromDaily),
      challenge: listTrendDays('challenge').map(statsDayFromTrend),
      endurance: listTrendDays('endurance').map(statsDayFromTrend)
    }),
    [dailyProgress]
  )
  const stats = useMemo(() => computeModeStats(days[mode]), [days, mode])
  const dailyExtras = useMemo(() => computeDailyExtras(dailyProgress), [dailyProgress])
  const entities = useMemo(() => listEntityMastery(), [])
  const nemesis = findNemesis(entities)
  const current = MODES.find((entry) => entry.id === mode)!
  const enough = mode === 'daily' ? stats.daysPlayed >= STATS_MIN_DAYS : stats.runs >= STATS_MIN_DAYS

  return (
    <div className="flex min-h-screen flex-col bg-app-bg font-display text-foreground">
      <header className="border-b border-edge bg-surface/95 px-3 py-2">
        <div className="setup-shell flex items-center gap-3">
          <Link
            to="/solo"
            aria-label="Back to Solo mode"
            className="flex size-10 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Stats for nerds</h1>
            <p className="text-xs text-foreground-muted">Saved on this device</p>
          </div>
          <PreferencesMenu />
        </div>
      </header>

      <main className="setup-shell space-y-4 px-3 py-4 md:px-4 md:py-6">
        <div role="tablist" aria-label="Mode" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={mode === entry.id}
              onClick={() => setMode(entry.id)}
              className={`rounded-md py-2 text-sm font-bold ${
                mode === entry.id ? 'bg-surface text-primary shadow-sm' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {!enough ? (
          <p className="rounded-lg border border-dashed border-edge px-3 py-6 text-center text-sm text-foreground-muted">
            {mode === 'daily'
              ? 'Play a few Dailies and your stats will show up here.'
              : `Finish a few ${current.runs} and your stats will show up here. They count from this update on.`}
          </p>
        ) : (
          <>
            {mode === 'daily' ? (
              <Section title="Daily habit" icon="today">
                <Tiles
                  items={[
                    {
                      label: 'Dailies played',
                      value: String(stats.daysPlayed),
                      hint: `${percent(stats.daysPlayed / Math.max(1, dailyExtras.daysSinceFirst))} of days since your first`
                    },
                    { label: 'Current streak', value: String(dailyExtras.currentStreak) },
                    { label: 'Best streak', value: String(dailyExtras.bestStreak) },
                    { label: 'Rest days used', value: String(dailyExtras.restDaysUsed) },
                    { label: 'Perfect Dailies', value: String(dailyExtras.perfectDays), hint: 'every card right' }
                  ]}
                />
              </Section>
            ) : (
              <Section title={mode === 'endurance' ? 'Runs' : 'Activity'} icon={mode === 'endurance' ? 'local_fire_department' : 'trophy'}>
                <Tiles
                  items={[
                    { label: 'Runs', value: String(stats.runs) },
                    { label: 'Days played', value: String(stats.daysPlayed) },
                    ...(mode === 'endurance'
                      ? [
                          { label: 'Longest run', value: String(stats.longestRun), hint: 'cards in a row' },
                          { label: 'Average run', value: oneDecimal(stats.averageRunLength), hint: 'cards' }
                        ]
                      : [])
                  ]}
                />
                <FavouriteSetup stats={stats} />
              </Section>
            )}
            <ModeSections mode={mode} stats={stats} />
          </>
        )}

        <Section title="Learning, all modes" icon="school">
          <Tiles
            items={[
              { label: 'Cards found', value: String(entities.filter((entity) => entity.correctCount > 0).length) },
              {
                label: 'Mastered',
                value: String(
                  entities.filter(
                    (entity) => masteryStage(entity.correctCount, entity.firstClueCorrectCount) === 'mastered'
                  ).length
                )
              },
              {
                label: 'First-clue solves',
                value: String(entities.reduce((total, entity) => total + entity.firstClueCorrectCount, 0))
              }
            ]}
          />
          {nemesis && (
            <div className="flex items-center gap-3 rounded-md border border-edge bg-surface-muted/40 p-3">
              <span className="material-symbols-outlined text-amber-700 dark:text-amber-300" aria-hidden>
                swords
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground-muted">Your nemesis</p>
                {nemesis.state === 'needs_review' ? (
                  <p className="text-lg font-bold">
                    {/* Same placeholder as the collection, so a card waiting in Review stays hidden. */}
                    <span className="select-none blur-sm" aria-hidden>
                      Hidden card
                    </span>
                    <span className="sr-only">A card waiting in Review</span>
                  </p>
                ) : (
                  <p className="truncate text-lg font-bold">{nemesis.entityName}</p>
                )}
                <p className="text-xs text-foreground-muted">
                  Missed {nemesis.missCount} {nemesis.missCount === 1 ? 'time' : 'times'}, right {nemesis.correctCount}{' '}
                  {nemesis.correctCount === 1 ? 'time' : 'times'}
                  {nemesis.state === 'needs_review' ? '. Waiting in Review.' : ''}
                </p>
              </div>
            </div>
          )}
        </Section>
      </main>
    </div>
  )
}

export default SoloStats
