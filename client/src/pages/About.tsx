import { Link } from 'react-router-dom'

function About() {
  return (
    <div className="min-h-screen bg-background-light font-display text-slate-900 antialiased">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
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
              <h2 className="text-xl font-bold text-slate-900">Who Am I?</h2>
              <p className="text-slate-600 text-sm">Bible character &amp; place guessing</p>
            </div>
          </div>
          <p className="text-slate-700 leading-relaxed">
            A real-time quiz game in the classic &quot;Who am I?&quot; style. Clues describe a biblical
            character or place; players guess the answer. The host reveals clues over time — quicker
            guesses earn more points when you play online.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">wifi</span>
            <h2 className="text-lg font-bold text-slate-900">Play online</h2>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-slate-700 text-sm leading-relaxed">
            <li>Enter a nickname on the home screen.</li>
            <li>
              <strong>Create a room</strong> or <strong>join</strong> with a 6-character room code
              (share the code or link with friends).
            </li>
            <li>In the lobby, the host sets rounds, timer, clue interval, difficulty, and content.</li>
            <li>When the game starts, everyone sees the same clues as they are revealed.</li>
            <li>Type guesses on your own device; correct answers lock you in and add to your score.</li>
          </ol>
          <p className="text-slate-600 text-xs">
            You need an internet connection and the game server for online play.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">groups</span>
            <h2 className="text-lg font-bold text-slate-900">Play in person</h2>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">
            No room code and no scoring on the server — one person holds the phone and reads clues aloud
            while everyone else guesses in the room. The app loads the same published clue content from
            our database whenever you are online.
          </p>
          <p className="text-slate-600 text-xs">
            In-person mode is coming soon from the home screen.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">install_mobile</span>
            <h2 className="text-lg font-bold text-slate-900">Install the app</h2>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">
            Who Am I? can be installed on your phone or tablet for quick access, like a native app.
          </p>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <p className="font-semibold text-slate-900">Android (Chrome)</p>
              <p className="mt-1 text-slate-600">
                Open the site in Chrome and use <span className="font-medium">Install app</span> or{' '}
                <span className="font-medium">Add to Home screen</span> when your browser offers it.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <p className="font-semibold text-slate-900">iPhone / iPad (Safari)</p>
              <p className="mt-1 text-slate-600">
                Tap <span className="font-medium">Share</span> in the toolbar, then{' '}
                <span className="font-medium">Add to Home Screen</span>. Safari does not show an
                automatic install banner — that step is always manual.
              </p>
            </div>
          </div>
          <p className="text-slate-600 text-xs">
            Installing caches the app shell for faster launch. Gameplay still needs internet to load
            rooms and clues.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">menu_book</span>
            <h2 className="text-lg font-bold text-slate-900">Content</h2>
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">
            Clues in the default game category (Bible characters and places) are written in first person and tied to Scripture.
            Most clues include citation references for study. The host can choose which content set (dataset) to use when several
            are available in the lobby.
          </p>
          <p className="text-slate-700 text-sm leading-relaxed">
            Nicknames are not accounts — they are only used for the current session in a room. No
            password is required to play.
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
