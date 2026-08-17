import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DifficultyMultiSelect } from '../components/DifficultyMultiSelect'
import GameHistoryPanel from '../components/GameHistoryPanel'
import PlayerAvatar from '../components/PlayerAvatar'
import PreferencesMenu from '../components/PreferencesMenu'
import { fadeOutMenuMusic } from '../lib/menuMusic'
import {
  isLobbyReactionId,
  LOBBY_REACTION_OPTIONS,
  LOBBY_REACTION_TTL_MS,
  lobbyReactionIcon,
  lobbyReactionLabel,
  type LobbyReactionId
} from '../lib/lobbyReactions'
import { playSound, unlockAudio } from '../lib/sounds'
import { shareOrCopyInvite } from '../lib/roomCode'
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
import {
  maxClueRevealTimeMs,
  MULTIPLAYER_SETTINGS_LIMITS,
  multiplayerSettingsResetPayload
} from '../lib/multiplayerDefaults'

type ActiveLobbyReaction = {
  reactionId: LobbyReactionId
  until: number
}

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
  const [shareFeedback, setShareFeedback] = useState<'shared' | 'copied' | null>(null)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const [lobbyReactions, setLobbyReactions] = useState<Record<string, ActiveLobbyReaction>>({})
  const historySheetClosedViaPopRef = useRef(false)
  const [datasets, setDatasets] = useState<PublicDataset[]>([])
  const {
    roomCode,
    isHost,
    players,
    settings,
    gameState,
    gameHistory,
    error,
    setError,
    reset,
    playerId,
    isReconnecting
  } = useGame()
  const hasStoredRoom = typeof window !== 'undefined' && !!localStorage.getItem('whoami_room')

  useEffect(() => {
    const handleLobbyReaction = (...args: unknown[]) => {
      const payload = args[0] as { playerId?: string; reactionId?: string } | undefined
      if (!payload?.playerId || !isLobbyReactionId(payload.reactionId)) return
      setLobbyReactions((prev) => ({
        ...prev,
        [payload.playerId!]: {
          reactionId: payload.reactionId as LobbyReactionId,
          until: Date.now() + LOBBY_REACTION_TTL_MS
        }
      }))
    }

    on('LOBBY_REACTION', handleLobbyReaction)
    return () => off('LOBBY_REACTION', handleLobbyReaction)
  }, [on, off])

  useEffect(() => {
    const expiries = Object.values(lobbyReactions).map((reaction) => reaction.until)
    if (expiries.length === 0) return

    const delay = Math.max(0, Math.min(...expiries) - Date.now())
    const timer = setTimeout(() => {
      const now = Date.now()
      setLobbyReactions((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [id, reaction] of Object.entries(next)) {
          if (reaction.until <= now) {
            delete next[id]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, delay)

    return () => clearTimeout(timer)
  }, [lobbyReactions])

  useEffect(() => {
    const connectedIds = new Set(players.filter((p) => p.isConnected).map((p) => p.id))
    setLobbyReactions((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(next)) {
        if (!connectedIds.has(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [players])

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

  useEffect(() => {
    if (!historySheetOpen) return
    historySheetClosedViaPopRef.current = false

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistorySheetOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)

    // Android system Back closes the sheet instead of leaving the lobby.
    window.history.pushState({ whoamiHistorySheet: true }, '')
    const onPopState = () => {
      historySheetClosedViaPopRef.current = true
      setHistorySheetOpen(false)
    }
    window.addEventListener('popstate', onPopState)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onPopState)
      document.body.style.overflow = previousOverflow
      if (!historySheetClosedViaPopRef.current && window.history.state?.whoamiHistorySheet) {
        window.history.back()
      }
    }
  }, [historySheetOpen])

  useEffect(() => {
    if (gameHistory.length === 0) setHistorySheetOpen(false)
  }, [gameHistory.length])

  const handleCopyCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), COPIED_FEEDBACK_MS)
    })
  }

  const handleShareInvite = () => {
    if (!roomCode || typeof window === 'undefined') return
    void shareOrCopyInvite(roomCode)
      .then((result) => {
        setShareFeedback(result)
        setTimeout(() => setShareFeedback(null), COPIED_FEEDBACK_MS)
      })
      .catch((err) => {
        // User dismissed the share sheet — no toast needed
        if (err instanceof Error && err.name === 'AbortError') return
        console.warn('Share invite failed:', err)
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

  const handleSendLobbyReaction = (reactionId: LobbyReactionId) => {
    emit('LOBBY_REACTION', { reactionId })
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
    emit('UPDATE_SETTINGS', multiplayerSettingsResetPayload())
  }

  if (!roomCode) return null

  const connectedCount = players.filter(p => p.isConnected).length
  const roundLimits = MULTIPLAYER_SETTINGS_LIMITS.roundDuration
  const roundsLimits = MULTIPLAYER_SETTINGS_LIMITS.totalRounds
  const clueLimits = MULTIPLAYER_SETTINGS_LIMITS.clueRevealTime
  const clueRevealMax = settings ? maxClueRevealTimeMs(settings.roundDuration) : clueLimits.min

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
                onClick={handleShareInvite}
                title="Share invite"
                className="flex size-10 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors md:size-auto md:px-4 md:py-2 md:rounded-lg md:bg-surface-elevated md:text-primary md:font-semibold md:flex md:items-center md:gap-2 md:hover:bg-surface-elevated"
              >
                {shareFeedback ? (
                  <>
                    <span className="material-symbols-outlined text-xl md:text-lg">check</span>
                    <span className="hidden md:inline text-sm">
                      {shareFeedback === 'shared' ? 'Shared!' : 'Copied!'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl md:text-lg">share</span>
                    <span className="hidden md:inline text-sm">Share</span>
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
              {players.filter(p => p.isConnected).map((player) => {
                const activeReaction = lobbyReactions[player.id]
                return (
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
                      {activeReaction && (
                        <span
                          key={`${player.id}-${activeReaction.until}`}
                          className="lobby-reaction-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0"
                          data-testid={`lobby-reaction-chip-${player.id}`}
                        >
                          <span className="material-symbols-outlined text-sm leading-none" aria-hidden>
                            {lobbyReactionIcon(activeReaction.reactionId)}
                          </span>
                          {lobbyReactionLabel(activeReaction.reactionId)}
                        </span>
                      )}
                    </div>
                    {player.id === playerId && (
                      <p className="text-foreground-muted text-xs italic mt-0.5">You</p>
                    )}
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
                )
              })}
            </div>
            <div
              className="mt-4 grid grid-cols-4 gap-2"
              role="group"
              aria-label="Lobby reactions"
            >
              {LOBBY_REACTION_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSendLobbyReaction(option.id)}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border border-edge bg-surface-muted/60 px-1 py-2 text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl text-primary leading-none" aria-hidden>
                    {option.icon}
                  </span>
                  <span className="text-[10px] sm:text-xs font-semibold leading-tight text-center">
                    {option.label}
                  </span>
                </button>
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
                    min={roundsLimits.min}
                    max={roundsLimits.max}
                    value={settings.totalRounds}
                    onChange={(e) => handleUpdateSetting('totalRounds', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-elevated rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full"
                      style={{
                        width: `${((settings.totalRounds - roundsLimits.min) / (roundsLimits.max - roundsLimits.min)) * 100}%`
                      }}
                    />
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
                    min={roundLimits.min}
                    max={roundLimits.max}
                    step={roundLimits.step}
                    value={settings.roundDuration}
                    onChange={(e) => handleUpdateSetting('roundDuration', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-elevated rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full"
                      style={{
                        width: `${((settings.roundDuration - roundLimits.min) / (roundLimits.max - roundLimits.min)) * 100}%`
                      }}
                    />
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
                    min={clueLimits.min}
                    max={clueRevealMax}
                    step={clueLimits.step}
                    value={settings.clueRevealTime}
                    onChange={(e) => handleUpdateSetting('clueRevealTime', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-elevated rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full"
                      style={{
                        width: clueRevealMax > clueLimits.min
                          ? `${((settings.clueRevealTime - clueLimits.min) / (clueRevealMax - clueLimits.min)) * 100}%`
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

      {(isHost || gameHistory.length > 0) && (
        <div className="sticky bottom-0 z-10 p-2 bg-surface/80 backdrop-blur-md border-t border-edge pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:flex-row sm:justify-end sm:items-center sm:gap-3">
            {isHost && (
              <button
                type="button"
                onClick={handleResetDefaults}
                className="order-3 sm:order-1 px-5 py-3 rounded-full border-2 border-edge bg-surface-muted text-foreground font-semibold hover:bg-surface-elevated transition-colors hidden md:block"
              >
                Reset Defaults
              </button>
            )}
            {gameHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setHistorySheetOpen(true)}
                className={`order-2 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-edge bg-surface-muted text-foreground font-semibold hover:bg-surface-elevated transition-colors py-3 px-4 ${
                  isHost ? 'sm:order-2' : 'w-full sm:w-auto'
                }`}
              >
                <span className="material-symbols-outlined text-primary">history</span>
                History
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {gameHistory.length}
                </span>
              </button>
            )}
            {isHost && (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={connectedCount < 2 || maintenanceBlocking}
                className="order-1 sm:order-3 w-full md:w-auto md:min-w-[200px] bg-green-600 hover:bg-green-700 text-white font-bold py-4 md:py-3 px-6 rounded-lg shadow-lg shadow-green-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <span className="material-symbols-outlined">play_circle</span>
                START GAME ({connectedCount} PLAYERS)
              </button>
            )}
          </div>
        </div>
      )}

      {historySheetOpen && roomCode && gameHistory.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-6"
          role="presentation"
          onClick={() => setHistorySheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="past-games-sheet-title"
            className="w-full bg-surface rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl max-h-[min(90vh,40rem)] md:max-w-lg flex flex-col pb-[env(safe-area-inset-bottom)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-6 w-full items-center justify-center md:hidden shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-surface-elevated" />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-edge shrink-0">
              <h2
                id="past-games-sheet-title"
                className="text-foreground text-lg font-bold tracking-tight flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-primary">history</span>
                Past Games
              </h2>
              <button
                type="button"
                onClick={() => setHistorySheetOpen(false)}
                aria-label="Close"
                className="flex size-10 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 flex-1 min-h-0">
              <GameHistoryPanel
                roomCode={roomCode}
                history={gameHistory}
                variant="plain"
                initialEntryId={gameHistory[gameHistory.length - 1]?.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Lobby
