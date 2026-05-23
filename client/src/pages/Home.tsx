import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'
import { getErrorMessage, isFatalError } from '../utils/errorMessages'
import IosInstallHint from '../components/IosInstallHint'
import Logo from '../components/Logo'

function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { socket, emit, connected } = useSocket()
  const { roomCode, error, setError, setRoomCode } = useGame()
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const lastPrefilledRoomParamRef = useRef<string | null>(null)
  const params = new URLSearchParams(location.search)
  const roomParam = params.get('room')

  useEffect(() => {
    const stored = localStorage.getItem('whoami_room')
    if (stored && socket && connected && !roomCode) {
      try {
        const roomData = JSON.parse(stored)
        if (roomData.roomCode && roomData.nickname) {
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
    if (!roomParam) {
      lastPrefilledRoomParamRef.current = null
      return
    }

    if (lastPrefilledRoomParamRef.current !== roomParam) {
      setJoinCode(roomParam.toUpperCase())
      lastPrefilledRoomParamRef.current = roomParam
    }
  }, [roomParam])

  useEffect(() => {
    const storedNickname = localStorage.getItem('whoami_nickname')
    if (storedNickname) {
      setNickname(storedNickname)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const msg = window.sessionStorage.getItem('whoami_kick_message')
    if (msg) {
      setError(msg)
      window.sessionStorage.removeItem('whoami_kick_message')
    }
  }, [setError])

  useEffect(() => {
    if (!socket) return

    const handleRoomJoined = (data: any) => {
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
    localStorage.setItem('whoami_nickname', nickname.trim())
    emit('CREATE_ROOM', { nickname: nickname.trim() })
  }

  const handleJoinRoom = (e: React.FormEvent | React.MouseEvent) => {
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
    localStorage.setItem('whoami_nickname', nickname.trim())
    emit('JOIN_ROOM', {
      roomCode: joinCode.trim().toUpperCase(),
      nickname: nickname.trim()
    })
  }

  return (
    <div className="relative flex min-h-screen min-h-full w-full flex-col bg-gradient-to-br from-primary via-indigo-500 to-indigo-400 bg-fixed overflow-x-hidden font-display antialiased">
      <IosInstallHint />
      {!connected && (
        <div className="w-full bg-yellow-400/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-yellow-900 text-sm">sync</span>
          <p className="text-yellow-900 text-xs font-semibold uppercase tracking-wider">Connecting to server...</p>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center p-6 pb-12">
        <div className="mb-8 flex flex-col items-center">
          <Logo className="mb-4 h-32 w-32 object-contain sm:h-40 sm:w-40" />
          <h1 className="text-white text-3xl font-bold tracking-tight text-center">Who Am I?</h1>
          <p className="text-white/80 text-base font-medium text-center mt-1">The Ultimate Bible Character Quiz</p>
        </div>

        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 py-8 px-5 flex flex-col gap-6">
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-slate-800 text-sm font-semibold ml-1">Your Nickname</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">person</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Samuel"
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-slate-900 placeholder:text-slate-500 font-medium disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-slate-800 text-sm font-semibold ml-1">Room Code</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">key</span>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="6-character code"
                  maxLength={6}
                  disabled={loading}
                  enterKeyHint="go"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-slate-900 placeholder:text-slate-500 font-medium tracking-[0.2em] uppercase disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !nickname.trim() || !joinCode.trim() || !connected}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-5 rounded-lg shadow-lg shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <span>{loading ? 'Joining...' : 'Join Room'}</span>
              <span className="material-symbols-outlined">login</span>
            </button>
          </form>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center w-full gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-slate-600 text-sm font-medium">Or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={loading || !nickname.trim() || !connected}
              className="w-full py-3.5 px-4 rounded-lg border-2 border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/20 hover:border-primary/80 active:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
              Create new room instead
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <Link
            to="/play"
            className="text-white font-semibold text-sm hover:text-white/90 underline underline-offset-2"
          >
            Play in person
          </Link>
          <Link
            to="/about"
            className="text-white/90 hover:text-white text-sm font-medium underline underline-offset-2"
          >
            About &amp; how to play
          </Link>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm z-50">
          {error}
        </div>
      )}
    </div>
  )
}

export default Home
