import { Link } from 'react-router-dom'
import PreferencesMenu from '../components/PreferencesMenu'

function NotFound() {
  return (
    <div className="min-h-screen bg-app-bg font-display text-foreground antialiased">
      <header className="sticky top-0 z-10 border-b border-edge bg-surface/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-elevated"
            aria-label="Back to home"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="min-w-0 flex-1 text-lg font-bold tracking-tight">Page not found</h1>
          <PreferencesMenu />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-12">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">explore_off</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">This page doesn&apos;t exist</h2>
              <p className="text-foreground-muted text-sm">Error 404</p>
            </div>
          </div>
          <p className="text-foreground leading-relaxed">
            That URL doesn&apos;t match a page in Who Am I? You may have followed an old link, or
            typed an address that was never here.
          </p>
        </section>

        <p className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Back to home
          </Link>
        </p>
      </main>
    </div>
  )
}

export default NotFound
