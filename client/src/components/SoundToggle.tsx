import { usePreferences } from '../context/PreferencesContext'
import { unlockAudio } from '../lib/sounds'

type SoundToggleProps = {
  className?: string
}

function SoundToggle({ className = '' }: SoundToggleProps) {
  const { sfxEnabled, setSfxEnabled, sfxAllowed, reducedMotion } = usePreferences()

  const handleClick = () => {
    if (!sfxEnabled) unlockAudio()
    setSfxEnabled(!sfxEnabled)
  }

  const icon = sfxAllowed ? 'volume_up' : 'volume_off'
  const label = sfxAllowed
    ? 'Mute sound effects'
    : reducedMotion
      ? 'Sound effects muted (Reduce motion is on)'
      : sfxEnabled
        ? 'Mute sound effects'
        : 'Unmute sound effects'

  const isOn = sfxAllowed

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex size-9 md:size-10 items-center justify-center rounded-full border transition-colors ${
        isOn
          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-edge bg-surface-elevated text-foreground-muted hover:bg-surface-muted'
      } ${className}`.trim()}
      aria-label={label}
      aria-pressed={isOn}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  )
}

export default SoundToggle
