import { formatAppUrlForDisplay } from './exportLeaderboardPng'
import { paintNotarySeal, shareSealAnchor } from './exportShareSeal'
import { resolveAppOrigin, roundRect } from './exportSoloDailyPng'
import { formatSoloScore } from './soloSession'
import type { DailyExtras, ModeStats } from './soloStats'

const WIDTH = 1080
const PAD = 72
const HEADER_H = 300
const FRAME_INSET = 36
const TILE_H = 120
const TILE_GAP = 12
const BAR_ROW_H = 40
const FOOTER_BLOCK = 120

export type StatsShareMode = 'daily' | 'challenge' | 'endurance'

export type StatsShareInput = {
  mode: StatsShareMode
  stats: ModeStats
  daily?: DailyExtras
  /** First day counted, for "since ..." under the title. */
  firstDateKey?: string
  found: number
  mastered: number
  /** From describeSoloSetup; drawn as two lines so it never gets squeezed. */
  usualSetup?: { what: string; timing: string }
  appOrigin?: string
}

const TITLES: Record<StatsShareMode, string> = {
  daily: 'Daily stats',
  challenge: 'Classic stats',
  endurance: 'Endurance stats'
}

const percent = (value: number | null) => (value == null ? '—' : `${Math.round(value * 100)}%`)
const score = (value: number | null | undefined) => (value == null ? '—' : formatSoloScore(value))
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function soloStatsShareFileName(mode: StatsShareMode, todayKey: string): string {
  return `whoami-solo-${mode === 'challenge' ? 'classic' : mode}-stats-${todayKey}.png`
}

/** The six headline numbers and the small print, chosen per mode. No card names. */
export function statsShareContent(input: StatsShareInput): {
  tiles: Array<{ label: string; value: string }>
  notes: string[]
} {
  const { stats, daily } = input
  const learning = `${plural(input.found, 'card', 'cards')} found  ·  ${input.mastered} mastered`
  if (input.mode === 'daily') {
    return {
      tiles: [
        { label: 'PLAYED', value: String(stats.daysPlayed) },
        { label: 'STREAK', value: String(daily?.currentStreak ?? 0) },
        { label: 'BEST STREAK', value: String(daily?.bestStreak ?? 0) },
        { label: 'AVERAGE', value: score(stats.averageScore) },
        { label: 'BEST', value: score(stats.bestScore?.score) },
        { label: 'ON CLUE 1', value: percent(stats.firstClueRate) }
      ],
      notes: [
        `${plural(daily?.perfectDays ?? 0, 'perfect Daily', 'perfect Dailies')}  ·  ${percent(stats.accuracy)} of cards right`,
        learning
      ]
    }
  }
  if (input.mode === 'challenge') {
    return {
      tiles: [
        { label: 'RUNS', value: String(stats.runs) },
        { label: 'AVERAGE', value: score(stats.averageScore) },
        { label: 'BEST', value: score(stats.bestScore?.score) },
        { label: 'CARDS RIGHT', value: percent(stats.accuracy) },
        { label: 'ON CLUE 1', value: percent(stats.firstClueRate) },
        { label: 'CLUES / CARD', value: stats.averageClues == null ? '—' : stats.averageClues.toFixed(1) }
      ],
      notes: [...setupNotes(input), learning]
    }
  }
  return {
    tiles: [
      { label: 'RUNS', value: String(stats.runs) },
      { label: 'LONGEST RUN', value: String(stats.longestRun) },
      { label: 'AVERAGE RUN', value: stats.averageRunLength == null ? '—' : stats.averageRunLength.toFixed(1) },
      { label: 'BEST SCORE', value: score(stats.bestScore?.score) },
      { label: 'ON CLUE 1', value: percent(stats.firstClueRate) },
      { label: 'CLUES / CARD', value: stats.averageClues == null ? '—' : stats.averageClues.toFixed(1) }
    ],
    notes: [...setupNotes(input), learning]
  }
}

function setupNotes(input: StatsShareInput): string[] {
  return input.usualSetup ? [`Usual setup: ${input.usualSetup.what}`, input.usualSetup.timing] : []
}

