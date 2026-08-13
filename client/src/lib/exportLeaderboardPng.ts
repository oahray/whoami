import { avatarSrc, isAvatarId } from './avatars'
import {
  formatGameHistorySettings,
  type GameHistoryEntry,
  type GameHistoryScoreEntry
} from './gameHistory'

const WIDTH = 1080
const PAD = 72
const ROW_H = 96
const HEADER_H = 380
const FOOTER_H = 168

type RankedRow = GameHistoryScoreEntry & { rank: number; tied: boolean }

/** App host-only display form of the app origin (no protocol / trailing slash). */
export function formatAppUrlForDisplay(
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  return origin.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

function resolveAppOrigin(
  origin?: string
): string {
  if (origin) return origin.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function rankScoreboard(scoreboard: GameHistoryScoreEntry[]): RankedRow[] {
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
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

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  nickname: string,
  cx: number,
  cy: number,
  size: number
) {
  const r = size / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, size, size)
  } else {
    ctx.fillStyle = '#1e2a4a'
    ctx.fillRect(cx - r, cy - r, size, size)
    ctx.fillStyle = '#d7e0ff'
    ctx.font = `700 ${Math.floor(size * 0.36)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((nickname.trim().slice(0, 2) || '?').toUpperCase(), cx, cy + 1)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 3
  ctx.stroke()
}

function rankAccent(rank: number, score: number): string {
  if (score <= 0) return '#64748b'
  if (rank === 1) return '#e8b84a'
  if (rank === 2) return '#9aa7bd'
  if (rank === 3) return '#c47a4a'
  return '#5b7cff'
}

/**
 * Renders a shareable leaderboard card to a PNG blob.
 * Visual: night ledger — ink field, electric blue geometry, cream type.
 */
export async function exportLeaderboardPng(options: {
  roomCode: string
  entry: GameHistoryEntry
  /** App origin for the footer CTA. Defaults to `window.location.origin`. */
  appOrigin?: string
}): Promise<Blob> {
  const { roomCode, entry } = options
  const appOrigin = resolveAppOrigin(options.appOrigin)
  const appUrlDisplay = formatAppUrlForDisplay(appOrigin)
  const ranked = rankScoreboard(entry.scoreboard)
  const height = HEADER_H + ranked.length * ROW_H + FOOTER_H + PAD

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // Ink field
  const bg = ctx.createLinearGradient(0, 0, WIDTH, height)
  bg.addColorStop(0, '#070b16')
  bg.addColorStop(0.45, '#0d1530')
  bg.addColorStop(1, '#101a38')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, height)

  // Diagonal beam
  ctx.save()
  ctx.translate(WIDTH * 0.72, -80)
  ctx.rotate((18 * Math.PI) / 180)
  const beam = ctx.createLinearGradient(0, 0, 220, 0)
  beam.addColorStop(0, 'rgba(43,75,238,0)')
  beam.addColorStop(0.5, 'rgba(43,75,238,0.28)')
  beam.addColorStop(1, 'rgba(43,75,238,0)')
  ctx.fillStyle = beam
  ctx.fillRect(-40, 0, 220, height + 200)
  ctx.restore()

  // Soft constellation dots
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 48; i++) {
    const x = ((i * 137) % (WIDTH - 80)) + 40
    const y = ((i * 89) % (height - 80)) + 40
    const s = 1.5 + (i % 3)
    ctx.beginPath()
    ctx.arc(x, y, s, 0, Math.PI * 2)
    ctx.fill()
  }

  // Frame
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  roundRect(ctx, 36, 36, WIDTH - 72, height - 72, 28)
  ctx.stroke()

  // Brand
  ctx.fillStyle = '#8fa2ff'
  ctx.font = '700 28px Inter, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('WHO AM I?', PAD, 110)

  ctx.fillStyle = '#f3efe6'
  ctx.font = '800 72px Inter, system-ui, sans-serif'
  ctx.fillText(`Game ${entry.gameNumber}`, PAD, 188)

  const when = new Date(entry.endedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
  const { difficulty, roundTime, clueInterval } = formatGameHistorySettings(entry)
  ctx.fillStyle = 'rgba(243,239,230,0.62)'
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillText(`${when}  ·  ${entry.totalRounds} rounds`, PAD, 236)
  ctx.fillStyle = 'rgba(243,239,230,0.48)'
  ctx.font = '500 24px Inter, system-ui, sans-serif'
  ctx.fillText(`${difficulty}  ·  ${roundTime}/round  ·  clues ${clueInterval}`, PAD, 276)

  // Room seal
  const sealX = WIDTH - PAD - 110
  const sealY = 150
  ctx.beginPath()
  ctx.arc(sealX, sealY, 70, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(43,75,238,0.22)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(143,162,255,0.55)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#d7e0ff'
  ctx.font = '700 18px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ROOM', sealX, sealY - 12)
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 26px Inter, system-ui, sans-serif'
  ctx.fillText(roomCode, sealX, sealY + 22)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PAD, HEADER_H - 36)
  ctx.lineTo(WIDTH - PAD, HEADER_H - 36)
  ctx.stroke()

  const avatars = await Promise.all(
    ranked.map(async (row) => {
      if (!isAvatarId(row.avatarId)) return null
      return loadImage(avatarSrc(row.avatarId))
    })
  )

  ranked.forEach((row, index) => {
    const y = HEADER_H + index * ROW_H
    const rowMid = y + (ROW_H - 14) / 2
    const accent = rankAccent(row.rank, row.score)
    const showTied = row.tied && row.score > 0

    roundRect(ctx, PAD, y, WIDTH - PAD * 2, ROW_H - 14, 18)
    ctx.fillStyle = index === 0 && row.score > 0 ? 'rgba(232,184,74,0.12)' : 'rgba(255,255,255,0.04)'
    ctx.fill()

    // Rank chip
    roundRect(ctx, PAD + 18, rowMid - 24, 64, 48, 14)
    ctx.fillStyle = accent
    ctx.fill()
    ctx.fillStyle = row.rank <= 3 && row.score > 0 ? '#1a1208' : '#ffffff'
    ctx.font = '800 26px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`#${row.rank}`, PAD + 50, rowMid)

    drawAvatar(ctx, avatars[index] ?? null, row.nickname, PAD + 140, rowMid, 64)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f3efe6'
    ctx.font = '700 34px Inter, system-ui, sans-serif'
    const name = row.nickname.length > 18 ? `${row.nickname.slice(0, 17)}…` : row.nickname
    ctx.fillText(name, PAD + 190, showTied ? rowMid - 12 : rowMid)
    if (showTied) {
      ctx.fillStyle = 'rgba(243,239,230,0.5)'
      ctx.font = '500 20px Inter, system-ui, sans-serif'
      ctx.fillText('Tied', PAD + 190, rowMid + 16)
    }

    ctx.textAlign = 'right'
    ctx.fillStyle = accent
    ctx.font = '800 40px Inter, system-ui, sans-serif'
    ctx.fillText(String(row.score), WIDTH - PAD - 28, showTied ? rowMid - 10 : rowMid)
    ctx.fillStyle = 'rgba(243,239,230,0.45)'
    ctx.font = '600 18px Inter, system-ui, sans-serif'
    ctx.fillText('PTS', WIDTH - PAD - 28, showTied ? rowMid + 18 : rowMid + 22)
  })

  const frameBottom = height - 36
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(243,239,230,0.4)'
  ctx.font = '500 22px Inter, system-ui, sans-serif'
  ctx.fillText('Session leaderboard  ·  Who Am I?', WIDTH / 2, frameBottom - 66)
  if (appUrlDisplay) {
    ctx.fillStyle = '#8fa2ff'
    ctx.font = '700 26px Inter, system-ui, sans-serif'
    ctx.fillText(appUrlDisplay, WIDTH / 2, frameBottom - 32)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Failed to encode PNG'))
      else resolve(blob)
    }, 'image/png')
  })
}

