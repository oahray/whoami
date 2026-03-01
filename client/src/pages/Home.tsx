import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'
import { getErrorMessage, isFatalError } from '../utils/errorMessages'

function Home() {
  const navigate = useNavigate()
  const { socket, emit, connected } = useSocket()
  const { roomCode, error, setError, setRoomCode } = useGame()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (roomCode && !loading) {
      console.log('roomCode changed, navigating to lobby:', roomCode)
      const timer = setTimeout(() => {
        navigate('/lobby', { replace: true })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [roomCode, loading, navigate])

  useEffect(() => {
    const stored = localStorage.getItem('whoami_room')
    if (stored && socket && connected && !roomCode) {
      try {
        const roomData = JSON.parse(stored)
        if (roomData.roomCode && roomData.nickname) {
          console.log('Attempting to reconnect to room:', roomData.roomCode)
          emit('JOIN_ROOM', {
            roomCode: roomData.roomCode,
            nickname: roomData.nickname
          })
        }
      } catch (e) {
        localStorage.removeItem('whoami_room')
      }
    }
  }, [socket, connected, roomCode, emit])

  useEffect(() => {
    if (!socket) return

    const handleRoomJoined = (data: any) => {
      console.log('ROOM_JOINED received:', data)
      setLoading(false)
      const finalRoomCode = data.roomCode || joinCode.trim().toUpperCase()
      if (finalRoomCode) {
        setRoomCode(finalRoomCode)
        const player = data.players?.find((p: any) => p.id === data.playerId)
        if (player) {
          localStorage.setItem('whoami_room', JSON.stringify({
            roomCode: finalRoomCode,
            nickname: player.nickname,
            playerId: data.playerId,
            isHost: data.isHost
          }))
        }
      }
      setTimeout(() => {
        navigate('/lobby', { replace: true })
      }, 100)
    }

    const handleRoomError = (data: { code: string; message: string }) => {
      console.error('ROOM_ERROR:', data)
      const userMessage = getErrorMessage(data.code, data.message)
      setError(userMessage)
      setLoading(false)
      if (isFatalError(data.code)) {
        localStorage.removeItem('whoami_room')
      }
    }

    socket.on('ROOM_JOINED', handleRoomJoined)
    socket.on('ROOM_ERROR', handleRoomError)

    return () => {
      socket.off('ROOM_JOINED', handleRoomJoined)
      socket.off('ROOM_ERROR', handleRoomError)
    }
  }, [socket, navigate, setError, joinCode, setRoomCode])

  const handleCreateRoom = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('Please enter a nickname')
      return
    }

    if (!socket || !connected) {
      setError('Not connected to server. Please wait...')
      return
    }

    setLoading(true)
    setError(null)
    console.log('Emitting CREATE_ROOM with nickname:', nickname.trim())
    emit('CREATE_ROOM', { nickname: nickname.trim() })
  }

  const handleJoinRoom = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!nickname.trim() || !joinCode.trim()) {
      setError('Please enter both nickname and room code')
      return
    }

    if (!connected) {
      setError('Not connected to server. Please wait...')
      return
    }

    setLoading(true)
    setError(null)
    emit('JOIN_ROOM', {
      roomCode: joinCode.trim().toUpperCase(),
      nickname: nickname.trim()
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Who Am I?</h1>
          <p className="text-gray-600">Bible Quiz Game</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={loading || !nickname.trim() || !connected}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={loading || !nickname.trim() || !joinCode.trim() || !connected}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>

          {!connected && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded text-sm">
              Connecting to server...
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home
