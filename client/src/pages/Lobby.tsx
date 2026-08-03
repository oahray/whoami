import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DifficultyMultiSelect } from '../components/DifficultyMultiSelect'
import PlayerAvatar from '../components/PlayerAvatar'
import PreferencesMenu from '../components/PreferencesMenu'
import { fadeOutMenuMusic } from '../lib/menuMusic'
import { playSound, unlockAudio } from '../lib/sounds'
import { useMenuMusic } from '../hooks/useMenuMusic'
import {
  coerceDifficultySelection,
  encodeDifficultySelection,
  formatDifficultySelection
} from '../lib/difficultySelection'
import {
  ENTITY_TYPE_FIELD_LABEL,
  ENTITY_TYPE_HINT_LOBBY,
  ENTITY_TYPE_OPTIONS,
  entityTypeOptionLabel
} from '../lib/entityTypeFilter'
import MaintenanceBanner from '../components/MaintenanceBanner'
import { useGame } from '../hooks/useGame'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'
import { useSocket } from '../hooks/useSocket'
import { isMaintenanceBlockingNewGames } from '../lib/maintenance'
import type { PublicDataset } from '../types'

const COPIED_FEEDBACK_MS = 2000
const API_BASE_URL =
  import.meta.env.VITE_SOCKET_URL?.replace('ws://', 'http://').replace('wss://', 'https://') ||
  'http://localhost:3001'

