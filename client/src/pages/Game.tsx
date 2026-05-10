import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'

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
  const { roomCode, playerId, gameState, settings, error, players, isReconnecting } = useGame()
  const [guess, setGuess] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [roundEndData, setRoundEndData] = useState<any>(null)
  const [gameEndData, setGameEndData] = useState<any>(null)
  const [autoReturnSeconds, setAutoReturnSeconds] = useState<number | null>(null)
  const [guessFeed, setGuessFeed] = useState<Array<{ nickname: string; guess?: string; correct: boolean }>>([])
  const [currentPhase, setCurrentPhase] = useState<'starting' | 'active' | 'clue_revealed' | 'ended'>('starting')
  const guessInputRef = useRef<HTMLInputElement | null>(null)
  const cluesScrollRef = useRef<HTMLDivElement | null>(null)
  const guessesScrollRef = useRef<HTMLDivElement | null>(null)
  const isFinalScoresView = gameState?.roundNumber === 0
  const canGuess = !!gameState && !isFinalScoresView && (currentPhase === 'active' || currentPhase === 'clue_revealed')
  const preGuessPhase = !!gameState && !isFinalScoresView && currentPhase === 'starting'
  const hasStoredRoom = typeof window !== 'undefined' && !!localStorage.getItem('whoami_room')

  /**
   * Track the on-screen keyboard so the game layout shrinks above it.
   *
   * iOS Safari does not resize the layout viewport when the keyboard opens
   * (it only shrinks the *visual* viewport), so a layout pinned with
   * `position: fixed; inset: 0` would still extend behind the keyboard,
   * hiding the guess input. By measuring `window.innerHeight - visualViewport.height`
   * we get the keyboard's height (0 when closed) and expose it as
   * `--keyboard-inset`. The page container uses this as its bottom padding,
   * so the inner flex column always fits exactly above the keyboard with no
   * gap and no off-screen clipping.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0))
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--keyboard-inset')
    }
  }, [])

  useEffect(() => {
    if (!roomCode && !isReconnecting && !hasStoredRoom) {
      navigate('/')
    }
  }, [roomCode, isReconnecting, hasStoredRoom, navigate])

  useEffect(() => {
    if (gameState) {
      setCurrentPhase(gameState.phase)
      if (gameState.phase === 'starting') {
        setGuessFeed([])
        setRoundEndData(null)
      }
    }
  }, [gameState])

  useEffect(() => {
    const handleRoundEnded = (data: any) => {
      setRoundEndData(data)
      setCurrentPhase('ended')
      setTimeout(() => setRoundEndData(null), 5000)
    }
    const handleGameEnded = (data: any) => setGameEndData(data)
    const handleGuessBroadcast = (data: { nickname: string; guess?: string; correct: boolean }) => {
      setGuessFeed(prev => [...prev.slice(-4), data])
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
    if (cluesScrollRef.current) {
      cluesScrollRef.current.scrollTop = cluesScrollRef.current.scrollHeight
    }
  }, [gameState?.cluesRevealed])

  useEffect(() => {
    if (guessesScrollRef.current) {
      guessesScrollRef.current.scrollTop = guessesScrollRef.current.scrollHeight
    }
  }, [guessFeed])

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
      <div className="min-h-screen bg-background-light flex items-center justify-center font-display">
        <div className="text-slate-600">Loading game...</div>
      </div>
    )
  }

  const scoreboard = rankScoreboard<{ playerId: string; nickname: string; score: number }>(
    gameState?.currentScoreboard?.length
      ? gameState.currentScoreboard
      : players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 })),
    p => p.score
  )

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
      <div className="min-h-screen bg-background-light font-display text-slate-900 flex justify-center">
        <div className="w-full max-w-[430px] flex flex-col bg-white">
          <div className="flex flex-col items-center pt-12 pb-6 px-6 bg-gradient-to-b from-primary/10 to-transparent">
            <span className="material-symbols-outlined text-primary text-6xl mb-2">auto_awesome</span>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Game Over!</h1>
            <p className="text-slate-500 mt-1 font-medium">Final Rankings</p>
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
                      ? 'bg-white border-2 border-amber-400 shadow-lg shadow-amber-400/10'
                      : isPodium
                        ? 'bg-white border border-slate-200'
                        : 'bg-white/50 border border-dashed border-slate-200'
                  }`}
                >
                  <div className="relative">
                    <div className="size-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                      {player.nickname?.slice(0, 2).toUpperCase() || '?'}
                    </div>
                    {isWinner && (
                      <div className="absolute -top-2 -right-1 bg-amber-400 text-white rounded-full p-1 border-2 border-white">
                        <span className="material-symbols-outlined text-sm block">military_tech</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={isWinner ? 'text-amber-600 font-bold' : 'text-slate-400 font-bold'}>#{player.rank}</span>
                      <p className="text-slate-900 font-bold truncate">
                        {player.nickname}
                        {player.playerId === playerId && (
                          <span className="text-slate-400 font-medium"> (You)</span>
                        )}
                      </p>
                    </div>
                    {label && (
                      <p
                        className={
                          isWinner
                            ? 'text-amber-600 text-sm font-semibold mt-0.5 uppercase tracking-wider'
                            : 'text-slate-500 text-xs mt-0.5'
                        }
                      >
                        {label}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={isWinner ? 'text-primary font-bold text-xl' : 'text-slate-900 font-bold text-lg'}>{player.score}</p>
                    <p className="text-slate-400 text-xs font-medium">pts</p>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="p-6 bg-white border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setGameEndData(null); navigate('/lobby') }}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined">home</span>
              Return to Lobby
            </button>
            {autoReturnSeconds !== null && (
              <div className="mt-4 flex flex-col items-center">
                <p className="text-slate-400 text-sm font-medium">Returning to lobby in {autoReturnSeconds}s...</p>
                <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
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
      className="bg-background-light font-display text-slate-900 flex flex-col fixed inset-0 lg:static lg:min-h-screen"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--keyboard-inset, 0px))' }}
    >
      <div
        className="w-full max-w-[430px] lg:max-w-7xl mx-auto flex-1 min-h-0 flex flex-col bg-white lg:bg-transparent lg:shadow-none overflow-hidden"
      >
        <header
          className="shrink-0 border-b border-primary/10 bg-white/95 backdrop-blur-sm lg:rounded-b-2xl lg:border lg:border-slate-200 lg:shadow-sm px-4 lg:px-8 pb-2 lg:pb-4"
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
            {!isFinalScoresView && (
              <div className="lg:hidden flex items-center gap-2 bg-primary/5 rounded-lg px-3 py-1.5 border border-primary/10 shrink-0">
                <span className="material-symbols-outlined text-primary text-base">timer</span>
                <div className="leading-tight">
                  <p className="text-[9px] uppercase tracking-wider text-primary font-bold">
                    {preGuessPhase ? 'Starts in' : 'Time'}
                  </p>
                  <p className="text-base font-black text-slate-900">
                    {preGuessPhase ? Math.ceil(timeRemaining / 1000) : canGuess ? Math.ceil(timeRemaining / 1000) : 0}s
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-6 lg:px-8 min-h-0">
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,1.8fr)_320px] xl:grid-cols-[minmax(0,2fr)_360px]">
            <div className="space-y-4 lg:space-y-6">
              {!isFinalScoresView && (
                <section className="space-y-2 lg:space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm lg:text-base">Current Clues</h3>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                      {gameState.cluesRevealed.length} Revealed
                    </span>
                  </div>
                  <div
                    ref={cluesScrollRef}
                    className="space-y-2 lg:space-y-3 max-h-56 overflow-y-auto lg:max-h-[26rem] pr-1"
                  >
                    {gameState.cluesRevealed
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((clue) => (
                        <div key={clue.order} className="bg-white rounded-lg p-3 lg:p-5 border border-slate-200 shadow-sm">
                          <div className="flex items-start gap-3 lg:gap-4">
                            <div className="hidden md:flex size-12 rounded-lg bg-primary/10 items-center justify-center text-primary shrink-0">
                              <span className="material-symbols-outlined">auto_stories</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clue {clue.order}</span>
                                <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                              </div>
                              <p className="text-slate-700 leading-snug lg:leading-relaxed font-medium text-sm lg:text-lg">{clue.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {!isFinalScoresView && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm lg:text-base">Recent Guesses</h3>
                    <span className="text-xs font-medium text-slate-500">{guessFeed.length} recent</span>
                  </div>
                  <div ref={guessesScrollRef} className="bg-white rounded-md border border-slate-200 shadow-sm p-2 lg:p-4 max-h-28 lg:max-h-52 overflow-y-auto">
                    {guessFeed.length > 0 ? (
                      <div className="space-y-1.5">
                        {guessFeed.slice(-12).map((item, index) => {
                          const isFull = settings?.transparencyMode === 'full'
                          const message = item.correct
                            ? `${item.nickname} guessed correctly!`
                            : isFull && item.guess
                              ? `${item.nickname}: ${item.guess}`
                              : `${item.nickname} guessed`
                          return (
                            <div key={index} className={`rounded bg-slate-50 px-2.5 py-1.5 text-xs lg:text-sm ${item.correct ? 'text-green-700' : 'text-slate-700'}`}>
                              {message}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex min-h-12 items-center text-xs lg:text-sm text-slate-400 px-1">
                        No guesses yet.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {gameState.isLocked && (
                <div className="p-3 lg:p-4 bg-green-50 border-2 border-green-400 rounded-lg text-center">
                  <div className="text-green-800 font-semibold text-sm lg:text-base">✓ You guessed correctly!</div>
                  <div className="text-xs lg:text-sm text-green-600 mt-1">Waiting for other players...</div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:space-y-6">
              {!isFinalScoresView && (
                <div className="hidden lg:block bg-primary text-white rounded-2xl p-6 shadow-xl shadow-primary/20">
                  <p className="text-xs uppercase tracking-widest text-white/70 font-bold">
                    {preGuessPhase ? 'Guessing opens in' : 'Time remaining'}
                  </p>
                  <p className="text-5xl font-black mt-3 leading-none">
                    {preGuessPhase ? Math.ceil(timeRemaining / 1000) : canGuess ? Math.ceil(timeRemaining / 1000) : 0}s
                  </p>
                  <div className="mt-5 h-2 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white/80 transition-all"
                      style={{
                        width: preGuessPhase
                          ? `${Math.max(0, Math.min(100, ((settings?.roundStartDelayMs ?? 3000) - timeRemaining) / (settings?.roundStartDelayMs ?? 3000) * 100))}%`
                          : `${Math.max(0, Math.min(100, (timeRemaining / (settings?.roundDuration ?? 1)) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              )}

              <section className="space-y-2 lg:space-y-3 bg-white rounded-xl lg:rounded-2xl border border-slate-200 shadow-sm p-3 lg:p-5">
                <h3 className="font-bold text-slate-800 text-sm lg:text-base">Current Standing</h3>
                <div className="space-y-1">
                  {scoreboard.map(player => (
                    <div
                      key={player.playerId}
                      className={`flex items-center justify-between p-2 lg:p-3 rounded-lg ${
                        player.playerId === playerId ? 'bg-primary/5 border border-primary/20' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-4">{player.rank}</span>
                        <div className="size-7 lg:size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/20 shrink-0">
                          {player.nickname.slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`truncate text-xs lg:text-sm ${player.playerId === playerId ? 'font-semibold' : 'font-medium text-slate-600'}`}>
                          {player.nickname}
                          {player.playerId === playerId && ' (You)'}
                        </span>
                      </div>
                      <span className={`text-xs lg:text-sm font-black shrink-0 ${player.playerId === playerId ? 'text-primary' : 'text-slate-500'}`}>
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
          <div className="shrink-0 bg-white border-t border-slate-200 px-3 py-2 lg:px-8 lg:py-4">
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
                  className="w-full bg-slate-50 border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg py-3 px-3 text-slate-900 placeholder:text-slate-400 font-medium text-base transition-all"
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
          <div className="w-full bg-white rounded-t-lg md:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] md:max-w-2xl overflow-y-auto">
            <div className="flex h-6 w-full items-center justify-center md:hidden">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-2 pb-6 text-center">
              <h4 className="text-primary text-sm font-bold uppercase tracking-widest mb-1">Round Over!</h4>
              {!roundEndData.answerRevealed && (
                <p className="text-slate-900">Awww... Nobody guessed correctly this round.</p>
              )}
              {roundEndData.answerRevealed && (
                <h2 className="text-slate-900 text-3xl font-bold">Answer: {roundEndData.answer}</h2>
              )}
            </div>
            {roundEndData.answerRevealed && roundEndData.clues?.length > 0 && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
                  <h3 className="text-slate-900 text-lg font-bold">Clues Used</h3>
                </div>
                <div className="space-y-3">
                  {roundEndData.clues.map((clue: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="text-primary flex items-center justify-center rounded-lg bg-primary/10 shrink-0 h-10 w-10">
                        <span className="material-symbols-outlined">water_drop</span>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <p className="text-slate-900 text-sm font-semibold">{clue.text}</p>
                        {clue.citations && <p className="text-slate-500 text-xs font-medium">{clue.citations}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="px-6 pb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-amber-500 text-xl">leaderboard</span>
                <h3 className="text-slate-900 text-lg font-bold">Scores after this round</h3>
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
                            isLeader ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-transparent'
                          }`}
                        >
                          <span className="text-slate-900 font-bold">
                            {entry.nickname}
                            {entry.playerId === playerId && (
                              <span className="text-slate-400 font-medium"> (You)</span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {entry.pointsEarned > 0 && <span className="text-primary font-bold text-sm">+{entry.pointsEarned}</span>}
                            <span className="text-slate-900 font-bold bg-white px-3 py-1 rounded shadow-sm">{entry.totalScore}</span>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <p className="text-slate-600 text-sm">No one got it this round.</p>
              )}
            </div>
            <div className="pb-8 text-center">
              <p className="text-slate-400 text-xs font-medium italic">Next round starting in 5s...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Game
