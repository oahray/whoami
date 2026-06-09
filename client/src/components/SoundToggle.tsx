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
    ? 'Turn sound effects off'
    : reducedMotion
      ? 'Sound effects off (Reduce motion is on)'
      : sfxEnabled
        ? 'Turn sound effects off'
        : 'Turn sound effects on'

  const isOn = sfxAllowed

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex size-9 md:size-10 items-center justify-center rounded-full border transition-colors ${
        isOn
          ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-slate-200 bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-500'
      } ${className}`.trim()}
      aria-label={label}
      aria-pressed={isOn}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  )
}

export default SoundToggle
