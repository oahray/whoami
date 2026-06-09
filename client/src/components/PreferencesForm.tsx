import { usePreferences } from '../context/PreferencesContext'

type PreferencesFormProps = {
  idPrefix?: string
}

function PreferencesForm({ idPrefix = 'pref' }: PreferencesFormProps) {
  const { sfxEnabled, setSfxEnabled, reducedMotion, sfxAllowed } = usePreferences()
  const sfxId = `${idPrefix}-sfx-enabled`

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={sfxId}
          checked={sfxEnabled}
          onChange={(e) => setSfxEnabled(e.target.checked)}
          className="mt-1 rounded accent-primary"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={sfxId} className="text-slate-700 text-sm font-medium">
            Sound effects
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Plays on this device only. Other players keep their own setting.
          </p>
        </div>
      </div>

      {reducedMotion && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Sounds are off because <strong>Reduce motion</strong> is on in your system settings.
          {sfxEnabled && !sfxAllowed ? ' Your checkbox setting is saved for later.' : null}
        </p>
      )}

    </div>
  )
}

export default PreferencesForm
