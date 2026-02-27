import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import { useSocket } from '../hooks/useSocket'

function Home() {
  const navigate = useNavigate()
  const { emit } = useSocket()
  const { setRoomCode, setError } = useGame()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname')
      return
    }

    setLoading(true)
    setError(null)

    emit('CREATE_ROOM', { nickname: nickname.trim() })
  }

  const handleJoinRoom = async () => {
    if (!nickname.trim() || !joinCode.trim()) {
      setError('Please enter both nickname and room code')
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
              onClick={handleCreateRoom}
              disabled={loading || !nickname.trim()}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Create Room
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
              onClick={handleJoinRoom}
              disabled={loading || !nickname.trim() || !joinCode.trim()}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
