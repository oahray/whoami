import { useState } from 'react'
import PlayerAvatar from './PlayerAvatar'
import { downloadLeaderboardPng, shareLeaderboardPng } from '../lib/exportLeaderboardPng'
import {
  formatGameEndedAt,
  formatGameEndedAtFull,
  formatGameHistorySettings,
  viewerStandingLabel,
  winnerLabel,
  type GameHistoryEntry
} from '../lib/gameHistory'

function rankScoreboard(scoreboard: GameHistoryEntry['scoreboard']) {
  const sorted = [...scoreboard].sort((a, b) => b.score - a.score)
  let currentRank = 0
  let lastScore: number | undefined
  const staged = sorted.map((item, idx) => {
    if (item.score !== lastScore) {
      currentRank = idx + 1
      lastScore = item.score
    }
    return { ...item, rank: currentRank }
  })
  const counts = new Map<number, number>()
  for (const row of staged) counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1)
  return staged.map((row) => ({ ...row, tied: (counts.get(row.rank) ?? 1) > 1 }))
}

type GameHistoryPanelProps = {
  roomCode: string
  history: GameHistoryEntry[]
  /** Optional: highlight / auto-open this entry (e.g. just-finished game). */
  initialEntryId?: string | null
  compact?: boolean
  /**
   * `accordion` — collapsible card (option 1).
   * `plain` — content only for embedding in a sheet (option 2).
   */
  variant?: 'accordion' | 'plain'
  /** Accordion only: start expanded. Default collapsed. */
  defaultOpen?: boolean
}

