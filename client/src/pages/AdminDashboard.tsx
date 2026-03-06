import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AdminLayout } from '../components/AdminLayout'
import type { Stats, Difficulty } from '../types'

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3001'

function deriveAvgDifficulty(stats: Stats): string {
  const { publishedCount } = stats
  const entries = (['easy', 'medium', 'hard', 'nightmare'] as Difficulty[]).map(d => ({ d, n: publishedCount[d] || 0 }))
  const max = entries.reduce((a, b) => (b.n > a.n ? b : a), { d: 'medium', n: 0 })
  if (max.n === 0) return '—'
  return max.d.charAt(0).toUpperCase() + max.d.slice(1)
}

function getDifficultyDotColor(count: number): string {
  if (count >= 10) return 'bg-green-500'
  if (count >= 5) return 'bg-amber-500'
  return 'bg-red-500'
}

function AdminDashboard() {
  const { getAccessToken } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getAccessToken()
      if (!token) {
        navigate('/admin/login')
        return
      }
      const res = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Request failed')
      const data = (await res.json()) as Stats
      setStats(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
      if (err instanceof Error && (err.message.includes('Unauthorized') || err.message.includes('Forbidden'))) {
        navigate('/admin/login')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout breadcrumb="Overview / Dashboard" title="Admin Dashboard">
        <div className="flex items-center justify-center py-24">
          <div className="text-slate-600">Loading...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout breadcrumb="Overview / Dashboard" title="Admin Dashboard">
      {error && (
        <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* High-Level Statistics */}
      <section className="mb-8">
        <h2 className="text-slate-900 text-xl md:text-2xl font-bold mb-4">
          High-Level Statistics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-md p-2 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">track_changes</span>
              <span className="text-green-600 text-xs font-semibold flex items-center gap-0.5">+12% <span className="material-symbols-outlined text-sm">trending_up</span></span>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-3">Total Entities</p>
            <p className="text-slate-900 text-2xl font-bold mt-1">{stats?.totalEntities ?? 0}</p>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
              <span className="text-slate-500 text-xs font-semibold">Total</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-3">Total Clues</p>
            <p className="text-slate-900 text-2xl font-bold mt-1">{stats?.totalClues ?? 0}</p>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">analytics</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-3">Avg Clues / Entity</p>
            <p className="text-slate-900 text-2xl font-bold mt-1">{stats?.avgCluesPerEntity ?? 0}</p>
          </div>
          <div className="bg-white rounded-md p-5 shadow-sm border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">draft</span>
            </div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-3">Unpublished</p>
            <p className="text-slate-900 text-2xl font-bold mt-1">{stats?.unpublishedCount ?? 0}</p>
          </div>
        </div>
      </section>

      {/* Published by Difficulty */}
      {stats && (
        <section className="mb-8">
          <h2 className="text-slate-900 text-xl md:text-2xl font-bold mb-4">
            Published by Difficulty
          </h2>
          <div className="bg-white rounded-md p-5 shadow-sm border border-slate-200">
            <p className="text-slate-600 text-sm font-medium mb-4">Number of published entities per difficulty level.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['easy', 'medium', 'hard', 'nightmare'] as Difficulty[]).map((difficulty) => {
                const count = stats.publishedCount[difficulty] ?? 0
                const dotColor = getDifficultyDotColor(count)
                return (
                  <div key={difficulty} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className={`size-3 rounded-full shrink-0 ${dotColor}`} title={count >= 10 ? 'Good' : count >= 5 ? 'Moderate' : 'Low'} />
                    <div>
                      <p className="text-slate-900 font-semibold capitalize">{difficulty}</p>
                      <p className="text-slate-600 text-sm">{count} entities</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Link to entity management */}
      <section>
        <div className="bg-white rounded-md p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-slate-900 text-lg font-bold mb-1">Manage Entities</h2>
            <p className="text-slate-600 text-sm">Create, edit, and publish entities and clues.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/entities')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined">database</span>
            Open Entities
          </button>
        </div>
      </section>
    </AdminLayout>
  )
}

export default AdminDashboard
