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
    error
  } = useGame()
  const [guess, setGuess] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [roundEndData, setRoundEndData] = useState<any>(null)
  const [gameEndData, setGameEndData] = useState<any>(null)
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
      if (!data.correct) {
        setGuessFeed(prev => [...prev.slice(-4), data])
      }
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
    if (!gameState || !gameState.serverStartTime) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.serverStartTime!

      if (currentPhase === 'starting') {
        const remaining = Math.max(0, 3000 - elapsed)
        setTimeRemaining(remaining)
        if (remaining === 0 && currentPhase === 'starting') {
          setCurrentPhase('active')
        }
      } else if (settings && (currentPhase === 'active' || currentPhase === 'clue_revealed')) {
        const remaining = Math.max(0, settings.roundDuration - elapsed)
        setTimeRemaining(remaining)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [gameState, settings, currentPhase])

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
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-center mb-6">Game Over!</h1>
          <div className="space-y-2 mb-6">
            {gameEndData.finalScoreboard
              .sort((a: any, b: any) => b.score - a.score)
              .map((player: any, index: number) => (
                <div
                  key={player.playerId}
                  className={`p-4 rounded-md ${
                    index === 0 ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold">#{index + 1}</span>
                      <span className="font-medium">{player.nickname}</span>
                      {index === 0 && <span className="text-sm bg-yellow-400 px-2 py-1 rounded">Winner!</span>}
                    </div>
                    <span className="text-xl font-bold">{player.score} pts</span>
                  </div>
                </div>
              ))}
          </div>
          <button
            onClick={() => {
              setGameEndData(null)
              navigate('/lobby')
            }}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    )
  }

  const canGuess = currentPhase === 'active' || currentPhase === 'clue_revealed'
  const preGuessPhase = currentPhase === 'starting'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">
              Round {gameState.roundNumber}
              {settings && ` of ${settings.totalRounds}`}
            </h1>
            {preGuessPhase && timeRemaining > 0 && (
              <div className="text-lg text-gray-600 mb-4">
                Get ready! Guessing opens in {Math.ceil(timeRemaining / 1000)}s
              </div>
            )}
            {canGuess && timeRemaining > 0 && (
              <div className="text-lg font-semibold text-blue-600 mb-4">
                {Math.ceil(timeRemaining / 1000)}s remaining
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            {gameState.cluesRevealed
              .sort((a, b) => a.order - b.order)
              .map((clue) => (
                <div
                  key={`clue-${clue.order}`}
                  className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200"
                >
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    Clue {clue.order}
                  </div>
                  <div className="text-lg">{clue.text}</div>
                </div>
              ))}
          </div>

          {!gameState.isLocked && canGuess && (
            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your guess..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={gameState.isLocked}
                />
                <button
                  onClick={handleSubmitGuess}
                  disabled={!guess.trim() || gameState.isLocked}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {gameState.isLocked && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-400 rounded-md text-center">
              <div className="text-green-800 font-semibold">✓ You guessed correctly!</div>
              <div className="text-sm text-green-600 mt-1">Waiting for other players...</div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Scoreboard</h3>
            <div className="space-y-1">
              {gameState.currentScoreboard
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div key={player.playerId} className="flex justify-between text-sm">
                    <span>
                      {index + 1}. {player.nickname}
                      {player.playerId === playerId && ' (You)'}
                    </span>
                    <span className="font-medium">{player.score} pts</span>
                  </div>
                ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {guessFeed.length > 0 && settings?.transparencyMode === 'full' && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Recent Guesses</h3>
              <div className="space-y-1">
                {guessFeed
                  .filter(item => !item.correct)
                  .slice(-5)
                  .map((item, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium">{item.nickname}</span>
                      {item.guess && (
                        <span className="text-gray-600">: {item.guess}</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {roundEndData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4">Round Over!</h2>
            {roundEndData.answerRevealed && (
              <div className="mb-4">
                <div className="text-lg font-semibold mb-2">Answer: {roundEndData.answer}</div>
                {roundEndData.citations && roundEndData.citations.length > 0 && (
                  <div className="text-sm text-gray-600">
                    Citations: {roundEndData.citations.join(', ')}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2 mb-4">
              <h3 className="font-semibold">Round Scoreboard:</h3>
              {roundEndData.scoreboard.map((entry: any, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {index + 1}. {entry.nickname} ({Math.floor(entry.timeElapsedMs / 1000)}s)
                  </span>
                  <span className="font-medium">+{entry.pointsEarned} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Game
