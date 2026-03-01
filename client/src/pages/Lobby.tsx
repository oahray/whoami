import { useEffect, useState } from 'react'
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
    reset
  } = useGame()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!roomCode) {
      const timer = setTimeout(() => {
        if (!roomCode) {
          navigate('/')
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [roomCode, navigate])

  useEffect(() => {
    const handleRoundStarted = () => {
      navigate('/game')
    }

    on('ROUND_STARTED', handleRoundStarted)

    return () => {
      off('ROUND_STARTED', handleRoundStarted)
    }
  }, [on, off, navigate])

  useEffect(() => {
    if (gameState && gameState.phase !== 'ended' && gameState.phase !== 'starting') {
      navigate('/game')
    }
  }, [gameState, navigate])

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  const handleUpdateSetting = (key: string, value: any) => {
    if (!isHost) return
    emit('UPDATE_SETTINGS', { [key]: value })
  }

  if (!roomCode) return null

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Room Lobby</h1>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Leave Room
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-lg text-center"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Players ({players.length}/5)</h2>
              <div className="space-y-2">
                {players.filter(p => p.isConnected).map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 rounded-md ${
                      player.isHost ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{player.nickname}</span>
                      {player.isHost && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          Host
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={players.filter(p => p.isConnected).length < 2}
                  className="mt-4 w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Start Game ({players.filter(p => p.isConnected).length} players)
                </button>
              )}
            </div>

            {isHost && settings && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Game Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      value={settings.difficultyMode}
                      onChange={(e) => handleUpdateSetting('difficultyMode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="nightmare">Nightmare</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Rounds: {settings.totalRounds}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="10"
                      value={settings.totalRounds}
                      onChange={(e) => handleUpdateSetting('totalRounds', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Round Duration: {settings.roundDuration / 1000}s
                    </label>
                    <input
                      type="range"
                      min="10000"
                      max="60000"
                      step="5000"
                      value={settings.roundDuration}
                      onChange={(e) => handleUpdateSetting('roundDuration', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clue Reveal Time: {settings.clueRevealTime / 1000}s
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={settings.roundDuration - 3000}
                      step="1000"
                      value={settings.clueRevealTime}
                      onChange={(e) => handleUpdateSetting('clueRevealTime', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="strictMode"
                      checked={settings.strictMode}
                      onChange={(e) => handleUpdateSetting('strictMode', e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="strictMode" className="text-sm font-medium text-gray-700">
                      Strict Mode
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Lobby