export async function downloadLeaderboardPng(options: {
  roomCode: string
  entry: GameHistoryEntry
  appOrigin?: string
}): Promise<void> {
  const blob = await exportLeaderboardPng(options)
  const fileName = `whoami-${options.roomCode}-game-${options.entry.gameNumber}.png`
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

/** Opens the native share sheet (iOS / Android). No download option there — use downloadLeaderboardPng. */
export async function shareLeaderboardPng(options: {
  roomCode: string
  entry: GameHistoryEntry
  appOrigin?: string
}): Promise<void> {
  const appOrigin = resolveAppOrigin(options.appOrigin)
  const blob = await exportLeaderboardPng({ ...options, appOrigin })
  const file = new File([blob], `whoami-${options.roomCode}-game-${options.entry.gameNumber}.png`, {
    type: 'image/png'
  })
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error('Sharing files is not supported on this device')
  }
  const displayUrl = formatAppUrlForDisplay(appOrigin)
  await navigator.share({
    files: [file],
    title: `Who Am I — Game ${options.entry.gameNumber}`,
    text: displayUrl
      ? `Room ${options.roomCode} leaderboard · Play at ${displayUrl}`
      : `Room ${options.roomCode} leaderboard`
  })
}

/** @deprecated Prefer explicit downloadLeaderboardPng or shareLeaderboardPng */
export async function shareOrDownloadLeaderboardPng(options: {
  roomCode: string
  entry: GameHistoryEntry
}): Promise<'shared' | 'downloaded'> {
  await downloadLeaderboardPng(options)
  return 'downloaded'
}