function sinceLine(input: StatsShareInput): string {
  const count =
    input.mode === 'daily'
      ? plural(input.stats.daysPlayed, 'Daily', 'Dailies')
      : plural(input.stats.runs, 'run', 'runs')
  if (!input.firstDateKey) return count
  const since = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${input.firstDateKey}T00:00:00Z`)
  )
  return `${count} since ${since}`
}

/** Shareable stats card in the same night-ledger style as the Daily result. */
export async function exportSoloStatsPng(input: StatsShareInput): Promise<Blob> {
  const appUrlDisplay = formatAppUrlForDisplay(resolveAppOrigin(input.appOrigin))
  const { tiles, notes } = statsShareContent(input)
  const bars = input.stats.solvedOnClue

  const tilesTop = HEADER_H + 8
  const tilesBottom = tilesTop + TILE_H * 2 + TILE_GAP
  const notesTop = tilesBottom + 48
  const barsTitleY = notesTop + notes.length * 38 + 30
  const barsTop = barsTitleY + 24
  const barsBottom = barsTop + Math.max(1, bars.length) * BAR_ROW_H
  const height = Math.ceil(barsBottom + 24 + FOOTER_BLOCK + FRAME_INSET)
  const seal = shareSealAnchor(WIDTH, FRAME_INSET)
  const headerMaxWidth = Math.max(240, seal.textMaxX - PAD)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.fillStyle = '#0a1228'
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  roundRect(ctx, FRAME_INSET, FRAME_INSET, WIDTH - FRAME_INSET * 2, height - FRAME_INSET * 2, 28)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#5eead4'
  ctx.font = '700 28px Inter, system-ui, sans-serif'
  ctx.fillText('WHO AM I?', PAD, 100, headerMaxWidth)
  ctx.fillStyle = '#f3efe6'
  ctx.font = '800 64px Inter, system-ui, sans-serif'
  ctx.fillText(TITLES[input.mode], PAD, 172, headerMaxWidth)
  ctx.fillStyle = 'rgba(243,239,230,0.62)'
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillText(sinceLine(input), PAD, 220, headerMaxWidth)

  paintNotarySeal(ctx, { cx: seal.x, cy: seal.y, radius: seal.radius, line1: 'SOLO', line2: 'STATS', accent: 'teal' })

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, HEADER_H - 36)
  ctx.lineTo(WIDTH - PAD, HEADER_H - 36)
  ctx.stroke()

  const tileW = (WIDTH - PAD * 2 - TILE_GAP * 2) / 3
  tiles.forEach((tile, index) => {
    const x = PAD + (index % 3) * (tileW + TILE_GAP)
    const y = tilesTop + Math.floor(index / 3) * (TILE_H + TILE_GAP)
    roundRect(ctx, x, y, tileW, TILE_H, 18)
    ctx.fillStyle = index === 0 ? '#0f2f35' : '#121a2e'
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(243,239,230,0.45)'
    ctx.font = '700 18px Inter, system-ui, sans-serif'
    ctx.fillText(tile.label, x + tileW / 2, y + 36, tileW - 24)
    ctx.fillStyle = index === 0 ? '#5eead4' : '#f3efe6'
    ctx.font = '800 44px Inter, system-ui, sans-serif'
    ctx.fillText(tile.value, x + tileW / 2, y + 80, tileW - 24)
  })

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(243,239,230,0.7)'
  ctx.font = '500 26px Inter, system-ui, sans-serif'
  notes.forEach((note, index) => ctx.fillText(note, PAD, notesTop + index * 38, WIDTH - PAD * 2))

  ctx.fillStyle = 'rgba(243,239,230,0.55)'
  ctx.font = '600 22px Inter, system-ui, sans-serif'
  ctx.fillText('Cards solved on each clue', PAD, barsTitleY)
  const max = Math.max(1, ...bars)
  const labelW = 110
  const countW = 80
  const trackW = WIDTH - PAD * 2 - labelW - countW
  bars.forEach((count, index) => {
    const y = barsTop + index * BAR_ROW_H
    ctx.fillStyle = 'rgba(243,239,230,0.6)'
    ctx.font = '500 22px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Clue ${index + 1}`, PAD, y + BAR_ROW_H / 2)
    roundRect(ctx, PAD + labelW, y + 10, trackW, BAR_ROW_H - 20, 8)
    ctx.fillStyle = '#121a2e'
    ctx.fill()
    if (count > 0) {
      roundRect(ctx, PAD + labelW, y + 10, Math.max(16, (count / max) * trackW), BAR_ROW_H - 20, 8)
      // Clue 1 in the gold of the Daily card's first-clue stars.
      ctx.fillStyle = index === 0 ? '#e8b84a' : '#5eead4'
      ctx.fill()
    }
    ctx.fillStyle = '#f3efe6'
    ctx.font = '700 22px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(count), WIDTH - PAD, y + BAR_ROW_H / 2)
  })

  const frameBottom = height - FRAME_INSET
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(243,239,230,0.4)'
  ctx.font = '500 22px Inter, system-ui, sans-serif'
  ctx.fillText('Solo stats  ·  Who Am I?', WIDTH / 2, frameBottom - 68)
  if (appUrlDisplay) {
    ctx.fillStyle = '#5eead4'
    ctx.font = '700 26px Inter, system-ui, sans-serif'
    ctx.fillText(appUrlDisplay, WIDTH / 2, frameBottom - 36)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode PNG'))), 'image/png')
  })
}

/** Share sheet where files can be shared, a download everywhere else. */
export async function shareOrDownloadSoloStatsPng(
  input: StatsShareInput,
  todayKey: string
): Promise<'shared' | 'downloaded'> {
  const appOrigin = resolveAppOrigin(input.appOrigin)
  const blob = await exportSoloStatsPng({ ...input, appOrigin })
  const fileName = soloStatsShareFileName(input.mode, todayKey)
  const file = new File([blob], fileName, { type: 'image/png' })
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    const displayUrl = formatAppUrlForDisplay(appOrigin)
    await navigator.share({
      files: [file],
      title: `Who Am I: ${TITLES[input.mode]}`,
      text: displayUrl ? `My Solo ${TITLES[input.mode].toLowerCase()} · Play at ${displayUrl}` : `My Solo ${TITLES[input.mode].toLowerCase()}`
    })
    return 'shared'
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
