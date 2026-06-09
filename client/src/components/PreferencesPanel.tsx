import PreferencesForm from './PreferencesForm'

type PreferencesPanelProps = {
  className?: string
}

/** Full-width card layout (tests and rare embedded use). Prefer PreferencesMenu in nav. */
function PreferencesPanel({ className = '' }: PreferencesPanelProps) {
  return (
    <section
      className={`bg-white rounded-lg p-5 shadow-sm border border-slate-200 ${className}`.trim()}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">tune</span>
        <h2 className="text-slate-900 text-lg font-bold tracking-tight">Your preferences</h2>
      </div>
      <PreferencesForm />
    </section>
  )
}

export default PreferencesPanel
