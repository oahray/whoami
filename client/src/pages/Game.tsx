import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'

function Game() {
  const navigate = useNavigate()
  const { emit, on, off } = useSocket()
  const {
    roomCode,
    playerId,
    gameState,
    settings,
    error,
    players
  } = useGame()
  const [guess, setGuess] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [roundEndData, setRoundEndData] = useState<any>(null)
  const [gameEndData, setGameEndData] = useState<any>(null)
  const [autoReturnSeconds, setAutoReturnSeconds] = useState<number | null>(null)
  const [guessFeed, setGuessFeed] = useState<Array<{ nickname: string; guess?: string; correct: boolean }>>([])
  const [currentPhase, setCurrentPhase] = useState<'starting' | 'active' | 'clue_revealed' | 'ended'>('starting')

  useEffect(() => {
    if (!roomCode) {
      navigate('/')
    }
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
      setTimeout(() => {
        setRoundEndData(null)
      }, 5000)
    }

    const handleGameEnded = (data: any) => {
      setGameEndData(data)
    }

    const handleGuessBroadcast = (data: { nickname: string; guess?: string; correct: boolean }) => {
      setGuessFeed(prev => [...prev.slice(-4), data])
    }

    const handlePlayerCorrect = () => {
    }

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
    if (!gameState || !gameState.serverStartTime || !settings) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.serverStartTime!
      const startDelay = settings.roundStartDelayMs ?? 3000

      if (currentPhase === 'starting') {
        const remaining = Math.max(0, startDelay - elapsed)
        setTimeRemaining(remaining)
        if (remaining === 0 && currentPhase === 'starting') {
          setCurrentPhase('active')
        }
      } else if (currentPhase === 'active' || currentPhase === 'clue_revealed') {
        const remaining = Math.max(0, settings.roundDuration - elapsed)
        setTimeRemaining(remaining)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [gameState, settings, currentPhase])

  useEffect(() => {
    if (gameEndData) {
      setAutoReturnSeconds(30)
    } else {
      setAutoReturnSeconds(null)
    }
  }, [gameEndData])

  useEffect(() => {
    if (autoReturnSeconds === null) return
    if (autoReturnSeconds <= 0) {
      setGameEndData(null)
      navigate('/lobby')
      return
    }
    const id = setTimeout(() => {
      setAutoReturnSeconds(prev => (prev !== null ? prev - 1 : prev))
    }, 1000)
    return () => clearTimeout(id)
  }, [autoReturnSeconds, navigate])

  const handleSubmitGuess = () => {
    if (!guess.trim() || !gameState || gameState.isLocked) return

    emit('SUBMIT_GUESS', { guess: guess.trim() })
    setGuess('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmitGuess()
    }
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading game...</div>
      </div>
    )
  }

  if (gameEndData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4 sm:mb-6">Game Over!</h1>
          <div className="space-y-2 mb-4 sm:mb-6">
            {gameEndData.finalScoreboard
              .sort((a: any, b: any) => b.score - a.score)
              .map((player: any, index: number) => (
                <div
                  key={player.playerId}
                  className={`p-3 sm:p-4 rounded-md ${
                    index === 0 ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className="text-xl sm:text-2xl font-bold flex-shrink-0">#{index + 1}</span>
                      <span className="font-medium truncate">{player.nickname}</span>
                      {index === 0 && <span className="text-xs sm:text-sm bg-yellow-400 px-2 py-1 rounded flex-shrink-0">Winner!</span>}
                    </div>
                    <span className="text-lg sm:text-xl font-bold whitespace-nowrap flex-shrink-0">{player.score} pts</span>
                  </div>
                </div>
              ))}
          </div>
          <button
            onClick={() => {
              setGameEndData(null)
              navigate('/lobby')
            }}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium text-base"
          >
            Return to Lobby
          </button>
          {autoReturnSeconds !== null && (
            <p className="mt-2 text-xs sm:text-sm text-gray-500 text-center">
              Returning to lobby in {autoReturnSeconds}s...
            </p>
          )}
        </div>
      </div>
    )
  }

  const isFinalScoresView = gameState.roundNumber === 0
  const canGuess = !isFinalScoresView && (currentPhase === 'active' || currentPhase === 'clue_revealed')
  const preGuessPhase = !isFinalScoresView && currentPhase === 'starting'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 md:p-8">
          <div className="text-center mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold mb-2">
              {isFinalScoresView
                ? 'Final Scores'
                : `Round ${gameState.roundNumber}${settings ? ` of ${settings.totalRounds}` : ''}`}
            </h1>
            {preGuessPhase && timeRemaining > 0 && (
              <div className="text-base sm:text-lg text-gray-600 mb-3 sm:mb-4">
                Get ready! Guessing opens in {Math.ceil(timeRemaining / 1000)}s
              </div>
            )}
            {canGuess && timeRemaining > 0 && (
              <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-3 sm:mb-4">
                {Math.ceil(timeRemaining / 1000)}s remaining
              </div>
            )}
          </div>

          {!isFinalScoresView && (
            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {gameState.cluesRevealed
                .sort((a, b) => a.order - b.order)
                .map((clue) => (
                  <div
                    key={`clue-${clue.order}`}
                    className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200"
                  >
                    <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2">
                      Clue {clue.order}
                    </div>
                    <div className="text-base sm:text-lg leading-relaxed">{clue.text}</div>
                  </div>
                ))}
            </div>
          )
          }

          {!gameState.isLocked && canGuess && (
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your guess..."
                  className="flex-1 px-4 py-3 sm:py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={gameState.isLocked}
                />
                <button
                  onClick={handleSubmitGuess}
                  disabled={!guess.trim() || gameState.isLocked}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {gameState.isLocked && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border-2 border-green-400 rounded-md text-center">
              <div className="text-base sm:text-lg text-green-800 font-semibold">✓ You guessed correctly!</div>
              <div className="text-sm text-green-600 mt-1">Waiting for other players...</div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold mb-2 text-sm sm:text-base">Scoreboard</h3>
            <div className="space-y-1.5 sm:space-y-1">
              {(gameState.currentScoreboard && gameState.currentScoreboard.length > 0
                ? gameState.currentScoreboard
                : players.map(p => ({ playerId: p.id, nickname: p.nickname, score: 0 }))
              )
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div key={player.playerId} className="flex justify-between items-center text-sm sm:text-base">
                    <span className="truncate pr-2">
                      {index + 1}. {player.nickname}
                      {player.playerId === playerId && ' (You)'}
                    </span>
                    <span className="font-medium whitespace-nowrap">{player.score} pts</span>
                  </div>
                ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {guessFeed.length > 0 && (
            <div className="mt-3 sm:mt-4 bg-gray-50 rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Recent Guesses</h3>
              <div className="space-y-1">
                {guessFeed.slice(-5).map((item, index) => {
                  const isFull = settings?.transparencyMode === 'full'
                  const base = item.nickname
                  let message: string

                  if (item.correct) {
                    message = `${base} guessed correctly`
                  } else if (isFull && item.guess) {
                    message = `${base}: ${item.guess}`
                  } else {
                    message = `${base} guessed`
                  }

                  return (
                    <div key={index} className="text-xs sm:text-sm text-gray-700">
                      {message}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {roundEndData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Round Over!</h2>
            {roundEndData.answerRevealed && (
              <div className="mb-3 sm:mb-4">
                <div className="text-base sm:text-lg font-semibold mb-2">Answer: {roundEndData.answer}</div>
                {roundEndData.clues && roundEndData.clues.length > 0 && (
                  <div className="space-y-2">
                    {roundEndData.clues.map((clue: any, index: number) => (
                      <div key={index} className="text-xs sm:text-sm text-gray-700">
                        <div className="font-semibold">Clue {index + 1}</div>
                        <div>{clue.text}</div>
                        {clue.citations && (
                          <div className="text-[11px] sm:text-xs text-gray-500 mt-1 break-words">
                            Citations: {clue.citations}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2 mb-3 sm:mb-4">
              {roundEndData.scoreboard && roundEndData.scoreboard.length > 0 ? (
                <>
                  <h3 className="font-semibold text-sm sm:text-base">Scores after this round:</h3>
                  {roundEndData.scoreboard.map((entry: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="truncate pr-2">
                        {index + 1}. {entry.nickname} ({Math.floor(entry.timeElapsedMs / 1000)}s)
                      </span>
                      <span className="font-medium whitespace-nowrap">
                        {entry.totalScore} pts
                        {typeof entry.pointsEarned === 'number' && entry.pointsEarned > 0 && (
                          <span className="ml-1 text-[11px] text-gray-500">(+{entry.pointsEarned})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-xs sm:text-sm text-gray-600">
                  No one got it this round.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Game
