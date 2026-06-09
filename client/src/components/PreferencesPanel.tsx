import { usePreferences } from '../context/PreferencesContext'

type PreferencesPanelProps = {
  className?: string
}

function PreferencesPanel({ className = '' }: PreferencesPanelProps) {
  const { sfxEnabled, setSfxEnabled, reducedMotion, sfxAllowed } = usePreferences()

  return (
    <section
      className={`bg-white rounded-lg p-5 shadow-sm border border-slate-200 ${className}`.trim()}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">tune</span>
        <h2 className="text-slate-900 text-lg font-bold tracking-tight">Your preferences</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="pref-sfx-enabled"
            checked={sfxEnabled}
            onChange={(e) => setSfxEnabled(e.target.checked)}
            className="mt-1 rounded accent-primary"
          />
          <div className="min-w-0 flex-1">
            <label htmlFor="pref-sfx-enabled" className="text-slate-700 text-sm font-medium">
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
    </section>
  )
}

export default PreferencesPanel
