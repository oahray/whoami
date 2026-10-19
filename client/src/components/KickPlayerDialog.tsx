import { useEffect, useRef } from 'react'
import PlayerAvatar from './PlayerAvatar'

type KickPlayerDialogProps = {
  /** Player the host is about to kick; the dialog is closed when null. */
  player: { id: string; nickname: string; avatarId?: string | null } | null
  onCancel: () => void
  onConfirm: (playerId: string) => void
}

/** Host confirmation before removing a player from the lobby. */
export default function KickPlayerDialog({ player, onCancel, onConfirm }: KickPlayerDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const open = player !== null

  useEffect(() => {
    if (!open) return
    // Default focus on the safe action so Enter never kicks by accident.
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!player) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm md:items-center md:p-6"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kick-player-title"
        aria-describedby="kick-player-description"
        className="w-full max-w-md rounded-t-2xl border border-edge bg-surface p-6 shadow-2xl md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <PlayerAvatar
            avatarId={player.avatarId}
            nickname={player.nickname}
            sizeClassName="size-12"
            className="border border-red-500/30"
          />
          <div className="min-w-0 flex-1">
            <h3 id="kick-player-title" className="text-lg font-black text-foreground break-words">
              Kick {player.nickname}?
            </h3>
            <p id="kick-player-description" className="mt-2 text-sm text-foreground-muted">
              They&apos;ll be removed from this room. They can rejoin with the room code, but a
              player kicked twice can&apos;t come back.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border-2 border-edge py-3 font-semibold hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(player.id)}
            className="rounded-lg bg-red-600 py-3 font-bold text-white hover:bg-red-700"
          >
            Kick player
          </button>
        </div>
      </div>
    </div>
  )
}
