import { formatAppUrlForDisplay } from './exportLeaderboardPng'
import { paintNotarySeal, shareSealAnchor } from './exportShareSeal'
import { formatSoloScore, type SoloRecord, type SoloRoundPerformance } from './soloSession'

const WIDTH = 1080
const PAD = 72
const HEADER_H = 320
const FRAME_INSET = 36
const STAT_CARD_H = 120
const FOOTER_BLOCK = 120

export type SoloRoundEfficiencyTone = 'first' | 'early' | 'late' | 'miss'

export type SoloDailyShareInput = {
  dateKey: string
  datasetName?: string
  record: SoloRecord
  currentStreak: number
  bestStreak?: number
  /** App origin for the footer CTA. Defaults to `window.location.origin`. */
  appOrigin?: string
}

/** Spoiler-free efficiency band from a settled round (no names/answers). */
export function soloRoundEfficiencyTone(
  round: Pick<SoloRoundPerformance, 'correct' | 'revealedClueCount'>
): SoloRoundEfficiencyTone {
  if (!round.correct) return 'miss'
  if (round.revealedClueCount <= 1) return 'first'
  if (round.revealedClueCount <= 3) return 'early'
  return 'late'
}

/** Medal fills: first clue / early / late. Misses stay outline-only. */
const TONE_FILL: Record<Exclude<SoloRoundEfficiencyTone, 'miss'>, string> = {
  first: '#e8b84a',
  early: '#9aa7bd',
  late: '#c47a4a'
}

export function soloDailyShareFileName(dateKey: string): string {
  return `whoami-solo-daily-${dateKey}.png`
}

export function formatSoloDailyShareDate(dateKey: string): string {
  const parsed = Date.parse(`${dateKey}T00:00:00Z`)
  if (Number.isNaN(parsed)) return 'Daily challenge'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(new Date(parsed))
}

function fillStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number
) {
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outerR : innerR
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function resolveAppOrigin(origin?: string): string {
  if (origin) return origin.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** Flat ink field — no pattern or wash for now. */
function paintPlainInkField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.fillStyle = '#0a1228'
  ctx.fillRect(0, 0, width, height)
}

/**
 * Shareable Solo Daily result card.
 * Flat night ledger; teal Solo seal (not ROOM).
 */
export async function exportSoloDailyPng(options: SoloDailyShareInput): Promise<Blob> {
  const appOrigin = resolveAppOrigin(options.appOrigin)
  const appUrlDisplay = formatAppUrlForDisplay(appOrigin)
  const rounds = options.record.rounds ?? []
  const totalRounds = Math.max(rounds.length, 1)
  const showBestStreak =
    options.bestStreak != null && options.bestStreak > options.currentStreak

  const gap = 18
  const starSize = Math.min(
    70,
    Math.floor((WIDTH - PAD * 2 - gap * (totalRounds - 1)) / totalRounds)
  )
  const starsTop = HEADER_H + 28
  const starsBottom = starsTop + starSize
  const legendY = starsBottom + 32
  const statsY = legendY + 36
  const statsBottom = statsY + STAT_CARD_H + (showBestStreak ? 36 : 12)
  const height = Math.ceil(statsBottom + FOOTER_BLOCK + FRAME_INSET)
  const seal = shareSealAnchor(WIDTH, FRAME_INSET)
  const headerMaxWidth = Math.max(240, seal.textMaxX - PAD)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  paintPlainInkField(ctx, WIDTH, height)

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  roundRect(ctx, FRAME_INSET, FRAME_INSET, WIDTH - FRAME_INSET * 2, height - FRAME_INSET * 2, 28)
  ctx.stroke()

  ctx.fillStyle = '#5eead4'
  ctx.font = '700 28px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('WHO AM I?', PAD, 100, headerMaxWidth)

  const when = formatSoloDailyShareDate(options.dateKey)
  ctx.fillStyle = '#f3efe6'
  ctx.font = '800 64px Inter, system-ui, sans-serif'
  ctx.fillText(when, PAD, 172, headerMaxWidth)

  const cardsLabel = `${totalRounds} ${totalRounds === 1 ? 'card' : 'cards'}`
  ctx.fillStyle = 'rgba(243,239,230,0.62)'
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillText(
    options.datasetName
      ? `Daily challenge  ·  ${cardsLabel}  ·  ${options.datasetName}`
      : `Daily challenge  ·  ${cardsLabel}`,
    PAD,
    220,
    headerMaxWidth
  )
  ctx.fillStyle = 'rgba(243,239,230,0.48)'
  ctx.font = '500 24px Inter, system-ui, sans-serif'
  ctx.fillText(
    `${options.record.roundDurationMs / 1000}s cards  ·  clues every ${options.record.clueRevealIntervalMs / 1000}s`,
    PAD,
    256,
    headerMaxWidth
  )

  paintNotarySeal(ctx, {
    cx: seal.x,
    cy: seal.y,
    radius: seal.radius,
    line1: 'SOLO',
    line2: 'DAILY',
    accent: 'teal'
  })

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, HEADER_H - 24)
  ctx.lineTo(WIDTH - PAD, HEADER_H - 24)
  ctx.stroke()

  // Efficiency stars
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(243,239,230,0.55)'
  ctx.font = '600 22px Inter, system-ui, sans-serif'
  ctx.fillText('Round stars', PAD, HEADER_H + 4)

  const boardWidth = totalRounds * starSize + (totalRounds - 1) * gap
  let starX = PAD + Math.max(0, (WIDTH - PAD * 2 - boardWidth) / 2)
  const starCy = starsTop + starSize / 2

  const tones =
    rounds.length > 0
      ? rounds.map((round) => soloRoundEfficiencyTone(round))
      : Array.from({ length: totalRounds }, () => 'miss' as const)

  tones.forEach((tone) => {
    const cx = starX + starSize / 2
    const outerR = starSize * 0.5
    const innerR = outerR * 0.42
    fillStar(ctx, cx, starCy, outerR, innerR)
    if (tone === 'miss') {
      ctx.strokeStyle = 'rgba(243,239,230,0.4)'
      ctx.lineWidth = 4
      ctx.stroke()
    } else {
      ctx.fillStyle = TONE_FILL[tone]
      ctx.fill()
      ctx.strokeStyle = 'rgba(7,11,22,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    starX += starSize + gap
  })

  ctx.fillStyle = 'rgba(243,239,230,0.5)'
  ctx.font = '500 20px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(
    'Gold = first clue  ·  Silver = early  ·  Bronze = late  ·  Outline = miss',
    PAD,
    legendY
  )

  // Stats row
  const score = options.record.score ?? 0
  const stats = [
    { label: 'SCORE', value: formatSoloScore(score), accent: '#5eead4' },
    {
      label: 'CORRECT',
      value: `${options.record.correctCount}/${totalRounds}`,
      accent: '#f3efe6'
    },
    {
      label: 'STREAK',
      value: `${Math.max(0, options.currentStreak)}`,
      accent: '#f3efe6'
    }
  ] as const
  const cardW = (WIDTH - PAD * 2 - 24) / 3
  stats.forEach((stat, index) => {
    const x = PAD + index * (cardW + 12)
    // Opaque panels so the hatch/diamond pattern stays in the field only
    roundRect(ctx, x, statsY, cardW, STAT_CARD_H, 18)
    ctx.fillStyle = '#0a1228'
    ctx.fill()
    roundRect(ctx, x, statsY, cardW, STAT_CARD_H, 18)
    ctx.fillStyle = index === 0 ? '#0f2f35' : '#121a2e'
    ctx.fill()
    ctx.fillStyle = 'rgba(243,239,230,0.45)'
    ctx.font = '700 18px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(stat.label, x + cardW / 2, statsY + 36)
    ctx.fillStyle = stat.accent
    ctx.font = '800 44px Inter, system-ui, sans-serif'
    ctx.fillText(stat.value, x + cardW / 2, statsY + 78)
  })

  if (showBestStreak) {
    ctx.fillStyle = 'rgba(243,239,230,0.4)'
    ctx.font = '500 20px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`Best streak ${options.bestStreak}`, WIDTH / 2, statsY + STAT_CARD_H + 28)
  }

  const frameBottom = height - FRAME_INSET
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(243,239,230,0.4)'
  ctx.font = '500 22px Inter, system-ui, sans-serif'
  ctx.fillText('Solo daily result  ·  Who Am I?', WIDTH / 2, frameBottom - 68)
  if (appUrlDisplay) {
    ctx.fillStyle = '#5eead4'
    ctx.font = '700 26px Inter, system-ui, sans-serif'
    ctx.fillText(appUrlDisplay, WIDTH / 2, frameBottom - 36)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Failed to encode PNG'))
      else resolve(blob)
    }, 'image/png')
  })
}

export async function downloadSoloDailyPng(options: SoloDailyShareInput): Promise<void> {
  const blob = await exportSoloDailyPng(options)
  const fileName = soloDailyShareFileName(options.dateKey)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Opens the native share sheet when file sharing is supported. */
export async function shareSoloDailyPng(options: SoloDailyShareInput): Promise<void> {
  const appOrigin = resolveAppOrigin(options.appOrigin)
  const blob = await exportSoloDailyPng({ ...options, appOrigin })
  const file = new File([blob], soloDailyShareFileName(options.dateKey), {
    type: 'image/png'
  })
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error('Sharing files is not supported on this device')
  }
  const displayUrl = formatAppUrlForDisplay(appOrigin)
  const when = formatSoloDailyShareDate(options.dateKey)
  await navigator.share({
    files: [file],
    title: `Who Am I — ${when}`,
    text: displayUrl
      ? `My Solo daily result · Play at ${displayUrl}`
      : 'My Solo daily result'
  })
}
