import { useEffect } from 'react'

type AloneInRoomDialogProps = {
  open: boolean
  onStay: () => void
  onLeave: () => void
}

/** Prompt when every other player has left the multiplayer room. */
export default function AloneInRoomDialog({
  open,
  onStay,
  onLeave
}: AloneInRoomDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onStay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onStay])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm md:items-center md:p-6"
      role="presentation"
      onClick={onStay}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alone-in-room-title"
        className="w-full max-w-md rounded-t-2xl border border-edge bg-surface p-6 shadow-2xl md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-3xl text-amber-500"
            aria-hidden
          >
            person_off
          </span>
          <div className="min-w-0 flex-1">
            <h3
              id="alone-in-room-title"
              className="text-lg font-black text-foreground"
            >
              Everyone else left
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              You&apos;re the only player left in this room. Stay and wait for
              others, or leave and return home.
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onStay}
            className="rounded-lg border-2 border-edge py-3 font-semibold hover:bg-surface-muted"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-lg bg-primary py-3 font-bold text-white hover:bg-primary/90"
          >
            Leave room
          </button>
        </div>
      </div>
    </div>
  )
}