function Lobby() {
  const navigate = useNavigate()
  useMenuMusic()
  const { emit, on, off } = useSocket()
  const { status: maintenanceStatus } = useMaintenanceStatus()
  const maintenanceBlocking = isMaintenanceBlockingNewGames(maintenanceStatus)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [datasets, setDatasets] = useState<PublicDataset[]>([])
  const {
    roomCode,
    isHost,
    players,
    settings,
    gameState,
    error,
    setError,
    reset,
    playerId,
    isReconnecting
  } = useGame()
  const hasStoredRoom = typeof window !== 'undefined' && !!localStorage.getItem('whoami_room')

  useEffect(() => {
    if (!roomCode && !isReconnecting && !hasStoredRoom) {
      const timer = setTimeout(() => {
        if (!roomCode && !isReconnecting && !hasStoredRoom) navigate('/')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [roomCode, isReconnecting, hasStoredRoom, navigate])

  useEffect(() => {
    const handleRoundStarted = () => navigate('/game')
    on('ROUND_STARTED', handleRoundStarted)
    return () => off('ROUND_STARTED', handleRoundStarted)
  }, [on, off, navigate])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/datasets`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load datasets (${res.status})`)
        return (await res.json()) as PublicDataset[]
      })
      .then((rows) => {
        if (cancelled) return
        setDatasets(rows)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load datasets for lobby:', err)
        setDatasets([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (gameState && gameState.phase !== 'ended' && gameState.phase !== 'starting') {
      navigate('/game')
    }
  }, [gameState, navigate])

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), COPIED_FEEDBACK_MS)
    })
  }

  const handleCopyLink = () => {
    if (!roomCode || typeof window === 'undefined') return
    navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}`).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), COPIED_FEEDBACK_MS)
    })
  }

  const handleStartGame = () => {
    if (players.filter(p => p.isConnected).length < 2) {
      setError('Need at least 2 players to start')
      return
    }
    unlockAudio()
    fadeOutMenuMusic()
    playSound('go')
    try {
      sessionStorage.setItem('whoami_go_played', '1')
    } catch {
      // ignore
    }
    emit('START_GAME', {})
  }

  const handleLeaveRoom = () => {
    emit('LEAVE_ROOM', {})
    localStorage.removeItem('whoami_room')
    reset()
    navigate('/')
  }

  const handleUpdateSetting = (key: string, value: unknown) => {
    if (!isHost) return
    emit('UPDATE_SETTINGS', { [key]: value })
  }

  const handleResetDefaults = () => {
    if (!isHost) return
    emit('UPDATE_SETTINGS', {
      roundDuration: 30000,
      clueRevealTime: 10000,
      totalRounds: 5,
      difficultyMode: 'any',
      entityType: 'character',
      strictMode: false,
      transparencyMode: 'full'
    })
  }

  if (!roomCode) return null

  const connectedCount = players.filter(p => p.isConnected).length

  return (
    <div className="min-h-screen flex flex-col bg-app-bg font-display text-foreground antialiased">
      <header className="sticky top-0 z-10 flex items-center bg-surface px-4 md:px-6 py-2 md:py-4 border-b border-edge">
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="text-foreground-muted flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface-elevated md:size-auto md:px-0 md:py-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-foreground text-lg font-bold leading-tight tracking-tight flex-1 text-center">Room Lobby <span className="text-sm text-foreground-muted">({roomCode})</span></h1>
        <div className="flex items-center gap-1 shrink-0">
          <PreferencesMenu />
          <button
            type="button"
            onClick={handleLeaveRoom}
            className="text-red-500 text-sm font-bold md:px-4 md:py-2 md:rounded-full md:bg-surface-elevated md:text-foreground md:hover:bg-surface-elevated md:font-semibold"
          >
            Leave Room
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col gap-6 flex-1">
        <MaintenanceBanner status={maintenanceStatus} />
        <section className="bg-surface rounded-lg p-5 shadow-sm border border-edge">
          <div className="flex flex-row items-center justify-between gap-4">
            <div className="flex flex-col min-w-0">
              <span className="text-foreground-muted text-xs font-semibold uppercase tracking-wider">Room Code</span>
              <p className="text-foreground text-2xl md:text-3xl font-black tracking-widest mt-1 text-primary">{roomCode}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy code"
                className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors md:size-auto md:px-4 md:py-2 md:rounded-lg md:bg-surface-elevated md:font-semibold md:flex md:items-center md:gap-2"
              >
                {copiedCode ? (
                  <>
                    <span className="material-symbols-outlined text-xl md:text-lg">check</span>
                    <span className="hidden md:inline text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl md:text-lg">content_copy</span>
                    <span className="hidden md:inline text-sm">Copy Code</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                title="Copy link"
                className="flex size-10 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors md:size-auto md:px-4 md:py-2 md:rounded-lg md:bg-surface-elevated md:text-primary md:font-semibold md:flex md:items-center md:gap-2 md:hover:bg-surface-elevated"
              >
                {copiedLink ? (
                  <>
                    <span className="material-symbols-outlined text-xl md:text-lg">check</span>
                    <span className="hidden md:inline text-sm">Copied!</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl md:text-lg">share</span>
                    <span className="hidden md:inline text-sm">Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-muted p-3 rounded-lg mt-4">
            <span className="material-symbols-outlined text-primary text-sm shrink-0">info</span>
            <p className="text-foreground-muted text-xs md:text-sm">Share this code or link with your friends to join the game.</p>
          </div>
        </section>

        {error && (
          <div className="p-3 bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm flex items-start gap-2">
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-0.5 hover:bg-red-200/60 dark:hover:bg-red-900/40"
            >
              <span className="material-symbols-outlined text-base leading-none">close</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <section className="bg-surface rounded-lg p-5 shadow-sm border border-edge">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-foreground text-lg font-bold tracking-tight">Connected Players</h2>
              <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">{connectedCount} / 10</span>
            </div>
            <div className="space-y-3">
              {players.filter(p => p.isConnected).map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 px-4 py-2 rounded-lg border ${
                    player.isHost ? 'border-primary/30 bg-primary/5' : 'border-edge bg-surface-muted/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <PlayerAvatar
                      avatarId={player.avatarId}
                      nickname={player.nickname}
                      sizeClassName="size-12"
                    />
                    <div className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-surface" title="Connected" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-foreground font-bold truncate">{player.nickname}</p>
                      {player.isHost && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase shrink-0">
                          Host
                        </span>
                      )}
                    </div>
                    <p className="text-foreground-muted text-xs italic mt-0.5">
                      {player.id === playerId ? 'You' : 'Ready'}
                    </p>
                  </div>
                  {isHost && !player.isHost && (
                    <button
                      type="button"
                      onClick={() => emit('KICK_PLAYER', { playerId: player.id })}
                      className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 font-semibold shrink-0"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!isHost && (
              <div className="mt-4 w-full text-center text-sm text-foreground-muted py-2">
                Waiting for host to start the game…
              </div>
            )}
          </section>

          {settings && (
            <section className="bg-surface rounded-lg p-5 shadow-sm border border-edge">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">settings</span>
                <h2 className="text-foreground text-lg font-bold tracking-tight">
                  Game Settings
                  {!isHost && <span className="text-foreground-muted font-normal text-sm ml-1">(Only host can change)</span>}
                </h2>
              </div>
              <div className="space-y-6">
              {datasets.length > 1 && (
                <div>
                  <label htmlFor="datasetPicker" className="block text-foreground text-sm font-semibold mb-2">Content</label>
                  {isHost ? (
                    <select
                      id="datasetPicker"
                      value={settings.datasetId ?? ''}
                      onChange={(e) =>
                        handleUpdateSetting('datasetId', e.target.value === '' ? null : e.target.value)
                      }
                      className="w-full bg-surface-muted border-0 rounded-lg text-foreground focus:ring-2 focus:ring-primary py-2.5 px-3"
                    >
                      <option value="">
                        Default ({datasets.find((d) => d.is_default)?.name ?? datasets[0]?.name ?? '-'})
                      </option>
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.source ? ` (${d.source})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="py-2.5 px-3 bg-surface-muted rounded-lg text-foreground">
                      {datasets.find((d) => d.id === settings.datasetId)?.name ??
                        datasets.find((d) => d.is_default)?.name ??
                        datasets[0]?.name ??
                        '-'}
                    </div>
                  )}
                  {(() => {
                    const active =
                      datasets.find((d) => d.id === settings.datasetId) ??
                      datasets.find((d) => d.is_default) ??
                      datasets[0]
                    if (!active) return null
                    const bits = [active.description, active.source].filter(Boolean)
                    if (bits.length === 0) return null
                    return (
                      <p className="text-xs text-foreground-muted mt-1">
                        {bits.join(' · ')}
                      </p>
                    )
                  })()}
                </div>
              )}

              {datasets.length === 1 && (datasets[0].source || datasets[0].description) && (
                <div className="text-xs text-foreground-muted">
                  Content: <span className="font-medium text-foreground-muted">{datasets[0].name}</span>
                  {datasets[0].source ? ` · ${datasets[0].source}` : ''}
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-foreground text-sm font-semibold">Total Rounds</label>
                  <span className="text-primary font-bold">{settings.totalRounds} Rounds</span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={3}
                    max={10}
                    value={settings.totalRounds}
                    onChange={(e) => handleUpdateSetting('totalRounds', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-elevated rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full" style={{ width: `${((settings.totalRounds - 3) / 7) * 100}%` }} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-foreground text-sm font-semibold">Round Duration</label>
                  <span className="text-primary font-bold">{settings.roundDuration / 1000}s</span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={10000}
                    max={60000}
                    step={5000}
                    value={settings.roundDuration}
                    onChange={(e) => handleUpdateSetting('roundDuration', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-elevated rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full" style={{ width: `${((settings.roundDuration - 10000) / 50000) * 100}%` }} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-foreground text-sm font-semibold">Clue Reveal Interval</label>
                  <span className="text-primary font-bold">{settings.clueRevealTime / 1000}s</span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={2000}
                    max={Math.max(2000, settings.roundDuration - 2000)}
                    step={1000}
                    value={settings.clueRevealTime}
                    onChange={(e) => handleUpdateSetting('clueRevealTime', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-elevated rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full"
                      style={{
                        width: settings.roundDuration > 0
                          ? `${(settings.clueRevealTime / settings.roundDuration) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                )}
                <p className="text-xs text-foreground-muted mt-1">Time between each clue reveal. Shorter intervals reveal more clues per round.</p>
              </div>

              <div>
                {isHost ? (
                  <DifficultyMultiSelect
                    id="difficultyMode"
                    value={coerceDifficultySelection(settings.difficultyMode)}
                    onChange={(next) =>
                      handleUpdateSetting('difficultyMode', encodeDifficultySelection(next))
                    }
                  />
                ) : (
                  <>
                    <p className="block text-foreground text-sm font-semibold mb-2">Difficulty</p>
                    <div className="py-2.5 px-3 bg-surface-muted rounded-lg text-foreground">
                      {formatDifficultySelection(coerceDifficultySelection(settings.difficultyMode))}
                    </div>
                    <p className="text-xs text-foreground-muted mt-1">
                      Filters which clues are used. &quot;All&quot; means every clue is in the mix.
                    </p>
                  </>
                )}
              </div>

              <div>
                <label htmlFor="entityType" className="block text-foreground text-sm font-semibold mb-2">
                  {ENTITY_TYPE_FIELD_LABEL}
                </label>
                {isHost ? (
                  <select
                    id="entityType"
                    value={settings.entityType ?? 'character'}
                    onChange={(e) => handleUpdateSetting('entityType', e.target.value)}
                    className="w-full bg-surface-muted border-0 rounded-md text-foreground focus:ring-2 focus:ring-primary py-2.5 px-3"
                  >
                    {ENTITY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="py-2.5 px-3 bg-surface-muted rounded-lg text-foreground">
                    {entityTypeOptionLabel(settings.entityType ?? 'character')}
                  </div>
                )}
                <p className="text-xs text-foreground-muted mt-1">{ENTITY_TYPE_HINT_LOBBY}</p>
              </div>

              <div className="flex items-center gap-2">
                {isHost ? (
                  <>
                    <input
                      type="checkbox"
                      id="strictMode"
                      checked={settings.strictMode}
                      onChange={(e) => handleUpdateSetting('strictMode', e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <label htmlFor="strictMode" className="text-foreground text-sm font-medium">Strict Mode</label>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${settings.strictMode ? 'bg-primary border-primary' : 'border-edge bg-surface'}`}>
                      {settings.strictMode && <span className="material-symbols-outlined text-white text-sm">check</span>}
                    </div>
                    <span className="text-foreground text-sm">Strict Mode {settings.strictMode ? '(Enabled)' : '(Disabled)'}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-foreground-muted -mt-2">
                When enabled, spelling must match exactly. Dashes stay optional; parentheticals are
                optional unless the guess includes them.
              </p>

              <div>
                <label className="block text-foreground text-sm font-semibold mb-2">Transparency</label>
                {isHost ? (
                  <select
                    value={settings.transparencyMode}
                    onChange={(e) => handleUpdateSetting('transparencyMode', e.target.value)}
                    className="w-full bg-surface-muted border-0 rounded-md text-foreground focus:ring-2 focus:ring-primary py-2.5 px-3"
                  >
                    <option value="full">Full (show what people guessed)</option>
                    <option value="minimal">Minimal (only show that they guessed)</option>
                  </select>
                ) : (
                  <div className="py-2.5 px-3 bg-surface-muted rounded-lg text-foreground capitalize">{settings.transparencyMode}</div>
                )}
                <p className="text-xs text-foreground-muted mt-1">Full shows guess text; minimal only shows that someone guessed.</p>
              </div>
              </div>
            </section>
          )}

        </div>

      </main>

      {isHost && (
        <div className="sticky bottom-0 p-2 bg-surface/80 backdrop-blur-md border-t border-edge">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-end sm:items-center">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="order-2 sm:order-1 px-5 py-3 rounded-full border-2 border-edge bg-surface-muted text-foreground font-semibold hover:bg-surface-elevated transition-colors hidden md:block"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleStartGame}
              disabled={connectedCount < 2 || maintenanceBlocking}
              className="order-1 sm:order-2 w-full md:w-auto md:min-w-[200px] bg-green-600 hover:bg-green-700 text-white font-bold py-4 md:py-3 px-6 rounded-lg shadow-lg shadow-green-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <span className="material-symbols-outlined">play_circle</span>
              START GAME ({connectedCount} PLAYERS)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Lobby
