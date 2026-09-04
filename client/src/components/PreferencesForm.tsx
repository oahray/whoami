import { usePreferences } from '../context/PreferencesContext'
import { playSound, unlockAudio } from '../lib/sounds'
import {
  musicPercentToVolume,
  musicVolumeToPercent,
  sfxPercentToVolume,
  sfxVolumeToPercent,
  type ThemeMode
} from '../lib/preferences'

type PreferencesFormProps = {
  idPrefix?: string
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

function PreferencesForm({ idPrefix = 'pref' }: PreferencesFormProps) {
  const {
    sfxVolume,
    setSfxVolume,
    musicVolume,
    setMusicVolume,
    reducedMotion,
    sfxAllowed,
    sfxEnabled,
    theme,
    setTheme
  } = usePreferences()
  const sfxId = `${idPrefix}-sfx-volume`
  const musicId = `${idPrefix}-music-volume`
  const themeGroupId = `${idPrefix}-theme`
  const sfxPercent = sfxVolumeToPercent(sfxVolume)
  const musicPercent = musicVolumeToPercent(musicVolume)

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Appearance</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby={themeGroupId}>
          <span id={themeGroupId} className="sr-only">
            Color theme
          </span>
          {THEME_OPTIONS.map((option) => {
            const id = `${idPrefix}-theme-${option.value}`
            const selected = theme === option.value
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-edge bg-surface-muted text-foreground-muted hover:bg-surface-elevated'
                }`}
              >
                <input
                  type="radio"
                  id={id}
                  name={`${idPrefix}-theme`}
                  value={option.value}
                  checked={selected}
                  onChange={() => setTheme(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            )
          })}
        </div>
        <p className="text-xs text-foreground-muted">
          System follows your device light or dark setting.
        </p>
      </fieldset>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={sfxId} className="text-foreground text-sm font-medium">
            Sound effects
          </label>
          <span className="text-xs font-semibold tabular-nums text-foreground-muted">
            {sfxPercent}%
          </span>
        </div>
        <input
          type="range"
          id={sfxId}
          min={0}
          max={100}
          step={5}
          value={sfxPercent}
          onChange={(event) => {
            unlockAudio()
            const next = sfxPercentToVolume(Number(event.target.value))
            setSfxVolume(next)
            if (next > 0) playSound('clue-pop')
          }}
          className="w-full accent-primary"
          aria-valuetext={`${sfxPercent} percent`}
        />
        <p className="text-xs text-foreground-muted">
          Game cues and reactions on this device only. 0% is mute.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={musicId} className="text-foreground text-sm font-medium">
            Music
          </label>
          <span className="text-xs font-semibold tabular-nums text-foreground-muted">
            {musicPercent}%
          </span>
        </div>
        <input
          type="range"
          id={musicId}
          min={0}
          max={100}
          step={5}
          value={musicPercent}
          onChange={(event) => {
            unlockAudio()
            setMusicVolume(musicPercentToVolume(Number(event.target.value)))
          }}
          className="w-full accent-primary"
          aria-valuetext={`${musicPercent} percent`}
        />
        <p className="text-xs text-foreground-muted">
          Soft theme on lobby and setup screens. Separate from sound effects.
        </p>
      </div>

      {reducedMotion && (
        <p className="text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Sounds and music are off because <strong>Reduce motion</strong> is on in your system
          settings.
          {sfxEnabled && !sfxAllowed ? ' Your volume settings are saved for later.' : null}
        </p>
      )}
    </div>
  )
}

export default PreferencesForm
