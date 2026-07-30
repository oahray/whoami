import { Link } from 'react-router-dom'
import FeedbackLink from '../components/FeedbackLink'
import PreferencesMenu from '../components/PreferencesMenu'
import { isFeedbackConfigured } from '../lib/feedback'

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
          <h1 className="min-w-0 flex-1 text-lg font-bold tracking-tight">About</h1>
          <PreferencesMenu />
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
            A quiz game in the classic &quot;Who am I?&quot; style. Clues describe a biblical character
            or place; you guess the answer. Play solo on your device, pass one phone around, or join
            friends online where clues appear for everyone and quicker correct guesses score more.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span>
            <h2 className="text-lg font-bold text-foreground">Solo mode</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Play on your own and keep personal bests on this device. Choose a{' '}
            <strong>10-round Solo challenge</strong> for accuracy and time, or{' '}
            <strong>Endurance</strong> to see how long your streak lasts. Pick difficulty tiers,
            card type, and timers before you start. After each round you can review citations for the
            clues you saw.
          </p>
          <p className="text-foreground-muted text-xs">
            <Link to="/solo" className="text-primary font-semibold hover:text-primary/80">
              Start solo mode
            </Link>{' '}
            from the home screen. No room code needed.
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
              (share the code or invite link with friends).
            </li>
            <li>
              In the lobby, the host sets rounds, timers, difficulty mix, card type, and content.
            </li>
            <li>When the game starts, everyone sees the same clues as they are revealed.</li>
            <li>Type guesses on your own device; correct answers lock you in and add to your score.</li>
          </ol>
          <p className="text-foreground text-sm leading-relaxed">
            To keep games comfortable for everyone, you can <strong>leave a lobby or live game at any
            time</strong>. The host can also <strong>kick a player</strong> out of the room if needed.
          </p>
          <p className="text-foreground-muted text-xs">
            You need an internet connection and the game server for online play.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">groups</span>
            <h2 className="text-lg font-bold text-foreground">Pass &amp; play</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            No room code and no scoring on the server. One person holds the phone and reads clues aloud
            while everyone else guesses together. Choose content, card type, and difficulty mix, then
            step through cards at your own pace. Citations appear when you reveal the answer.
          </p>
          <p className="text-foreground-muted text-xs">
            <Link to="/play" className="text-primary font-semibold hover:text-primary/80">
              Start pass &amp; play
            </Link>{' '}
            from the home screen. Internet is needed to load cards.
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
            Clues in the default content set (Bible characters and places) are written in first person
            and tied to Scripture. Most clues include citation references for study. When more than one
            content set is published, you can choose which to use in setup or in the lobby.
          </p>
          <p className="text-foreground text-sm leading-relaxed">
            Nicknames are not accounts. They only identify you in the current room. No password is
            required to play.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">face</span>
            <h2 className="text-lg font-bold text-foreground">Credits</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Player avatars use the{' '}
            <a
              href="https://www.dicebear.com/styles/adventurer-neutral/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:text-primary/80"
            >
              Adventurer Neutral
            </a>{' '}
            style from DiceBear, a remix of{' '}
            <a
              href="https://www.figma.com/community/file/1184595184137881796"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:text-primary/80"
            >
              Adventurer Neutral
            </a>{' '}
            by{' '}
            <a
              href="https://www.instagram.com/lischi_art/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:text-primary/80"
            >
              Lisa Wischofsky
            </a>
            , licensed under{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold hover:text-primary/80"
            >
              CC BY 4.0
            </a>
            .
          </p>
        </section>

        {isFeedbackConfigured() ? (
          <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">rate_review</span>
              <h2 className="text-lg font-bold text-foreground">Feedback</h2>
            </div>
            <p className="text-foreground text-sm leading-relaxed">
              Spotted a problem or have an idea? Send anonymous feedback. No name or email required.
              It opens a short Google Form and is not stored on the game servers.
            </p>
            <FeedbackLink className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:text-primary/80">
              <span className="material-symbols-outlined text-lg" aria-hidden>
                open_in_new
              </span>
              Send feedback
            </FeedbackLink>
          </section>
        ) : (
          <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">rate_review</span>
              <h2 className="text-lg font-bold text-foreground">Feedback</h2>
            </div>
            <p className="text-foreground text-sm leading-relaxed">
              You will be able to report issues and share feedback shortly.
            </p>
          </section>
        )}

        <div className="pt-2 flex flex-wrap gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:text-primary/80"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              home
            </span>
            Back to home
          </Link>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:text-primary/80"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              privacy_tip
            </span>
            Privacy
          </Link>
          <FeedbackLink className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:text-primary/80">
            <span className="material-symbols-outlined text-lg" aria-hidden>
              rate_review
            </span>
            Feedback
          </FeedbackLink>
        </div>
      </main>
    </div>
  )
}

export default About
