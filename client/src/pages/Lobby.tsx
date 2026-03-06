import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'

function Lobby() {
  const navigate = useNavigate()
  const { emit, on, off } = useSocket()
  const {
    roomCode,
    isHost,
    players,
    settings,
    gameState,
    error,
    setError,
    reset,
    playerId
  } = useGame()

  useEffect(() => {
    if (!roomCode) {
      const timer = setTimeout(() => {
        if (!roomCode) navigate('/')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [roomCode, navigate])

  useEffect(() => {
    const handleRoundStarted = () => navigate('/game')
    on('ROUND_STARTED', handleRoundStarted)
    return () => off('ROUND_STARTED', handleRoundStarted)
  }, [on, off, navigate])

  useEffect(() => {
    if (gameState && gameState.phase !== 'ended' && gameState.phase !== 'starting') {
      navigate('/game')
    }
  }, [gameState, navigate])

  const handleCopyCode = () => {
    if (roomCode) navigator.clipboard.writeText(roomCode)
  }

  const handleCopyLink = () => {
    if (roomCode && typeof window !== 'undefined') {
      navigator.clipboard.writeText(`${window.location.origin}/?room=${roomCode}`)
    }
  }

  const handleStartGame = () => {
    if (players.filter(p => p.isConnected).length < 2) {
      setError('Need at least 2 players to start')
      return
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
      strictMode: false,
      transparencyMode: 'full'
    })
  }

  if (!roomCode) return null

  const connectedCount = players.filter(p => p.isConnected).length

  return (
    <div className="min-h-screen bg-background-light font-display text-slate-900 antialiased">
      <header className="sticky top-0 z-10 flex items-center bg-white px-4 md:px-6 py-3 md:py-4 border-b border-slate-200">
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="text-slate-600 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 md:size-auto md:px-0 md:py-0"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center">Room Lobby</h1>
        <button
          type="button"
          onClick={handleLeaveRoom}
          className="text-red-500 text-sm font-bold shrink-0 md:px-4 md:py-2 md:rounded-full md:bg-slate-100 md:text-slate-700 md:hover:bg-slate-200 md:font-semibold"
        >
          Leave Room
        </button>
      </header>

      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-6 pb-36 md:pb-8">
        <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Room Code</span>
              <p className="text-slate-900 text-2xl md:text-3xl font-black tracking-widest mt-1 text-primary">{roomCode}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy code"
                className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors md:size-auto md:px-4 md:py-2 md:rounded-lg md:bg-slate-100 md:font-semibold md:flex md:items-center md:gap-2"
              >
                <span className="material-symbols-outlined text-xl md:text-lg">content_copy</span>
                <span className="hidden md:inline text-sm">Copy Code</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                title="Copy link"
                className="flex size-10 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors md:size-auto md:px-4 md:py-2 md:rounded-lg md:bg-slate-100 md:text-primary md:font-semibold md:flex md:items-center md:gap-2 md:hover:bg-slate-200"
              >
                <span className="material-symbols-outlined text-xl md:text-lg">share</span>
                <span className="hidden md:inline text-sm">Copy Link</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg mt-4">
            <span className="material-symbols-outlined text-primary text-sm shrink-0">info</span>
            <p className="text-slate-600 text-xs md:text-sm">Share this code or link with your friends to join the game.</p>
          </div>
        </section>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-slate-900 text-lg font-bold tracking-tight">Connected Players</h2>
              <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">{connectedCount} / 10</span>
            </div>
            <div className="space-y-3">
              {players.filter(p => p.isConnected).map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    player.isHost ? 'border-primary/30 bg-primary/5' : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="size-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                      {player.nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-white" title="Connected" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-900 font-bold truncate">{player.nickname}</p>
                      {player.isHost && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase shrink-0">
                          Host
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs italic mt-0.5">
                      {player.id === playerId ? 'You' : 'Ready'}
                    </p>
                  </div>
                  {isHost && !player.isHost && (
                    <button
                      type="button"
                      onClick={() => emit('KICK_PLAYER', { playerId: player.id })}
                      className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 font-semibold shrink-0"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!isHost && (
              <div className="mt-4 w-full text-center text-sm text-slate-600 py-2">
                Waiting for host to start the game…
              </div>
            )}
          </section>

          {settings && (
            <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">settings</span>
                <h2 className="text-slate-900 text-lg font-bold tracking-tight">
                  Game Settings
                  {!isHost && <span className="text-slate-500 font-normal text-sm ml-1">(Only host can change)</span>}
                </h2>
              </div>
              <div className="space-y-6">
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-2">Difficulty Level</label>
                {isHost ? (
                  <select
                    value={settings.difficultyMode}
                    onChange={(e) => handleUpdateSetting('difficultyMode', e.target.value)}
                    className="w-full bg-slate-50 border-0 rounded-lg text-slate-900 focus:ring-2 focus:ring-primary py-2.5 px-3"
                  >
                    <option value="any">Any</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="nightmare">Nightmare</option>
                  </select>
                ) : (
                  <div className="w-full py-2.5 px-3 bg-slate-50 rounded-lg text-slate-700 capitalize">{settings.difficultyMode}</div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-slate-700 text-sm font-semibold">Total Rounds</label>
                  <span className="text-primary font-bold">{settings.totalRounds} Rounds</span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={3}
                    max={10}
                    value={settings.totalRounds}
                    onChange={(e) => handleUpdateSetting('totalRounds', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full" style={{ width: `${((settings.totalRounds - 3) / 7) * 100}%` }} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-slate-700 text-sm font-semibold">Round Duration</label>
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
                    className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full" style={{ width: `${((settings.roundDuration - 10000) / 50000) * 100}%` }} />
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-slate-700 text-sm font-semibold">Clue Reveal Time</label>
                  <span className="text-primary font-bold">{settings.clueRevealTime / 1000}s</span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, settings.roundDuration - (settings.roundStartDelayMs ?? 3000))}
                    step={1000}
                    value={settings.clueRevealTime}
                    onChange={(e) => handleUpdateSetting('clueRevealTime', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-primary cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full"
                      style={{
                        width: settings.roundDuration > (settings.roundStartDelayMs ?? 3000)
                          ? `${(settings.clueRevealTime / (settings.roundDuration - (settings.roundStartDelayMs ?? 3000))) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                )}
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
                    <label htmlFor="strictMode" className="text-slate-700 text-sm font-medium">Strict Mode</label>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${settings.strictMode ? 'bg-primary border-primary' : 'border-slate-300 bg-white'}`}>
                      {settings.strictMode && <span className="material-symbols-outlined text-white text-sm">check</span>}
                    </div>
                    <span className="text-slate-700 text-sm">Strict Mode {settings.strictMode ? '(Enabled)' : '(Disabled)'}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 -mt-2">When enabled, guesses must match the answer more closely.</p>

              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-2">Transparency</label>
                {isHost ? (
                  <select
                    value={settings.transparencyMode}
                    onChange={(e) => handleUpdateSetting('transparencyMode', e.target.value)}
                    className="w-full bg-slate-50 border-0 rounded-lg text-slate-900 focus:ring-2 focus:ring-primary py-2.5 px-3"
                  >
                    <option value="full">Full (show what people guessed)</option>
                    <option value="minimal">Minimal (only show that they guessed)</option>
                  </select>
                ) : (
                  <div className="py-2.5 px-3 bg-slate-50 rounded-lg text-slate-700 capitalize">{settings.transparencyMode}</div>
                )}
                <p className="text-xs text-slate-500 mt-1">Full shows guess text; minimal only shows that someone guessed.</p>
              </div>
              </div>
            </section>
          )}
        </div>

      </main>

      {isHost && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-end sm:items-center">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="order-2 sm:order-1 px-5 py-3 rounded-full border-2 border-slate-200 bg-slate-50 text-slate-700 font-semibold hover:bg-slate-100 transition-colors hidden md:block"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleStartGame}
              disabled={connectedCount < 2}
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
