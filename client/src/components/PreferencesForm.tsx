import { usePreferences } from '../context/PreferencesContext'
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
  const { sfxEnabled, setSfxEnabled, reducedMotion, sfxAllowed, theme, setTheme } = usePreferences()
  const sfxId = `${idPrefix}-sfx-enabled`
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
          onChange={(e) => setSfxEnabled(e.target.checked)}
          className="mt-1 rounded accent-primary"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={sfxId} className="text-foreground text-sm font-medium">
            Sound effects
          </label>
          <p className="text-xs text-foreground-muted mt-0.5">
            Plays on this device only. Other players keep their own setting.
          </p>
        </div>
      </div>

      {reducedMotion && (
        <p className="text-xs text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Sounds are off because <strong>Reduce motion</strong> is on in your system settings.
          {sfxEnabled && !sfxAllowed ? ' Your checkbox setting is saved for later.' : null}
        </p>
      )}
    </div>
  )
}

export default PreferencesForm
