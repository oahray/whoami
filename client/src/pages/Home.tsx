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
  const [showJoin, setShowJoin] = useState(() => Boolean(new URLSearchParams(location.search).get('room')))
  const [loading, setLoading] = useState(false)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const [deviceHistory, setDeviceHistory] = useState<GameHistoryEntry[]>([])
  const lastPrefilledRoomParamRef = useRef<string | null>(null)
  const joinCodeInputRef = useRef<HTMLInputElement | null>(null)
  const params = new URLSearchParams(location.search)
  const roomParam = params.get('room')
  const hasCompleteJoinCode = parseRoomCodeInput(joinCode).length === ROOM_CODE_LENGTH

  useEffect(() => {
    if (!roomParam) {
      lastPrefilledRoomParamRef.current = null
      return
    }

    if (lastPrefilledRoomParamRef.current !== roomParam) {
      setJoinCode(parseRoomCodeInput(roomParam))
      setShowJoin(true)
      lastPrefilledRoomParamRef.current = roomParam
    }
  }, [roomParam])

  useEffect(() => {
    if (!showJoin) return
    // Focus after expand so guests can type/paste immediately.
    const id = window.setTimeout(() => joinCodeInputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [showJoin])

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

  const handleCreateRoom = () => {
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

  const handleJoinRoom = () => {
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

  const handleOnlineSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (hasCompleteJoinCode) handleJoinRoom()
    else handleCreateRoom()
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
        <section className="relative isolate mb-5 flex w-full max-w-lg flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute -left-1 top-12 -rotate-12 text-3xl text-amber-300/80 sm:left-5 sm:text-4xl"
          >
            auto_awesome
          </span>
          <span
            aria-hidden="true"
            className="material-symbols-outlined absolute -right-1 top-20 rotate-12 text-4xl text-white/25 sm:right-5 sm:text-5xl"
          >
            question_mark
          </span>

          <div className="mb-3 inline-flex -rotate-1 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white shadow-sm backdrop-blur-sm">
            <span className="material-symbols-outlined text-sm text-amber-300" aria-hidden>
              auto_awesome
            </span>
            The Bible guessing game
          </div>

          <h1 className="home-brand-title text-white">
            <span className="sr-only">Who Am I?</span>
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center gap-0 font-brand text-[3.25rem] font-normal leading-none tracking-wide sm:text-7xl"
            >
              <span>Wh</span>
              <Logo
                title=""
                className="mx-[-0.06em] h-[1.25em] w-[1.25em] -rotate-2 object-contain drop-shadow-lg motion-safe:animate-[home-logo-pop_500ms_ease-out]"
              />
              <span className="ml-[0.08em]">Am I?</span>
            </span>
          </h1>

          <div
            aria-hidden="true"
            className="mt-4 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-wider text-white/75"
          >
            <span>Read clues</span>
            <span className="size-1 rounded-full bg-amber-300" />
            <span>Guess fast</span>
            <span className="size-1 rounded-full bg-amber-300" />
            <span className="text-amber-300">Have fun</span>
          </div>
        </section>

        <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl border border-edge py-8 px-5 flex flex-col gap-6">
          <div className="-mb-1 text-center">
            <h2 className="text-lg font-bold text-foreground">Start a multiplayer game</h2>
            <p className="mt-1 text-xs font-medium text-foreground-muted">
              One person creates a room; everyone else joins with the code.
            </p>
          </div>
          {maintenanceStatus.phase !== 'none' && (
            <MaintenanceBanner status={maintenanceStatus} />
          )}
          <form onSubmit={handleOnlineSubmit} className="flex flex-col gap-6">
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

            {!hasCompleteJoinCode && (
              <button
                type="submit"
                disabled={loading || !nickname.trim() || !connected}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-5 font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
              >
                {loading && !showJoin ? (
                  <LoadingState label="Creating" layout="inline" className="text-white" />
                ) : (
                  <>
                    <span className="material-symbols-outlined">add_circle</span>
                    <span>Create a room</span>
                  </>
                )}
              </button>
            )}
            {!hasCompleteJoinCode && (
              <p className="text-foreground-muted text-xs text-center -mt-3">
                You’ll get a code to share with friends.
              </p>
            )}

            {showJoin ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="friend-room-code" className="text-foreground text-sm font-semibold ml-1">
                  Friend&apos;s room code
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted" aria-hidden>
                    key
                  </span>
                  <input
                    id="friend-room-code"
                    ref={joinCodeInputRef}
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
                <p className="text-foreground-muted text-xs ml-1">
                  Ask the host — they create the room and share the code or link.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowJoin(true)}
                className="w-full py-3.5 px-4 rounded-lg border-2 border-primary bg-primary/10 text-primary font-semibold hover:bg-primary/20 hover:border-primary/80 active:bg-primary/25 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-xl" aria-hidden>
                  login
                </span>
                I have a code
              </button>
            )}

            {showJoin && (
              <button
                type={hasCompleteJoinCode ? 'submit' : 'button'}
                onClick={hasCompleteJoinCode ? undefined : handleJoinRoom}
                disabled={loading || !nickname.trim() || !hasCompleteJoinCode || !connected}
                className={
                  hasCompleteJoinCode
                    ? 'flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-5 font-bold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'
                    : 'flex w-full items-center justify-center gap-2 rounded-lg border-2 border-primary bg-primary/10 py-3.5 font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50'
                }
              >
                {loading && hasCompleteJoinCode ? (
                  <LoadingState label="Joining" layout="inline" className="text-white" />
                ) : (
                  <>
                    <span>Join room</span>
                    <span className="material-symbols-outlined" aria-hidden>
                      login
                    </span>
                  </>
                )}
              </button>
            )}

            {showJoin && !hasCompleteJoinCode && (
              <p className="text-foreground-muted text-xs text-center -mt-3">
                Don&apos;t have a code? Create a room above.
              </p>
            )}
          </form>
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
        <div
          role="alert"
          className="banner-danger fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-start gap-2"
        >
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-0.5 text-red-700/80 hover:bg-red-200/60 hover:text-red-900 dark:text-red-200/80 dark:hover:bg-red-900/40"
          >
            <span className="material-symbols-outlined text-base leading-none" aria-hidden>
              close
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export default Home
