import { usePreferences } from '../context/PreferencesContext'
import { unlockAudio } from '../lib/sounds'
import type { ThemeMode } from '../lib/preferences'

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
    sfxEnabled,
    setSfxEnabled,
    musicEnabled,
    setMusicEnabled,
    reducedMotion,
    sfxAllowed,
    theme,
    setTheme
  } = usePreferences()
  const sfxId = `${idPrefix}-sfx-enabled`
  const musicId = `${idPrefix}-music-enabled`
  const themeGroupId = `${idPrefix}-theme`

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

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={sfxId}
          checked={sfxEnabled}
          onChange={(e) => {
            if (e.target.checked) unlockAudio()
            setSfxEnabled(e.target.checked)
          }}
          className="mt-1 rounded accent-primary"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={sfxId} className="text-foreground text-sm font-medium">
            Sound effects
          </label>
          <p className="text-xs text-foreground-muted mt-0.5">
            Game cues and reactions on this device only.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={musicId}
          checked={musicEnabled}
          onChange={(e) => setMusicEnabled(e.target.checked)}
          className="mt-1 rounded accent-primary"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={musicId} className="text-foreground text-sm font-medium">
            Music
          </label>
          <p className="text-xs text-foreground-muted mt-0.5">
            Soft theme on lobby and setup screens. Separate from sound effects.
          </p>
        </div>
      </div>

      {reducedMotion && (
        <p className="text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Sounds and music are off because <strong>Reduce motion</strong> is on in your system
          settings.
          {sfxEnabled && !sfxAllowed ? ' Your checkbox settings are saved for later.' : null}
        </p>
      )}
    </div>
  )
}

export default PreferencesForm
