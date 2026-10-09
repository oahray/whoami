import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import { AdminLayout } from '../components/AdminLayout'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/AuthContext'
import type { PlayTotalsRange, PlayTotalsToday, SoloModePlayTotals } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

const RANGES: Array<{ value: PlayTotalsRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

const SOLO_MODES: Array<{ key: keyof PlayTotalsToday['solo']; label: string }> = [
  { key: 'daily', label: 'Daily' },
  { key: 'classic', label: 'Classic' },
  { key: 'endurance', label: 'Endurance' },
  { key: 'review', label: 'Review' },
]

function formatUtcDay(day: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`)
  )
}

function rangeLabel(totals: PlayTotalsToday): string {
  const end = formatUtcDay(totals.to)
  if (totals.range === 'today') return `Today · ${end} UTC`
  if (totals.range === 'yesterday') return `Yesterday · ${end} UTC`
  if (totals.range === 'all') return `All time · through ${end} UTC`
  const start = totals.from ? formatUtcDay(totals.from) : end
  if (totals.range === 'week') return `This week · ${start} – ${end} UTC`
  return `This month · ${start} – ${end} UTC`
}

function ModeCards({ mode }: { mode: SoloModePlayTotals }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard icon="play_arrow" label="Started" value={mode.started} />
      <StatCard icon="flag" label="Completed" value={mode.completed} iconTone="success" />
    </div>
  )
}

function AdminAnalytics() {
  const { getAccessToken } = useAuth()
  const navigate = useNavigate()
  const [range, setRange] = useState<PlayTotalsRange>('today')
  const [totals, setTotals] = useState<PlayTotalsToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      setError('')
      const token = await getAccessToken()
      if (!token) {
        navigate('/login')
        return
      }
      const res = await fetch(`${API_BASE_URL}/admin/play-totals?range=${range}`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Failed to load analytics')
      setTotals((await res.json()) as PlayTotalsToday)
      setFetchedAt(new Date())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [getAccessToken, navigate, range])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <AdminLayout breadcrumb="Analytics" title="Analytics">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="play-totals-range" className="sr-only">
          Date range
        </label>
        <select
          id="play-totals-range"
          value={range}
          onChange={(event) => setRange(event.target.value as PlayTotalsRange)}
          style={{ width: `calc(${(RANGES.find((option) => option.value === range)?.label.length ?? 5)}ch + 4.5rem)` }}
          className="admin-select bg-admin-panel border border-admin-border rounded-md text-sm py-2.5 pl-3.5 text-admin-fg font-medium focus:border-primary focus:ring-2 focus:ring-primary/25"
        >
          {RANGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:text-primary/80 disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingState label="Loading" layout="inline" />
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          <p className="text-admin-muted text-sm mb-6">
            {totals ? rangeLabel(totals) : 'UTC'}. Event counts, not unique people. Started minus
            completed is games that began and never finished. A game that crosses midnight counts on
            both days.
            {fetchedAt ? ` Updated ${fetchedAt.toLocaleTimeString()}.` : ''}
          </p>

          <section className="mb-8">
            <h2 className="text-admin-fg text-lg font-bold mb-1">Multiplayer</h2>
            <p className="text-admin-muted text-sm mb-4">
              Rooms and games on the server. Coming back to a room does not count again.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard icon="add_box" label="Rooms created" value={totals?.multiplayer.roomsCreated ?? '—'} />
              <StatCard icon="play_arrow" label="Games started" value={totals?.multiplayer.gamesStarted ?? '—'} />
              <StatCard
                icon="flag"
                label="Games completed"
                value={totals?.multiplayer.gamesCompleted ?? '—'}
                iconTone="success"
              />
              <StatCard
                icon="door_front"
                label="Abandoned before start"
                value={totals?.multiplayer.abandonedBeforeStart ?? '—'}
              />
              <StatCard
                icon="login"
                label="Player connections"
                value={totals?.multiplayer.playerConnections ?? '—'}
              />
            </div>
          </section>

          <section>
            <h2 className="text-admin-fg text-lg font-bold mb-1">Solo</h2>
            <p className="text-admin-muted text-sm mb-4">Each mode is counted on its own.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SOLO_MODES.map((mode) => (
                <div key={mode.key} className="rounded-md border border-admin-border bg-admin-panel p-4">
                  <h3 className="text-admin-fg font-bold mb-3">{mode.label}</h3>
                  {totals ? <ModeCards mode={totals.solo[mode.key]} /> : <p className="text-admin-muted">—</p>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminLayout>
  )
}

export default AdminAnalytics
