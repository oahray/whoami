import {
  AVATAR_IDS,
  avatarSrc,
  type AvatarId
} from '../lib/avatars'

type AvatarPickerProps = {
  value: AvatarId
  onChange: (next: AvatarId) => void
  disabled?: boolean
}

/** Grid of avatars. Shown only when the parent opens the change tray. */
export default function AvatarPicker({ value, onChange, disabled = false }: AvatarPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose avatar"
      className="grid grid-cols-6 gap-2 sm:grid-cols-8 max-h-56 overflow-y-auto rounded-lg border border-edge bg-surface-muted/60 p-3"
    >
      {AVATAR_IDS.map((id) => {
        const selected = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`aspect-square rounded-full overflow-hidden border-2 transition-colors disabled:opacity-50 ${
              selected
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-edge hover:border-primary/50'
            }`}
          >
            <img src={avatarSrc(id)} alt="" className="size-full object-cover" />
          </button>
        )
      })}
    </div>
  )
}
