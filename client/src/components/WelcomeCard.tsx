import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { markWelcomeSeen, shouldShowWelcome } from '../lib/firstRun'

const POINTS = [
  { icon: 'chat_bubble', text: "I'll describe myself, one clue at a time." },
  { icon: 'bolt', text: 'Guess as soon as you think you know. Fewer clues, more points.' },
  { icon: 'groups', text: 'Play alone, pass one phone around, or race friends online.' },
]

export default function WelcomeCard() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    void shouldShowWelcome().then((show) => {
      if (!cancelled && show) setVisible(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!visible) return null

  return (
    <section
      aria-labelledby="welcome-card-title"
      className="relative mb-5 w-full max-w-md rounded-xl border border-white/20 bg-white/10 px-5 pb-5 pt-4 text-white backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => {
          markWelcomeSeen()
          setVisible(false)
        }}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full text-white/75 hover:bg-white/15 hover:text-white"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
      </button>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-300">New here?</p>
      <h2 id="welcome-card-title" className="mb-3 pr-8 text-[1.05rem] font-extrabold leading-snug">
        Someone from the Bible is describing themselves. Can you tell who?
      </h2>
      <ul className="mb-4 flex flex-col gap-2 text-sm font-medium text-white/90">
        {POINTS.map((point) => (
          <li key={point.icon} className="flex items-start gap-2.5">
            <span className="material-symbols-outlined shrink-0 text-xl text-amber-300" aria-hidden="true">
              {point.icon}
            </span>
            {point.text}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Link
          to="/solo"
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-300 px-3 py-3 text-sm font-bold text-amber-950 hover:bg-amber-200"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">play_arrow</span>
          Try a solo game
        </Link>
        <Link
          to="/about"
          className="whitespace-nowrap px-2 py-3 text-sm font-semibold text-white/85 underline underline-offset-[3px] hover:text-white"
        >
          How to play
        </Link>
      </div>
    </section>
  )
}
