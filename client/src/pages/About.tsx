import { Link } from 'react-router-dom'

function About() {
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
          <h1 className="text-lg font-bold tracking-tight">About</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-12 space-y-8">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">auto_stories</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Who Am I?</h2>
              <p className="text-foreground-muted text-sm">Bible character &amp; place guessing</p>
            </div>
          </div>
          <p className="text-foreground leading-relaxed">
            A real-time quiz game in the classic &quot;Who am I?&quot; style. Clues describe a biblical
            character or place; players guess the answer. The host reveals clues over time. Quicker
            guesses earn more points when you play online.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">wifi</span>
            <h2 className="text-lg font-bold text-foreground">Play online</h2>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-foreground text-sm leading-relaxed">
            <li>Enter a nickname on the home screen.</li>
            <li>
              <strong>Create a room</strong> or <strong>join</strong> with a 6-character room code
              (share the code or link with friends).
            </li>
            <li>In the lobby, the host sets rounds, timer, clue interval, difficulty, and content.</li>
            <li>When the game starts, everyone sees the same clues as they are revealed.</li>
            <li>Type guesses on your own device; correct answers lock you in and add to your score.</li>
          </ol>
          <p className="text-foreground-muted text-xs">
            You need an internet connection and the game server for online play.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">groups</span>
            <h2 className="text-lg font-bold text-foreground">Play in person</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            No room code and no scoring on the server. One person holds the phone and reads clues aloud
            while everyone else guesses in the room. The app loads published clue content from our
            database when you are online.
          </p>
          <p className="text-foreground-muted text-xs">
            <Link to="/play" className="text-primary font-semibold hover:text-primary/80">
              Start in-person mode
            </Link>{' '}
            from the home screen. No room code needed.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">install_mobile</span>
            <h2 className="text-lg font-bold text-foreground">Install the app</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Who Am I? can be installed on your phone or tablet for quick access, like a native app.
          </p>
          <div className="space-y-3 text-sm text-foreground">
            <div className="rounded-lg bg-surface-muted border border-edge p-3">
              <p className="font-semibold text-foreground">Android (Chrome)</p>
              <p className="mt-1 text-foreground-muted">
                Open the site in Chrome and use <span className="font-medium">Install app</span> or{' '}
                <span className="font-medium">Add to Home screen</span> when your browser offers it.
              </p>
            </div>
            <div className="rounded-lg bg-surface-muted border border-edge p-3">
              <p className="font-semibold text-foreground">iPhone / iPad (Safari)</p>
              <p className="mt-1 text-foreground-muted">
                Tap <span className="font-medium">Share</span> in the toolbar, then{' '}
                <span className="font-medium">Add to Home Screen</span>. Safari does not show an
                automatic install banner, so you add it from Share every time.
              </p>
            </div>
          </div>
          <p className="text-foreground-muted text-xs">
            Installing caches the app shell for faster launch. Gameplay still needs internet to load
            rooms and clues.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">menu_book</span>
            <h2 className="text-lg font-bold text-foreground">Content</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Clues in the default game category (Bible characters and places) are written in first person and tied to Scripture.
            Most clues include citation references for study. The host can choose which content set (dataset) to use when several
            are available in the lobby.
          </p>
          <p className="text-foreground text-sm leading-relaxed">
            Nicknames are not accounts. They only identify you in the current room. No password is
            required to play.
          </p>
        </section>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:text-primary/80"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}

export default About
