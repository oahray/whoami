import { usePreferences } from '../context/PreferencesContext'
import { unlockAudio } from '../lib/sounds'

type SoundToggleProps = {
  className?: string
}

function SoundToggle({ className = '' }: SoundToggleProps) {
  const {
    sfxVolume,
    musicVolume,
    sfxAllowed,
    musicAllowed,
    setSoundsEnabled,
    reducedMotion
  } = usePreferences()

  const soundsEnabled = sfxVolume > 0 || musicVolume > 0
  const soundsAllowed = sfxAllowed || musicAllowed

  const handleClick = () => {
    if (!soundsEnabled) unlockAudio()
    setSoundsEnabled(!soundsEnabled)
  }

  const icon = soundsAllowed ? 'volume_up' : 'volume_off'
  const label = soundsAllowed
    ? 'Mute sounds'
    : reducedMotion
      ? 'Sounds muted (Reduce motion is on)'
      : soundsEnabled
        ? 'Mute sounds'
        : 'Unmute sounds'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex size-9 md:size-10 items-center justify-center rounded-full border transition-colors ${
        soundsAllowed
          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-edge bg-surface-elevated text-foreground-muted hover:bg-surface-muted'
      } ${className}`.trim()}
      aria-label={label}
      aria-pressed={soundsAllowed}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  )
}

export default SoundToggle
