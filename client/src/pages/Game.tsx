import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'

function Game() {
  const navigate = useNavigate()
  const { emit, on, off } = useSocket()
  const { roomCode, playerId, gameState, settings, error, players } = useGame()
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

  useEffect(() => {
    if (!roomCode) navigate('/')
  }, [roomCode, navigate])

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
        setTimeRemaining(Math.max(0, settings.roundDuration - elapsed))
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

  const scoreboard = (gameState.currentScoreboard?.length ? gameState.currentScoreboard : players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 })))
    .slice()
    .sort((a, b) => b.score - a.score)

  if (gameEndData) {
    const sorted = [...(gameEndData.finalScoreboard || [])].sort((a: any, b: any) => b.score - a.score)
    return (
      <div className="min-h-screen bg-background-light font-display text-slate-900 flex flex-col max-w-[430px] mx-auto">
        <div className="flex flex-col items-center pt-12 pb-6 px-6 bg-gradient-to-b from-primary/10 to-transparent">
          <span className="material-symbols-outlined text-primary text-6xl mb-2">auto_awesome</span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Game Over!</h1>
          <p className="text-slate-500 mt-1 font-medium">Final Rankings</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
          {sorted.map((player: any, index: number) => (
            <div
              key={player.playerId}
              className={`flex items-center gap-4 p-4 rounded-lg border ${
                index === 0
                  ? 'bg-white border-2 border-amber-400 shadow-lg shadow-amber-400/10'
                  : index < 3
                    ? 'bg-white border border-slate-200'
                    : 'bg-white/50 border border-dashed border-slate-200'
              }`}
            >
              <div className="relative">
                <div className="size-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                  {player.nickname?.slice(0, 2).toUpperCase() || '?'}
                </div>
                {index === 0 && (
                  <div className="absolute -top-2 -right-1 bg-amber-400 text-white rounded-full p-1 border-2 border-white">
                    <span className="material-symbols-outlined text-sm block">military_tech</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={index === 0 ? 'text-amber-600 font-bold' : 'text-slate-400 font-bold'}>#{index + 1}</span>
                  <p className="text-slate-900 font-bold truncate">{player.nickname}</p>
                </div>
                {index === 0 && <p className="text-amber-600 text-sm font-semibold mt-0.5 uppercase tracking-wider">Champion</p>}
                {index === 1 && <p className="text-slate-500 text-xs mt-0.5">Runner up</p>}
                {index === 2 && <p className="text-slate-500 text-xs mt-0.5">3rd Place</p>}
              </div>
              <div className="text-right">
                <p className={index === 0 ? 'text-primary font-bold text-xl' : 'text-slate-900 font-bold text-lg'}>{player.score}</p>
                <p className="text-slate-400 text-xs font-medium">pts</p>
              </div>
            </div>
          ))}
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
    )
  }

  return (
    <div className="min-h-screen bg-background-light font-display text-slate-900 flex flex-col">
      <div className="w-full max-w-[430px] mx-auto flex-1 flex flex-col bg-white shadow-2xl min-h-screen">
        <header className="pt-12 pb-4 px-6 border-b border-primary/10 sticky top-0 z-10 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-bold leading-none">
                  {isFinalScoresView ? 'Final Scores' : `Round ${gameState.roundNumber} of ${settings?.totalRounds ?? 0}`}
                </h2>
              </div>
            </div>
          </div>
          {!isFinalScoresView && (
            <div className="mt-6 flex gap-3">
              <div className="flex-1 flex items-center gap-3 bg-primary/5 rounded-lg p-4 border border-primary/10">
                <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">timer</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
                    {preGuessPhase ? 'Guessing opens in' : 'Remaining'}
                  </p>
                  <p className="text-xl font-black text-slate-900">
                    {preGuessPhase ? Math.ceil(timeRemaining / 1000) : canGuess ? Math.ceil(timeRemaining / 1000) : 0}s
                  </p>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {!isFinalScoresView && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Current Clues</h3>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                  {gameState.cluesRevealed.length} Revealed
                </span>
              </div>
              <div ref={cluesScrollRef} className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {gameState.cluesRevealed
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((clue) => (
                    <div key={clue.order} className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined">auto_stories</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clue {clue.order}</span>
                            <span className="material-symbols-outlined text-green-500 text-sm">check_circle</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-medium">{clue.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {!isFinalScoresView && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Recent Guesses</h3>
                <span className="text-xs font-medium text-slate-500">{guessFeed.length} recent</span>
              </div>
              <div ref={guessesScrollRef} className="bg-slate-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                {guessFeed.length > 0 ? (
                  <div className="space-y-1.5">
                    {guessFeed.slice(-12).map((item, index) => {
                      const isFull = settings?.transparencyMode === 'full'
                      const message = item.correct
                        ? `${item.nickname} guessed correctly`
                        : isFull && item.guess
                          ? `${item.nickname}: ${item.guess}`
                          : `${item.nickname} guessed`
                      return (
                        <div key={index} className="text-sm text-slate-700">
                          {message}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-16 items-center text-sm text-slate-400">
                    No guesses yet.
                  </div>
                )}
              </div>
            </section>
          )}

          {!gameState.isLocked && canGuess && (
            <div className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">edit_note</span>
                <input
                  ref={guessInputRef}
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitGuess()}
                  placeholder="Enter your guess..."
                  className="w-full bg-slate-50 border-0 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 font-medium transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitGuess}
                disabled={!guess.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Guess
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          )}

          {gameState.isLocked && (
            <div className="p-4 bg-green-50 border-2 border-green-400 rounded-lg text-center">
              <div className="text-green-800 font-semibold">✓ You guessed correctly!</div>
              <div className="text-sm text-green-600 mt-1">Waiting for other players...</div>
            </div>
          )}

          <section className="space-y-3">
            <h3 className="font-bold text-slate-800">Current Standing</h3>
            <div className="bg-slate-50 rounded-lg p-2 space-y-1">
              {scoreboard.map((player, index) => (
                <div
                  key={player.playerId}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.playerId === playerId ? 'bg-primary/5 border border-primary/20' : 'bg-white'
                  } shadow-sm`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                      {player.nickname.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-sm ${player.playerId === playerId ? 'font-semibold' : 'font-medium text-slate-600'}`}>
                      {player.nickname}
                      {player.playerId === playerId && ' (You)'}
                    </span>
                  </div>
                  <span className={`text-sm font-black ${player.playerId === playerId ? 'text-primary' : 'text-slate-500'}`}>
                    {player.score}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </main>
      </div>

      {roundEndData && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex h-6 w-full items-center justify-center">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pt-2 pb-6 text-center">
              <h4 className="text-primary text-sm font-bold uppercase tracking-widest mb-1">Round Over!</h4>
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
                  {roundEndData.scoreboard.map((entry: any, index: number) => (
                    <div
                      key={entry.playerId}
                      className={`flex items-center justify-between p-3 rounded border-l-4 ${
                        index === 0 ? 'bg-primary/5 border-primary' : 'bg-slate-50 border-transparent'
                      }`}
                    >
                      <span className="text-slate-900 font-bold">{entry.nickname}</span>
                      <div className="flex items-center gap-2">
                        {entry.pointsEarned > 0 && <span className="text-primary font-bold text-sm">+{entry.pointsEarned}</span>}
                        <span className="text-slate-900 font-bold bg-white px-3 py-1 rounded shadow-sm">{entry.totalScore}</span>
                      </div>
                    </div>
                  ))}
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
