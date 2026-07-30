import { Link } from 'react-router-dom'
import FeedbackLink from '../components/FeedbackLink'
import PreferencesMenu from '../components/PreferencesMenu'
import { isFeedbackConfigured } from '../lib/feedback'

function Privacy() {
  const feedbackReady = isFeedbackConfigured()

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
          <h1 className="min-w-0 flex-1 text-lg font-bold tracking-tight">Privacy</h1>
          <PreferencesMenu />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-12 space-y-8">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">privacy_tip</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Privacy policy</h2>
              <p className="text-foreground-muted text-sm">Last updated: 29 July 2026</p>
            </div>
          </div>
          <p className="text-foreground leading-relaxed">
            Who Am I? is a Bible character and place guessing game. This page explains what information
            the app uses, where it lives, and what we do not collect. Player accounts are not required
            to play.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span>
            <h2 className="text-lg font-bold text-foreground">What we collect</h2>
          </div>
          <ul className="list-disc list-inside space-y-2 text-foreground text-sm leading-relaxed">
            <li>
              <strong>Nickname:</strong> an optional display name for online rooms. It is not a login
              and is not tied to an email or password for players.
            </li>
            <li>
              <strong>Room and game activity:</strong> room codes, lobby settings, guesses, scores, and
              connection status while an online game is in progress on our game server.
            </li>
            <li>
              <strong>Technical connection data:</strong> our hosting and game server may see IP
              address, browser details, and similar request metadata needed to run the service and keep
              it secure.
            </li>
            <li>
              <strong>Published game content:</strong> datasets, entities, and clues are loaded from our
              database when you play online, solo, or pass &amp; play.
            </li>
          </ul>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">smartphone</span>
            <h2 className="text-lg font-bold text-foreground">Stored on your device</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Some preferences and progress stay in your browser storage on this device only:
          </p>
          <ul className="list-disc list-inside space-y-2 text-foreground text-sm leading-relaxed">
            <li>Nickname reminder and last online room reconnect details</li>
            <li>Sound effects, music, and appearance preferences</li>
            <li>Solo setup choices, in-progress solo session, and personal bests</li>
            <li>Pass &amp; play setup choices and the current card deck for that session</li>
            <li>Optional install-hint dismissals for the mobile app shell</li>
          </ul>
          <p className="text-foreground-muted text-xs leading-relaxed">
            Clearing site data in your browser removes this local information. Solo personal bests are
            not synced to our servers.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">cloud</span>
            <h2 className="text-lg font-bold text-foreground">How we use information</h2>
          </div>
          <ul className="list-disc list-inside space-y-2 text-foreground text-sm leading-relaxed">
            <li>To run online rooms, reveal clues, and show scores</li>
            <li>To load clue content for solo and pass &amp; play</li>
            <li>To remember your preferences and reconnect you to a room on this device</li>
            <li>To operate, secure, and maintain the service, including scheduled maintenance</li>
          </ul>
          <p className="text-foreground text-sm leading-relaxed">
            We do not sell your personal information. We do not use player nicknames or guesses for
            advertising profiles.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">schedule</span>
            <h2 className="text-lg font-bold text-foreground">How long things last</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Online room state is temporary and exists to support the current game session. Device
            preferences and solo records remain until you clear them or clear site data. If you install
            Who Am I? as an app, your browser may also cache the app shell for faster launch. Gameplay
            still needs an internet connection to load rooms and clues.
          </p>
        </section>

        <section
          className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3"
          aria-labelledby="privacy-children"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl" aria-hidden>
              children
            </span>
            <h2 id="privacy-children" className="sr-only">
              Children
            </h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            Who Am I? is meant as a family-friendly Bible quiz. We do not knowingly collect personal
            information from children beyond what is needed to play, such as a nickname in a room. If
            you believe a child has provided information that should be removed from a live session,
            leave the room or ask the host to end the game.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">update</span>
            <h2 className="text-lg font-bold text-foreground">Changes</h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed">
            We may update this policy as the app changes. The &quot;Last updated&quot; date at the top
            will change when we do.
          </p>
        </section>

        <section className="bg-surface rounded-lg border border-edge shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">mail</span>
            <h2 className="text-lg font-bold text-foreground">Feedback</h2>
          </div>
          {feedbackReady ? (
            <p className="text-foreground text-sm leading-relaxed">
              You can report issues and share feedback anonymously through the feedback form. No name
              or email is required, and submissions are not stored on the game servers.
            </p>
          ) : (
            <p className="text-foreground text-sm leading-relaxed">
              You will be able to report issues and share feedback shortly.
            </p>
          )}
          <p className="text-foreground-muted text-xs">
            See also{' '}
            <Link to="/about" className="text-primary font-semibold hover:text-primary/80">
              About
            </Link>{' '}
            for how the game works.
          </p>
        </section>

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
            to="/about"
            className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:text-primary/80"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden>
              info
            </span>
            About
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

export default Privacy
