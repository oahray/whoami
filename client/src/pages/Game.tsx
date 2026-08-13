import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import PlayerAvatar from '../components/PlayerAvatar'
import SoundToggle from '../components/SoundToggle'
import { downloadLeaderboardPng } from '../lib/exportLeaderboardPng'
import { INTER_ROUND_DELAY_MS } from '../lib/gameTiming'
import { playSound } from '../lib/sounds'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'
import { useStickToBottom } from '../hooks/useStickToBottom'
import { useVisualViewportLock } from '../hooks/useVisualViewportLock'

/**
 * Sort a scoreboard descending and assign competition rankings (1, 1, 3, ...)
 * so tied scores share a rank and the next non-tied player gets the gap.
 * Each returned entry also gets `tied` = true if at least one other player
 * shares its rank, so callers can render "Tied for 1st" instead of falsely
 * picking a champion.
 */
function rankScoreboard<T extends Record<string, any>>(items: T[], getScore: (t: T) => number): Array<T & { rank: number; tied: boolean }> {
  const sorted = [...items].sort((a, b) => getScore(b) - getScore(a))
  const tieCount = new Map<number, number>()
  let currentRank = 0
  let lastScore: number | undefined
  const staged = sorted.map((item, idx) => {
    const score = getScore(item)
    if (score !== lastScore) {
      currentRank = idx + 1
      lastScore = score
    }
    tieCount.set(currentRank, (tieCount.get(currentRank) ?? 0) + 1)
    return { item, rank: currentRank }
  })
  return staged.map(({ item, rank }) => ({
    ...item,
    rank,
    tied: (tieCount.get(rank) ?? 1) > 1
  }))
}

