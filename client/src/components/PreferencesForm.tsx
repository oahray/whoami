import { usePreferences } from '../context/PreferencesContext'
import { playSound, unlockAudio } from '../lib/sounds'
import {
  musicPercentToVolume,
  musicVolumeToPercent,
  sfxPercentToVolume,
  sfxVolumeToPercent,
  supportsVibration,
  type ColorPalette,
  type TextSize,
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

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; sample: string }[] = [
  { value: 'default', label: 'Default', sample: 'text-sm' },
  { value: 'large', label: 'Large', sample: 'text-base' },
  { value: 'larger', label: 'Larger', sample: 'text-lg' },
]

const PALETTE_OPTIONS: { value: ColorPalette; label: string; swatch: string }[] = [
  { value: 'blue', label: 'Blue', swatch: '#2b4bee' },
  { value: 'green', label: 'Green', swatch: '#0e6b45' },
  { value: 'wine', label: 'Wine', swatch: '#7a2a3a' },
  { value: 'purple', label: 'Purple', swatch: '#4c2a9e' },
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
    setTheme,
    palette,
    setPalette,
    vibrationEnabled,
    setVibrationEnabled,
    textSize,
    setTextSize
  } = usePreferences()
  const sfxId = `${idPrefix}-sfx-volume`
  const musicId = `${idPrefix}-music-volume`
  const themeGroupId = `${idPrefix}-theme`
  const paletteGroupId = `${idPrefix}-palette`
  const textSizeGroupId = `${idPrefix}-text-size`
  const vibrationId = `${idPrefix}-vibration`
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

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Color</legend>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby={paletteGroupId}>
          <span id={paletteGroupId} className="sr-only">
            Color palette
          </span>
          {PALETTE_OPTIONS.map((option) => {
            const id = `${idPrefix}-palette-${option.value}`
            const selected = palette === option.value
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={`cursor-pointer rounded-lg border px-1 py-2 text-center text-xs font-semibold transition-colors ${
                  selected
                    ? 'border-foreground bg-surface text-foreground'
                    : 'border-edge bg-surface-muted text-foreground-muted hover:bg-surface-elevated'
                }`}
              >
                <input
                  type="radio"
                  id={id}
                  name={`${idPrefix}-palette`}
                  value={option.value}
                  checked={selected}
                  onChange={() => setPalette(option.value)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="mx-auto mb-1.5 block size-5 rounded-full border border-black/10"
                  style={{ backgroundColor: option.swatch }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-medium">Text size</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby={textSizeGroupId}>
          <span id={textSizeGroupId} className="sr-only">
            Text size
          </span>
          {TEXT_SIZE_OPTIONS.map((option) => {
            const id = `${idPrefix}-text-size-${option.value}`
            const selected = textSize === option.value
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={`cursor-pointer rounded-lg border px-2 py-2 text-center font-semibold transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-edge bg-surface-muted text-foreground-muted hover:bg-surface-elevated'
                }`}
              >
                <input
                  type="radio"
                  id={id}
                  name={`${idPrefix}-text-size`}
                  value={option.value}
                  checked={selected}
                  onChange={() => setTextSize(option.value)}
                  className="sr-only"
                />
                <span aria-hidden="true" className={`block leading-none ${option.sample}`}>
                  Aa
                </span>
                <span className="mt-1 block text-xs">{option.label}</span>
              </label>
            )
          })}
        </div>
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
          Game cues and reactions on this device only. Slide to 0 to mute.
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

      {supportsVibration() && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <label htmlFor={vibrationId} className="text-foreground text-sm font-medium">
              Vibration
            </label>
            <p className="text-xs text-foreground-muted">A short buzz when a guess is right, wrong, or time runs out.</p>
          </div>
          <input
            type="checkbox"
            role="switch"
            id={vibrationId}
            checked={vibrationEnabled}
            onChange={(event) => {
              setVibrationEnabled(event.target.checked)
              if (event.target.checked) navigator.vibrate?.(30)
            }}
            className="mt-1 size-5 shrink-0 accent-primary"
          />
        </div>
      )}

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