export default function GameHistoryPanel({
  roomCode,
  history,
  initialEntryId = null,
  compact = false,
  variant = 'accordion',
  defaultOpen = false
}: GameHistoryPanelProps) {
  const newestFirst = [...history].reverse()
  const isPlain = variant === 'plain'
  const [open, setOpen] = useState(isPlain || defaultOpen)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEntryId ?? (newestFirst[0]?.id ?? null)
  )
  const [exportState, setExportState] = useState<'idle' | 'working' | 'downloaded' | 'error'>('idle')
  const [shareState, setShareState] = useState<'idle' | 'working' | 'shared' | 'error'>('idle')
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  if (newestFirst.length === 0) return null

  const selected = newestFirst.find((entry) => entry.id === selectedId) ?? newestFirst[0]!
  const ranked = rankScoreboard(selected.scoreboard)
  const settings = formatGameHistorySettings(selected)
  const metaLine = [
    formatGameEndedAtFull(selected.endedAt),
    settings.difficulty,
    `${settings.roundTime}/round`,
    `clues ${settings.clueInterval}`
  ].join('  ·  ')

  const exportRoomCode = selected.roomCode || roomCode

  const handleDownload = () => {
    setExportState('working')
    void downloadLeaderboardPng({ roomCode: exportRoomCode, entry: selected })
      .then(() => {
        setExportState('downloaded')
        window.setTimeout(() => setExportState('idle'), 2200)
      })
      .catch((err) => {
        console.warn('Leaderboard download failed:', err)
        setExportState('error')
        window.setTimeout(() => setExportState('idle'), 2200)
      })
  }

  const handleShare = () => {
    setShareState('working')
    void shareLeaderboardPng({ roomCode: exportRoomCode, entry: selected })
      .then(() => {
        setShareState('shared')
        window.setTimeout(() => setShareState('idle'), 2200)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          setShareState('idle')
          return
        }
        console.warn('Leaderboard share failed:', err)
        setShareState('error')
        window.setTimeout(() => setShareState('idle'), 2200)
      })
  }

  const body = (
    <div className={isPlain ? undefined : 'mt-4'}>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {newestFirst.map((entry) => {
          const active = entry.id === selected.id
          const standing = viewerStandingLabel(entry.scoreboard, entry.viewerPlayerId)
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-edge bg-surface-muted/60 hover:bg-surface-muted'
              }`}
            >
              <div className={`text-sm font-bold ${active ? 'text-primary' : 'text-foreground'}`}>
                {entry.roomCode ? entry.roomCode : `Game ${entry.gameNumber}`}
              </div>
              <div className="text-[11px] text-foreground-muted">{formatGameEndedAt(entry.endedAt)}</div>
              {standing ? (
                <div className="text-[11px] text-foreground-muted">{standing}</div>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="mt-3 rounded-xl border border-edge bg-surface-muted p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-lg font-black truncate text-foreground">
              {selected.roomCode ? `Room ${selected.roomCode}` : `Game ${selected.gameNumber}`}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5 truncate">
              {winnerLabel(selected.scoreboard)} · {selected.totalRounds} rounds
            </p>
            <p className="text-[11px] text-foreground-muted mt-1 leading-snug">{metaLine}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={exportState === 'working'}
              title={
                exportState === 'working'
                  ? 'Saving…'
                  : exportState === 'downloaded'
                    ? 'Saved!'
                    : exportState === 'error'
                      ? 'Failed'
                      : 'Download image'
              }
              aria-label="Download leaderboard image"
              className="flex size-10 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition-colors md:size-auto md:px-3 md:py-2 md:rounded-lg md:gap-1.5 md:text-xs md:font-bold"
            >
              <span className="material-symbols-outlined text-xl md:text-base">
                {exportState === 'working'
                  ? 'hourglass_top'
                  : exportState === 'downloaded'
                    ? 'check'
                    : exportState === 'error'
                      ? 'error'
                      : 'download'}
              </span>
              <span className="hidden md:inline">
                {exportState === 'working'
                  ? 'Saving…'
                  : exportState === 'downloaded'
                    ? 'Saved!'
                    : exportState === 'error'
                      ? 'Failed'
                      : 'Download'}
              </span>
            </button>
            {canShareFiles && (
              <button
                type="button"
                onClick={handleShare}
                disabled={shareState === 'working'}
                title={
                  shareState === 'working'
                    ? 'Sharing…'
                    : shareState === 'shared'
                      ? 'Shared!'
                      : shareState === 'error'
                        ? 'Failed'
                        : 'Share image'
                }
                aria-label="Share leaderboard image"
                className="flex size-10 items-center justify-center rounded-full border border-edge bg-surface text-foreground hover:bg-surface-elevated disabled:opacity-60 transition-colors md:size-auto md:px-3 md:py-2 md:rounded-lg md:gap-1.5 md:text-xs md:font-bold"
              >
                <span className="material-symbols-outlined text-xl md:text-base">
                  {shareState === 'working'
                    ? 'hourglass_top'
                    : shareState === 'shared'
                      ? 'check'
                      : shareState === 'error'
                        ? 'error'
                        : 'share'}
                </span>
                <span className="hidden md:inline">
                  {shareState === 'working'
                    ? 'Sharing…'
                    : shareState === 'shared'
                      ? 'Shared!'
                      : shareState === 'error'
                        ? 'Failed'
                        : 'Share'}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 max-h-[min(18rem,40vh)] overflow-y-auto pr-1">
          {ranked.map((player) => {
            const isYou = Boolean(
              selected.viewerPlayerId && player.playerId === selected.viewerPlayerId
            )
            return (
              <div
                key={`${selected.id}-${player.playerId}`}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${
                  player.rank === 1 && player.score > 0
                    ? 'bg-amber-400/15 border border-amber-400/30'
                    : 'bg-surface border border-edge'
                }`}
              >
                <span className="w-7 text-center text-xs font-black text-foreground-muted">#{player.rank}</span>
                <PlayerAvatar
                  avatarId={player.avatarId}
                  nickname={player.nickname}
                  sizeClassName="size-8"
                  className="border border-edge"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {player.nickname}
                  {isYou ? (
                    <span className="text-foreground-muted font-medium"> (You)</span>
                  ) : null}
                  {player.tied && player.score > 0 ? (
                    <span className="text-foreground-muted font-medium"> · tied</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-black tabular-nums text-foreground">{player.score}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  if (isPlain) {
    return body
  }

  return (
    <section className={`bg-surface rounded-lg shadow-sm border border-edge ${compact ? 'p-3' : 'p-4'}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="text-foreground text-lg font-bold tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            Past Games
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {newestFirst.length}
            </span>
          </span>
          {!open && (
            <span className="block text-foreground-muted text-xs mt-0.5 truncate">
              Latest: Game {newestFirst[0]!.gameNumber} · {winnerLabel(newestFirst[0]!.scoreboard)}
            </span>
          )}
        </span>
        <span
          className={`material-symbols-outlined shrink-0 text-foreground-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {open && body}
    </section>
  )
}