function Game() {
  const navigate = useNavigate()
  const { emit, on, off } = useSocket()
  const { roomCode, playerId, gameState, settings, error, players, isReconnecting, gameHistory, setError } = useGame()
  const [guess, setGuess] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [roundEndData, setRoundEndData] = useState<any>(null)
  const [gameEndData, setGameEndData] = useState<any>(null)
  const [autoReturnSeconds, setAutoReturnSeconds] = useState<number | null>(null)
  const [nextRoundSeconds, setNextRoundSeconds] = useState<number | null>(null)
  const [guessFeed, setGuessFeed] = useState<Array<{ nickname: string; avatarId?: string; guess?: string; correct: boolean }>>([])
  const [currentPhase, setCurrentPhase] = useState<'starting' | 'active' | 'clue_revealed' | 'ended'>('starting')
  const [standingOpen, setStandingOpen] = useState(false)
  const [exportState, setExportState] = useState<'idle' | 'working' | 'downloaded' | 'error'>('idle')
  const standingListRef = useRef<HTMLDivElement | null>(null)
  const guessInputRef = useRef<HTMLInputElement | null>(null)
  const gameStateRef = useRef(gameState)
  const settingsRef = useRef(settings)
  const gameEndedRef = useRef(false)
  const goHandledRef = useRef(false)
  const viewportStyle = useVisualViewportLock()
  const isFinalScoresView = gameState?.roundNumber === 0
  const cluesRevealedCount = gameState?.cluesRevealed.length ?? 0
  const {
    ref: cluesScrollRef,
    onScroll: onCluesScroll,
    resetStick: resetCluesStick
  } = useStickToBottom<HTMLDivElement>([cluesRevealedCount])
  const {
    ref: guessesScrollRef,
    onScroll: onGuessesScroll,
    resetStick: resetGuessesStick
  } = useStickToBottom<HTMLDivElement>([guessFeed.length])
  const canGuess = !!gameState && !isFinalScoresView && (currentPhase === 'active' || currentPhase === 'clue_revealed')
  const preGuessPhase = !!gameState && !isFinalScoresView && currentPhase === 'starting'
  const hasStoredRoom = typeof window !== 'undefined' && !!localStorage.getItem('whoami_room')

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (!roomCode && !isReconnecting && !hasStoredRoom) {
      navigate('/')
    }
  }, [roomCode, isReconnecting, hasStoredRoom, navigate])

  // Non-host players: Go when the game screen appears for round 1.
  // Host already heard Go on Start (session flag skips a second play).
  useEffect(() => {
    if (!gameState || gameState.roundNumber !== 1 || goHandledRef.current) return
    goHandledRef.current = true
    let skip = false
    try {
      if (sessionStorage.getItem('whoami_go_played') === '1') {
        sessionStorage.removeItem('whoami_go_played')
        skip = true
      }
    } catch {
      // ignore
    }
    if (!skip) playSound('go')
  }, [gameState?.roundNumber])

  useEffect(() => {
    if (gameState) {
      setCurrentPhase(gameState.phase)
      if (gameState.phase === 'starting') {
        setGuessFeed([])
        setRoundEndData(null)
        setStandingOpen(false)
      }
    }
  }, [gameState])

  useEffect(() => {
    if (!standingOpen) return
    const youRow = standingListRef.current?.querySelector('[data-you-standing="true"]')
    youRow?.scrollIntoView({ block: 'nearest' })
  }, [standingOpen, gameState?.currentScoreboard])

  useEffect(() => {
    if (!roundEndData) {
      setNextRoundSeconds(null)
      return
    }

    const endsAt = Date.now() + INTER_ROUND_DELAY_MS
    const tick = () => {
      setNextRoundSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [roundEndData])

  useEffect(() => {
    const handleRoundEnded = (data: any) => {
      setRoundEndData(data)
      setCurrentPhase('ended')
      const roundNumber = gameStateRef.current?.roundNumber ?? 0
      const totalRounds = settingsRef.current?.totalRounds ?? 0
      const moreRounds = roundNumber > 0 && roundNumber < totalRounds

      window.setTimeout(() => {
        setRoundEndData(null)
        setNextRoundSeconds(null)
        // Local countdown end = next-round cue (not waiting on ROUND_STARTED).
        if (moreRounds && !gameEndedRef.current) playSound('card-flip')
      }, INTER_ROUND_DELAY_MS)
    }
    const handleGameEnded = (data: any) => {
      gameEndedRef.current = true
      setGameEndData(data)
    }
    const handleGuessBroadcast = (data: { nickname: string; avatarId?: string; guess?: string; correct: boolean }) => {
      setGuessFeed(prev => [...prev.slice(-14), data])
    }
    const handlePlayerCorrect = () => {}
    on('ROUND_ENDED', handleRoundEnded)
    on('GAME_ENDED', handleGameEnded)
    on('GUESS_BROADCAST', handleGuessBroadcast)
    on('PLAYER_CORRECT', handlePlayerCorrect)
    return () => {
      off('ROUND_ENDED', handleRoundEnded)
      off('GAME_ENDED', handleGameEnded)
      off('GUESS_BROADCAST', handleGuessBroadcast)
      off('PLAYER_CORRECT', handlePlayerCorrect)
    }
  }, [on, off])

  useEffect(() => {
    if (!gameState?.serverStartTime || !settings) return
    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.serverStartTime!
      const startDelay = settings.roundStartDelayMs ?? 3000
      if (currentPhase === 'starting') {
        const remaining = Math.max(0, startDelay - elapsed)
        setTimeRemaining(remaining)
        if (remaining === 0) setCurrentPhase('active')
      } else if (currentPhase === 'active' || currentPhase === 'clue_revealed') {
        // Active timer counts down the full `roundDuration` starting from the
        // moment guessing opens (i.e. after the pre-round countdown), so the
        // host's selected duration is what players actually get to guess in.
        const activeElapsed = Math.max(0, elapsed - startDelay)
        setTimeRemaining(Math.max(0, settings.roundDuration - activeElapsed))
      }
    }, 100)
    return () => clearInterval(interval)
  }, [gameState, settings, currentPhase])

  useEffect(() => {
    if (gameEndData) setAutoReturnSeconds(30)
    else setAutoReturnSeconds(null)
  }, [gameEndData])

  useEffect(() => {
    if (canGuess && !gameState?.isLocked) {
      guessInputRef.current?.focus()
    }
  }, [canGuess, gameState?.isLocked, gameState?.roundNumber, gameState?.phase])

  useEffect(() => {
    resetCluesStick()
    resetGuessesStick()
  }, [gameState?.roundNumber, resetCluesStick, resetGuessesStick])

  useEffect(() => {
    if (autoReturnSeconds === null) return
    if (autoReturnSeconds <= 0) {
      setGameEndData(null)
      navigate('/lobby')
      return
    }
    const id = setTimeout(() => setAutoReturnSeconds(prev => (prev !== null ? prev - 1 : prev)), 1000)
    return () => clearTimeout(id)
  }, [autoReturnSeconds, navigate])

  const handleSubmitGuess = () => {
    if (!guess.trim() || !gameState || gameState.isLocked) return
    emit('SUBMIT_GUESS', { guess: guess.trim() })
    setGuess('')
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center font-display">
        <LoadingState label="Loading game" layout="inline" />
      </div>
    )
  }

  const scoreboard = rankScoreboard<{ playerId: string; nickname: string; score: number }>(
    gameState?.currentScoreboard?.length
      ? gameState.currentScoreboard
      : players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 })),
    p => p.score
  )
  const yourStanding = scoreboard.find((entry) => entry.playerId === playerId)

  if (gameEndData) {
    const ranked = rankScoreboard<any>(gameEndData.finalScoreboard || [], p => p.score)
    const labelFor = (rank: number, tied: boolean, score: number): string | null => {
      if (score <= 0) return null
      if (rank === 1) return tied ? 'Tied for 1st' : 'Champion'
      if (rank === 2) return tied ? 'Tied for 2nd' : 'Runner up'
      if (rank === 3) return tied ? 'Tied for 3rd' : '3rd Place'
      return null
    }
    return (
      <div className="min-h-screen bg-app-bg font-display text-foreground flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col bg-surface">
          <div className="flex flex-col items-center pt-12 pb-6 px-6 bg-gradient-to-b from-primary/10 to-transparent">
            <span className="material-symbols-outlined text-primary text-6xl mb-2">auto_awesome</span>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Game Over!</h1>
            <p className="text-foreground-muted mt-1 font-medium">Final Rankings</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
            {ranked.map(player => {
              const isWinner = player.rank === 1 && player.score > 0
              const isPodium = player.rank <= 3 && player.score > 0
              const label = labelFor(player.rank, player.tied, player.score)
              return (
                <div
                  key={player.playerId}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    isWinner
                      ? 'bg-surface border-2 border-amber-400 shadow-lg shadow-amber-400/10'
                      : isPodium
                        ? 'bg-surface border border-edge'
                        : 'bg-surface/50 border border-dashed border-edge'
                  }`}
                >
                  <div className="relative">
                    <PlayerAvatar
                      avatarId={players.find(p => p.id === player.playerId)?.avatarId}
                      nickname={player.nickname || '?'}
                      sizeClassName="size-14"
                    />
                    {isWinner && (
                      <div className="absolute -top-2 -right-1 bg-amber-400 text-white rounded-full p-1 border-2 border-white">
                        <span className="material-symbols-outlined text-sm block">military_tech</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={isWinner ? 'text-amber-600 font-bold' : 'text-foreground-muted font-bold'}>#{player.rank}</span>
                      <p className="text-foreground font-bold truncate">
                        {player.nickname}
                        {player.playerId === playerId && (
                          <span className="text-foreground-muted font-medium"> (You)</span>
                        )}
                      </p>
                    </div>
                    {label && (
                      <p
                        className={
                          isWinner
                            ? 'text-amber-600 text-sm font-semibold mt-0.5 uppercase tracking-wider'
                            : 'text-foreground-muted text-xs mt-0.5'
                        }
                      >
                        {label}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={isWinner ? 'text-primary font-bold text-xl' : 'text-foreground font-bold text-lg'}>{player.score}</p>
                    <p className="text-foreground-muted text-xs font-medium">pts</p>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="p-6 bg-surface border-t border-edge space-y-3">
            {roomCode && gameHistory.length > 0 && (
              <button
                type="button"
                disabled={exportState === 'working'}
                onClick={() => {
                  const entry = gameHistory[gameHistory.length - 1]
                  if (!entry) return
                  setExportState('working')
                  void downloadLeaderboardPng({ roomCode, entry })
                    .then(() => {
                      setExportState('downloaded')
                      window.setTimeout(() => setExportState('idle'), 2200)
                    })
                    .catch((err) => {
                      console.warn('Leaderboard download failed:', err)
                      setExportState('error')
                      window.setTimeout(() => setExportState('idle'), 2200)
                    })
                }}
                className="w-full border-2 border-edge bg-surface-muted hover:bg-surface-elevated text-foreground font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                <span className="material-symbols-outlined">
                  {exportState === 'working' ? 'hourglass_top' : 'download'}
                </span>
                {exportState === 'working'
                  ? 'Saving…'
                  : exportState === 'downloaded'
                    ? 'Saved!'
                    : exportState === 'error'
                      ? 'Couldn’t save'
                      : 'Download leaderboard image'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setGameEndData(null); navigate('/lobby') }}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined">home</span>
              Return to Lobby
            </button>
            {autoReturnSeconds !== null && (
              <div className="mt-1 flex flex-col items-center">
                <p className="text-foreground-muted text-sm font-medium">Returning to lobby in {autoReturnSeconds}s...</p>
                <div className="w-full h-1 bg-surface-elevated rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary/40 rounded-full transition-all" style={{ width: `${((30 - autoReturnSeconds) / 30) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-app-bg font-display text-foreground flex flex-col lg:min-h-screen"
      style={viewportStyle}
    >
      <div
        className="w-full max-w-[430px] lg:max-w-7xl mx-auto flex-1 min-h-0 flex flex-col bg-surface lg:bg-transparent lg:shadow-none overflow-hidden"
      >
        <header
          className="shrink-0 border-b border-primary/10 bg-surface/95 backdrop-blur-sm lg:rounded-b-2xl lg:border lg:border-edge lg:shadow-sm px-4 lg:px-8 pb-2 lg:pb-4"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
        >
          <div className="flex items-center justify-between gap-3 pt-1 lg:pt-10">
            <div className="min-w-0">
              <h2 className="text-base lg:text-xl font-bold leading-none truncate">
                {isFinalScoresView ? 'Final Scores' : `Round ${gameState.roundNumber} of ${settings?.totalRounds ?? 0}`}
              </h2>
              {roomCode && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] lg:text-xs font-semibold uppercase tracking-wider text-primary">
                  <span className="material-symbols-outlined text-[12px] lg:text-sm">key</span>
                  Room {roomCode}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <SoundToggle />
              {!isFinalScoresView && (
                <div className="flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-1.5 border border-primary/10">
                  <span className="material-symbols-outlined text-primary text-base">timer</span>
                  <div className="leading-tight">
                    <p className="text-[9px] uppercase tracking-wider text-primary font-bold">
                      {preGuessPhase ? 'Starts in' : 'Time'}
                    </p>
                    <p className="text-base font-black text-foreground">
                      {preGuessPhase ? Math.ceil(timeRemaining / 1000) : canGuess ? Math.ceil(timeRemaining / 1000) : 0}s
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          className={`flex-1 min-h-0 px-3 py-3 md:px-6 md:py-6 lg:px-8 ${
            isFinalScoresView
              ? 'overflow-y-auto'
              : 'flex flex-col overflow-hidden lg:block lg:overflow-y-auto'
          }`}
        >
          <div
            className={`gap-4 lg:gap-6 ${
              isFinalScoresView
                ? 'grid lg:grid-cols-[minmax(0,1.8fr)_320px] xl:grid-cols-[minmax(0,2fr)_360px]'
                : 'flex min-h-0 flex-1 flex-col lg:grid lg:h-auto lg:flex-none lg:grid-cols-[minmax(0,1.8fr)_320px] xl:grid-cols-[minmax(0,2fr)_360px]'
            }`}
          >
            <div
              className={
                isFinalScoresView
                  ? 'space-y-4 lg:space-y-6'
                  : 'flex min-h-0 flex-1 flex-col gap-2 lg:block lg:flex-none lg:space-y-6 lg:gap-0'
              }
            >
              {!isFinalScoresView && (
                <section className="flex min-h-0 flex-1 flex-col space-y-2 lg:block lg:flex-none lg:space-y-4">
                  <div className="flex shrink-0 items-center justify-between">
                    <h3 className="font-bold text-foreground text-sm lg:text-base">Current Clues</h3>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                      {gameState.cluesRevealed.length} Revealed
                    </span>
                  </div>
                  <div
                    ref={cluesScrollRef}
                    onScroll={onCluesScroll}
                    className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 lg:max-h-[26rem] lg:flex-none lg:space-y-3"
                  >
                    {(() => {
                      const sortedClues = gameState.cluesRevealed
                        .slice()
                        .sort((a, b) => a.order - b.order)
                      const latestOrder = sortedClues[sortedClues.length - 1]?.order

                      return sortedClues.map((clue) => {
                        const isLatest = clue.order === latestOrder
                        return (
                          <div
                            key={clue.order}
                            className={`rounded-lg border p-3 lg:p-5 shadow-sm ${
                              isLatest
                                ? 'border-primary/35 bg-primary/5 ring-1 ring-primary/10'
                                : 'border-edge bg-surface'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 lg:gap-4">
                              <div
                                className={`flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ${
                                  isLatest ? 'size-10 lg:size-12' : 'size-9 lg:size-11'
                                }`}
                              >
                                <span
                                  className={`material-symbols-outlined ${isLatest ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'}`}
                                >
                                  auto_stories
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-widest ${
                                      isLatest ? 'text-primary' : 'text-foreground-muted'
                                    }`}
                                  >
                                    Clue {clue.order}
                                    {isLatest ? ' · New' : ''}
                                  </span>
                                  <span className="material-symbols-outlined shrink-0 text-green-500 text-sm">
                                    check_circle
                                  </span>
                                </div>
                                <p
                                  className={`leading-snug font-medium lg:leading-relaxed ${
                                    isLatest
                                      ? 'text-foreground text-base lg:text-lg'
                                      : 'text-foreground-muted text-sm lg:text-base'
                                  }`}
                                >
                                  {clue.text}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </section>
              )}

              {gameState.isLocked && (
                <div className="shrink-0 p-3 lg:p-4 bg-green-50 border-2 border-green-400 rounded-lg text-center">
                  <div className="text-green-800 font-semibold text-sm lg:text-base">✓ You guessed correctly!</div>
                  <div className="text-xs lg:text-sm text-green-600 mt-1">Waiting for other players...</div>
                </div>
              )}

              {error && (
                <div className="shrink-0 p-3 bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm flex items-start gap-2">
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

              {!isFinalScoresView && (
                <section className="shrink-0 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setStandingOpen((open) => !open)}
                    aria-expanded={standingOpen}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-edge bg-surface px-3 py-2 text-left shadow-sm"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground">Standing</span>
                      <span className="text-[11px] text-foreground-muted">
                        {yourStanding
                          ? `You #${yourStanding.rank}${yourStanding.tied ? ' (tied)' : ''} · ${yourStanding.score} pt${yourStanding.score === 1 ? '' : 's'}`
                          : `${scoreboard.length} player${scoreboard.length === 1 ? '' : 's'}`}
                      </span>
                    </span>
                    <span
                      className={`material-symbols-outlined shrink-0 text-foreground-muted transition-transform ${
                        standingOpen ? 'rotate-180' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </button>
                  {standingOpen && (
                    <div
                      ref={standingListRef}
                      className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-edge bg-surface p-2 shadow-sm"
                    >
                      {scoreboard.map((player) => (
                        <div
                          key={player.playerId}
                          data-you-standing={player.playerId === playerId ? 'true' : undefined}
                          className={`flex items-center justify-between rounded-md p-2 ${
                            player.playerId === playerId
                              ? 'border border-primary/20 bg-primary/5'
                              : 'bg-surface-muted'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="w-4 text-xs font-bold text-foreground-muted">{player.rank}</span>
                            <PlayerAvatar
                              avatarId={players.find((p) => p.id === player.playerId)?.avatarId}
                              nickname={player.nickname}
                              sizeClassName="size-6"
                              className="border border-primary/20"
                            />
                            <span
                              className={`truncate text-xs ${
                                player.playerId === playerId
                                  ? 'font-semibold'
                                  : 'font-medium text-foreground-muted'
                              }`}
                            >
                              {player.nickname}
                              {player.playerId === playerId && ' (You)'}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-black ${
                              player.playerId === playerId ? 'text-primary' : 'text-foreground-muted'
                            }`}
                          >
                            {player.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {!isFinalScoresView && (
                <section className="shrink-0 space-y-1.5 border-t border-edge pt-2 lg:space-y-2 lg:border-t-0 lg:pt-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground text-sm lg:text-base">Recent Guesses</h3>
                    <span className="text-xs font-medium text-foreground-muted">{guessFeed.length} recent</span>
                  </div>
                  <div
                    ref={guessesScrollRef}
                    onScroll={onGuessesScroll}
                    className="max-h-[6rem] overflow-y-auto rounded-md border border-edge bg-surface p-1.5 shadow-sm lg:max-h-52 lg:p-4"
                  >
                    {guessFeed.length > 0 ? (
                      <div className="space-y-1 lg:space-y-1.5">
                        {guessFeed.map((item, index) => {
                          const isFull = settings?.transparencyMode === 'full'
                          const message = item.correct
                            ? `${item.nickname} guessed correctly!`
                            : isFull && item.guess
                              ? `${item.nickname}: ${item.guess}`
                              : `${item.nickname} guessed`
                          const avatarId =
                            item.avatarId ??
                            players.find((p) => p.nickname === item.nickname)?.avatarId
                          return (
                            <div
                              key={index}
                              className={`flex items-center gap-1.5 rounded bg-surface-muted px-2 py-1 text-xs lg:gap-2 lg:px-2.5 lg:py-1.5 lg:text-sm ${
                                item.correct ? 'text-green-700' : 'text-foreground'
                              }`}
                            >
                              <PlayerAvatar
                                avatarId={avatarId}
                                nickname={item.nickname}
                                sizeClassName="size-5 lg:size-6"
                                className="border border-primary/15"
                              />
                              <span className="min-w-0 truncate">{message}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex min-h-10 items-center px-1 text-xs text-foreground-muted lg:min-h-12 lg:text-sm">
                        No guesses yet.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <aside
              className={`space-y-4 lg:space-y-6 ${
                isFinalScoresView ? '' : 'hidden lg:block'
              }`}
            >
              {!isFinalScoresView && (
                <div className="hidden lg:block bg-primary text-white rounded-2xl p-6 shadow-xl shadow-primary/20">
                  <p className="text-xs uppercase tracking-widest text-white/70 font-bold">
                    {preGuessPhase ? 'Guessing opens in' : 'Time remaining'}
                  </p>
                  <p className="text-5xl font-black mt-3 leading-none">
                    {preGuessPhase ? Math.ceil(timeRemaining / 1000) : canGuess ? Math.ceil(timeRemaining / 1000) : 0}s
                  </p>
                  <div className="mt-5 h-2 rounded-full bg-surface/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-surface/80 transition-all"
                      style={{
                        width: preGuessPhase
                          ? `${Math.max(0, Math.min(100, ((settings?.roundStartDelayMs ?? 3000) - timeRemaining) / (settings?.roundStartDelayMs ?? 3000) * 100))}%`
                          : `${Math.max(0, Math.min(100, (timeRemaining / (settings?.roundDuration ?? 1)) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              )}

              <section className="space-y-2 lg:space-y-3 bg-surface rounded-xl lg:rounded-2xl border border-edge shadow-sm p-3 lg:p-5">
                <h3 className="font-bold text-foreground text-sm lg:text-base">Current Standing</h3>
                <div className="space-y-1">
                  {scoreboard.map(player => (
                    <div
                      key={player.playerId}
                      className={`flex items-center justify-between p-2 lg:p-3 rounded-lg ${
                        player.playerId === playerId ? 'bg-primary/5 border border-primary/20' : 'bg-surface-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                        <span className="text-xs font-bold text-foreground-muted w-4">{player.rank}</span>
                        <PlayerAvatar
                          avatarId={players.find(p => p.id === player.playerId)?.avatarId}
                          nickname={player.nickname}
                          sizeClassName="size-7 lg:size-8"
                          className="border border-primary/20"
                        />
                        <span className={`truncate text-xs lg:text-sm ${player.playerId === playerId ? 'font-semibold' : 'font-medium text-foreground-muted'}`}>
                          {player.nickname}
                          {player.playerId === playerId && ' (You)'}
                        </span>
                      </div>
                      <span className={`text-xs lg:text-sm font-black shrink-0 ${player.playerId === playerId ? 'text-primary' : 'text-foreground-muted'}`}>
                        {player.score}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </main>

        {!gameState.isLocked && canGuess && (
          <div
            className="shrink-0 bg-surface border-t border-edge px-3 py-2 lg:px-8 lg:py-4"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex gap-2 lg:gap-3 max-w-7xl mx-auto">
              <div className="relative flex-1 min-w-0">
                <input
                  ref={guessInputRef}
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitGuess()}
                  placeholder="Enter your guess..."
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full bg-surface-muted border border-edge focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg py-3 px-3 text-foreground placeholder:text-foreground-muted font-medium text-base transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitGuess}
                disabled={!guess.trim()}
                className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 lg:px-6 rounded-lg shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <span className="hidden sm:inline">Submit</span>
                <span className="material-symbols-outlined text-xl">send</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {roundEndData && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-6">
          <div className="w-full bg-surface rounded-t-lg md:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] md:max-w-2xl overflow-y-auto">
            <div className="flex h-6 w-full items-center justify-center md:hidden">
              <div className="h-1.5 w-12 rounded-full bg-surface-elevated" />
            </div>
            <div className="px-6 pt-2 pb-6 text-center">
              <h4 className="text-primary text-sm font-bold uppercase tracking-widest mb-1">Round Over!</h4>
              {!roundEndData.answerRevealed && (
                <p className="text-foreground">Awww... Nobody guessed correctly this round.</p>
              )}
              {roundEndData.answerRevealed && (
                <h2 className="text-foreground text-3xl font-bold">Answer: {roundEndData.answer}</h2>
              )}
            </div>
            {roundEndData.answerRevealed && roundEndData.clues?.length > 0 && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
                  <h3 className="text-foreground text-lg font-bold">Clues Used</h3>
                </div>
                <div className="space-y-3">
                  {roundEndData.clues.map((clue: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 bg-surface-muted p-3 rounded-lg border border-edge">
                      <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 h-10 w-10">
                        <span className="material-symbols-outlined">water_drop</span>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <p className="text-foreground text-sm font-semibold">{clue.text}</p>
                        {clue.citations && <p className="text-foreground-muted text-xs font-medium">{clue.citations}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="px-6 pb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-amber-500 text-xl">leaderboard</span>
                <h3 className="text-foreground text-lg font-bold">Scores after this round</h3>
              </div>
              {roundEndData.scoreboard?.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const topScore = Math.max(
                      0,
                      ...roundEndData.scoreboard.map((e: any) => e.totalScore ?? 0)
                    )
                    return roundEndData.scoreboard.map((entry: any) => {
                      const isLeader = topScore > 0 && entry.totalScore === topScore
                      return (
                        <div
                          key={entry.playerId}
                          className={`flex items-center justify-between p-3 rounded border-l-4 ${
                            isLeader ? 'bg-primary/5 border-primary' : 'bg-surface-muted border-transparent'
                          }`}
                        >
                          <span className="text-foreground font-bold">
                            {entry.nickname}
                            {entry.playerId === playerId && (
                              <span className="text-foreground-muted font-medium"> (You)</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {entry.pointsEarned > 0 && <span className="text-primary font-bold text-sm">+{entry.pointsEarned}</span>}
                            <span className="text-foreground font-bold bg-surface px-3 py-1 rounded shadow-sm">{entry.totalScore}</span>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <p className="text-foreground-muted text-sm">No one got it this round.</p>
              )}
            </div>
            <div className="pb-8 text-center">
              <p className="text-foreground-muted text-xs font-medium italic">
                {nextRoundSeconds !== null && nextRoundSeconds > 0
                  ? `Next round starting in ${nextRoundSeconds}s…`
                  : 'Next round starting…'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Game
