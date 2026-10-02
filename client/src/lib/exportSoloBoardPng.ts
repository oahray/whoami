import { formatAppUrlForDisplay } from './exportLeaderboardPng'
import { paintNotarySeal, shareSealAnchor } from './exportShareSeal'
import {
  formatSoloScore,
  formatSoloTime,
  soloConfigSummary,
  soloVariationLabel,
  type SoloRecord,
  type SoloVariation
} from './soloSession'

const WIDTH = 1080
const PAD = 72
const HEADER_H = 300
const FRAME_INSET = 36
const ROW_H = 96
const FOOTER_BLOCK = 120

export type SoloBoardShareVariation = Extract<SoloVariation, 'challenge' | 'endurance'>

export type SoloBoardShareInput = {
  variation: SoloBoardShareVariation
  datasetName?: string
  records: SoloRecord[]
  /** App origin for the footer CTA. Defaults to `window.location.origin`. */
  appOrigin?: string
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

function rankAccent(rank: number): string {
  if (rank === 1) return '#e8b84a'
  if (rank === 2) return '#9aa7bd'
  if (rank === 3) return '#c47a4a'
  return '#14b8a6'
}

export function soloBoardSealLine(variation: SoloBoardShareVariation): string {
  return variation === 'challenge' ? 'CLASSIC' : 'ENDURANCE'
}

export function soloBoardShareFileName(variation: SoloBoardShareVariation): string {
  return variation === 'challenge'
    ? 'whoami-solo-classic-board.png'
    : 'whoami-solo-endurance-board.png'
}

export function soloBoardPrimaryValue(record: SoloRecord): string {
  if (record.variation === 'endurance') return String(record.correctCount)
  return formatSoloScore(record.score ?? 0)
}

export function soloBoardPrimaryUnit(variation: SoloBoardShareVariation): string {
  return variation === 'endurance' ? 'STREAK' : 'PTS'
}

/**
 * Shareable Solo Classic / Endurance personal-best board.
 * Spoiler-free: config summary + score/streak only (no entity names).
 */
export async function exportSoloBoardPng(options: SoloBoardShareInput): Promise<Blob> {
  const appOrigin = resolveAppOrigin(options.appOrigin)
  const appUrlDisplay = formatAppUrlForDisplay(appOrigin)
  const records = options.records.slice(0, 10)
  const modeLabel = soloVariationLabel(options.variation)
  const sealLine = soloBoardSealLine(options.variation)
  const rows = Math.max(records.length, 1)
  const height = Math.ceil(HEADER_H + rows * ROW_H + FOOTER_BLOCK + FRAME_INSET)

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

  const seal = shareSealAnchor(WIDTH, FRAME_INSET)
  const headerMaxWidth = Math.max(240, seal.textMaxX - PAD)

  ctx.fillStyle = '#5eead4'
  ctx.font = '700 28px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('WHO AM I?', PAD, 100, headerMaxWidth)

  ctx.fillStyle = '#f3efe6'
  ctx.font = '800 64px Inter, system-ui, sans-serif'
  ctx.fillText(modeLabel, PAD, 172, headerMaxWidth)

  ctx.fillStyle = 'rgba(243,239,230,0.62)'
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillText(
    options.datasetName
      ? `Personal bests  ·  ${options.datasetName}`
      : 'Personal bests',
    PAD,
    220,
    headerMaxWidth
  )
  ctx.fillStyle = 'rgba(243,239,230,0.48)'
  ctx.font = '500 24px Inter, system-ui, sans-serif'
  ctx.fillText(
    records.length === 0 ? 'No records yet' : `Top ${records.length}`,
    PAD,
    256,
    headerMaxWidth
  )

  paintNotarySeal(ctx, {
    cx: seal.x,
    cy: seal.y,
    radius: seal.radius,
    line1: 'SOLO',
    line2: sealLine,
    accent: 'teal'
  })

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, HEADER_H - 24)
  ctx.lineTo(WIDTH - PAD, HEADER_H - 24)
  ctx.stroke()

  if (records.length === 0) {
    ctx.fillStyle = 'rgba(243,239,230,0.45)'
    ctx.font = '500 28px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Finish a run to set a personal best.', WIDTH / 2, HEADER_H + ROW_H / 2)
  } else {
    records.forEach((record, index) => {
      const rank = index + 1
      const y = HEADER_H + index * ROW_H
      const rowMid = y + (ROW_H - 14) / 2
      const accent = rankAccent(rank)
      const summary = soloConfigSummary(record, { includeVariation: false })
      const summaryShort = summary.length > 42 ? `${summary.slice(0, 41)}…` : summary

      roundRect(ctx, PAD, y, WIDTH - PAD * 2, ROW_H - 14, 18)
      ctx.fillStyle = '#0a1228'
      ctx.fill()
      roundRect(ctx, PAD, y, WIDTH - PAD * 2, ROW_H - 14, 18)
      ctx.fillStyle = rank === 1 ? '#2a2210' : '#121a2e'
      ctx.fill()

      roundRect(ctx, PAD + 18, rowMid - 24, 64, 48, 14)
      ctx.fillStyle = accent
      ctx.fill()
      ctx.fillStyle = rank <= 3 ? '#1a1208' : '#ffffff'
      ctx.font = '800 26px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`#${rank}`, PAD + 50, rowMid)

      ctx.textAlign = 'left'
      ctx.fillStyle = '#f3efe6'
      ctx.font = '700 26px Inter, system-ui, sans-serif'
      ctx.fillText(summaryShort, PAD + 104, rowMid - 12, WIDTH - PAD * 2 - 280)
      ctx.fillStyle = 'rgba(243,239,230,0.5)'
      ctx.font = '500 20px Inter, system-ui, sans-serif'
      ctx.fillText(
        `${record.correctCount} correct  ·  ${formatSoloTime(record.activeElapsedMs)}`,
        PAD + 104,
        rowMid + 16,
        WIDTH - PAD * 2 - 280
      )

      ctx.textAlign = 'right'
      ctx.fillStyle = accent
      ctx.font = '800 40px Inter, system-ui, sans-serif'
      ctx.fillText(soloBoardPrimaryValue(record), WIDTH - PAD - 28, rowMid - 10)
      ctx.fillStyle = 'rgba(243,239,230,0.45)'
      ctx.font = '600 18px Inter, system-ui, sans-serif'
      ctx.fillText(soloBoardPrimaryUnit(options.variation), WIDTH - PAD - 28, rowMid + 18)
    })
  }

  const frameBottom = height - FRAME_INSET
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(243,239,230,0.4)'
  ctx.font = '500 22px Inter, system-ui, sans-serif'
  ctx.fillText(`Solo ${modeLabel.toLowerCase()} board  ·  Who Am I?`, WIDTH / 2, frameBottom - 68)
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

export async function downloadSoloBoardPng(options: SoloBoardShareInput): Promise<void> {
  const blob = await exportSoloBoardPng(options)
  const fileName = soloBoardShareFileName(options.variation)
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
export async function shareSoloBoardPng(options: SoloBoardShareInput): Promise<void> {
  const appOrigin = resolveAppOrigin(options.appOrigin)
  const blob = await exportSoloBoardPng({ ...options, appOrigin })
  const file = new File([blob], soloBoardShareFileName(options.variation), {
    type: 'image/png'
  })
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error('Sharing files is not supported on this device')
  }
  const displayUrl = formatAppUrlForDisplay(appOrigin)
  const modeLabel = soloVariationLabel(options.variation)
  await navigator.share({
    files: [file],
    title: `Who Am I — Solo ${modeLabel}`,
    text: displayUrl
      ? `My Solo ${modeLabel} board · Play at ${displayUrl}`
      : `My Solo ${modeLabel} board`
  })
}
