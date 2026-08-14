import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useGame } from '../hooks/useGame'
import { useSocket } from '../hooks/useSocket'
import { unlockAudio } from '../lib/sounds'
import { listVerifiedDeviceArchives } from '../lib/deviceArchive'
import GameHistoryPanel from '../components/GameHistoryPanel'
import type { GameHistoryEntry } from '../lib/gameHistory'
import {
  isAvatarId,
  pickRandomAvatarId,
  readStoredAvatarId,
  writeStoredAvatarId,
  type AvatarId
} from '../lib/avatars'
import { getErrorMessage, isFatalError } from '../utils/errorMessages'
import { parseRoomCodeInput, ROOM_CODE_LENGTH } from '../lib/roomCode'
import AvatarPicker from '../components/AvatarPicker'
import IosInstallHint from '../components/IosInstallHint'
import FeedbackLink from '../components/FeedbackLink'
import LoadingState from '../components/LoadingState'
import Logo from '../components/Logo'
import MaintenanceBanner from '../components/MaintenanceBanner'
import PlayerAvatar from '../components/PlayerAvatar'
import { useMaintenanceStatus } from '../hooks/useMaintenanceStatus'

function Home() {
  const navigate = useNavigate()
  const { status: maintenanceStatus } = useMaintenanceStatus()
  const location = useLocation()
  const { socket, emit, connected, transportStatus, retryConnect } = useSocket()
  const { error, setError, setRoomCode } = useGame()
  const [nickname, setNickname] = useState('')
  const [avatarId, setAvatarId] = useState<AvatarId>(() => readStoredAvatarId() ?? pickRandomAvatarId())
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const [deviceHistory, setDeviceHistory] = useState<GameHistoryEntry[]>([])
  const lastPrefilledRoomParamRef = useRef<string | null>(null)
  const params = new URLSearchParams(location.search)
  const roomParam = params.get('room')

  useEffect(() => {
    if (!roomParam) {
      lastPrefilledRoomParamRef.current = null
      return
    }

    if (lastPrefilledRoomParamRef.current !== roomParam) {
      setJoinCode(parseRoomCodeInput(roomParam))
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
    writeStoredAvatarId(avatarId)
  }, [avatarId])

  useEffect(() => {
    if (!historySheetOpen) return
    void listVerifiedDeviceArchives().then(setDeviceHistory)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistorySheetOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [historySheetOpen])

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
          if (isAvatarId(player.avatarId)) {
            writeStoredAvatarId(player.avatarId)
            setAvatarId(player.avatarId)
          }
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
    unlockAudio()
    localStorage.setItem('whoami_nickname', nickname.trim())
    writeStoredAvatarId(avatarId)
    emit('CREATE_ROOM', { nickname: nickname.trim(), avatarId })
  }

  const handleJoinRoom = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    const roomCode = parseRoomCodeInput(joinCode)
    if (!nickname.trim() || roomCode.length !== ROOM_CODE_LENGTH) {
      setError('Please enter both nickname and room code')
      return
    }
    if (!connected) {
      setError('Not connected to server. Please wait...')
      return
    }
    setLoading(true)
    setError(null)
    unlockAudio()
    localStorage.setItem('whoami_nickname', nickname.trim())
    writeStoredAvatarId(avatarId)
    emit('JOIN_ROOM', {
      roomCode,
      nickname: nickname.trim(),
      avatarId
    })
  }

  return (
    <div className="relative flex min-h-screen min-h-full w-full flex-col bg-primary home-hero-pattern overflow-x-hidden font-display antialiased">
      <IosInstallHint />
      {transportStatus === 'connecting' && (
        <div
          role="status"
          aria-live="polite"
          className="w-full bg-yellow-400/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-yellow-900 text-sm animate-pulse">sync</span>
          <p className="text-yellow-900 text-xs font-semibold uppercase tracking-wider">Connecting to server...</p>
        </div>
      )}
      {transportStatus === 'failed' && (
        <div
          role="alert"
          className="w-full bg-amber-500/95 backdrop-blur-sm px-4 py-2 flex flex-wrap items-center justify-center gap-2"
        >
          <p className="text-amber-950 text-xs font-semibold uppercase tracking-wider">
            Couldn&apos;t reach the server
          </p>
          <button
            type="button"
            onClick={retryConnect}
            className="rounded-md bg-amber-950/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-950 hover:bg-amber-950/25"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center p-6 pb-12">
        <div className="mb-8 flex flex-col items-center">
          <Logo className="mb-4 h-32 w-32 object-contain sm:h-40 sm:w-40" />
          <h1 className="text-white text-3xl font-bold tracking-tight text-center">Who Am I?</h1>
          <p className="text-white/80 text-base font-medium text-center mt-1">The Ultimate Bible Character Quiz</p>
        </div>

        <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-edge py-8 px-5 flex flex-col gap-6">
          {maintenanceStatus.phase !== 'none' && (
            <MaintenanceBanner status={maintenanceStatus} />
          )}
          <form onSubmit={handleJoinRoom} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-semibold ml-1">Your Nickname</label>
              <div className="relative">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setAvatarPickerOpen((open) => !open)}
                  aria-expanded={avatarPickerOpen}
                  aria-label={avatarPickerOpen ? 'Hide avatar choices' : 'Change avatar'}
                  className={`absolute left-2.5 top-1/2 z-10 -translate-y-1/2 size-10 rounded-full overflow-visible border-2 transition-colors disabled:opacity-60 ${
                    avatarPickerOpen
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-primary/40'
                  }`}
                >
                  <PlayerAvatar
                    avatarId={avatarId}
                    nickname={nickname || '?'}
                    sizeClassName="size-full"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-white border border-surface">
                    <span className="material-symbols-outlined text-[10px] leading-none" aria-hidden>
                      edit
                    </span>
                  </span>
                </button>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Samuel"
                  disabled={loading}
                  className="w-full pl-[3.75rem] pr-4 py-4 bg-surface-muted border-2 border-edge rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-foreground placeholder:text-foreground-muted font-medium disabled:opacity-60"
                />
              </div>
              {avatarPickerOpen && (
                <AvatarPicker
                  value={avatarId}
                  onChange={(next) => {
                    setAvatarId(next)
                    setAvatarPickerOpen(false)
                  }}
                  disabled={loading}
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-foreground text-sm font-semibold ml-1">Room Code</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted">key</span>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(parseRoomCodeInput(e.target.value))}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text')
                    if (!pasted) return
                    e.preventDefault()
                    setJoinCode(parseRoomCodeInput(pasted))
                  }}
                  placeholder="Code or invite link"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={loading}
                  enterKeyHint="go"
                  className="w-full pl-12 pr-4 py-4 bg-surface-muted border-2 border-edge rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors text-foreground placeholder:text-foreground-muted font-medium tracking-[0.2em] uppercase disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !nickname.trim() || joinCode.length !== ROOM_CODE_LENGTH || !connected}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-5 rounded-lg shadow-lg shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <LoadingState label="Joining" layout="inline" className="text-white" />
              ) : (
                <>
                  <span>Join Room</span>
                  <span className="material-symbols-outlined">login</span>
                </>
              )}
            </button>
          </form>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center w-full gap-3">
              <div className="flex-1 h-px bg-edge" />
              <span className="text-foreground-muted text-sm font-medium">Or</span>
              <div className="flex-1 h-px bg-edge" />
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

        <nav
          aria-label="Other ways to play"
          className="mt-6 flex flex-wrap justify-center gap-2 w-full max-w-sm mx-auto"
        >
          <Link
            to="/solo"
            className="inline-flex flex-1 basis-[calc(50%-0.25rem)] min-w-[8rem] items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2.5 text-white text-sm font-semibold hover:bg-white/15 transition-colors"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              person
            </span>
            Solo
          </Link>
          <Link
            to="/play"
            className="inline-flex flex-1 basis-[calc(50%-0.25rem)] min-w-[8rem] items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2.5 text-white text-sm font-semibold hover:bg-white/15 transition-colors"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              groups
            </span>
            Pass &amp; play
          </Link>
          <Link
            to="/about"
            className="inline-flex flex-1 basis-[calc(50%-0.25rem)] min-w-[8rem] items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2.5 text-white/90 text-sm font-medium hover:bg-white/15 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              info
            </span>
            About
          </Link>
          <button
            type="button"
            onClick={() => setHistorySheetOpen(true)}
            className="inline-flex flex-1 basis-[calc(50%-0.25rem)] min-w-[8rem] items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2.5 text-white text-sm font-semibold hover:bg-white/15 transition-colors"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              history
            </span>
            History
            {deviceHistory.length > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {deviceHistory.length}
              </span>
            ) : null}
          </button>
        </nav>
        <p className="mt-3 text-center text-white/70 text-xs font-medium space-x-3">
          <Link
            to="/privacy"
            className="underline-offset-2 hover:text-white hover:underline"
          >
            Privacy
          </Link>
          <FeedbackLink className="underline-offset-2 hover:text-white hover:underline">
            Feedback
          </FeedbackLink>
        </p>
      </div>

      {historySheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-6"
          role="presentation"
          onClick={() => setHistorySheetOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-history-sheet-title"
            className="w-full bg-surface rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl max-h-[min(90vh,40rem)] md:max-w-lg flex flex-col pb-[env(safe-area-inset-bottom)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-6 w-full items-center justify-center md:hidden shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-surface-elevated" />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-edge shrink-0">
              <h2
                id="device-history-sheet-title"
                className="text-foreground text-lg font-bold tracking-tight flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-primary">history</span>
                History
              </h2>
              <button
                type="button"
                onClick={() => setHistorySheetOpen(false)}
                aria-label="Close"
                className="flex size-10 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4 flex-1 min-h-0">
              {deviceHistory.length > 0 ? (
                <GameHistoryPanel
                  roomCode={deviceHistory[deviceHistory.length - 1]?.roomCode ?? ''}
                  history={deviceHistory}
                  variant="plain"
                  initialEntryId={deviceHistory[deviceHistory.length - 1]?.id}
                />
              ) : (
                <p className="text-sm text-foreground-muted leading-relaxed">
                  Multiplayer games you finish on this device show up here. Clearing site data removes them.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto p-3 bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm z-50 flex items-start gap-2">
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-0.5 text-red-700/80 hover:bg-red-200/60 hover:text-red-900 dark:text-red-200/80 dark:hover:bg-red-900/40"
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default Home
