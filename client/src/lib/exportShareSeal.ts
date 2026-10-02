/** Shared notary / lawyer embossed seal for share-card exports. */

export const SHARE_SEAL_RADIUS = 102

export type ShareSealAccent = 'teal' | 'blue'

type SealPalette = {
  ink: string
  body: string
  rim: string
  ringOuter: string
  ringInner: string
  face: string
  faceStroke: string
  line1: string
  rule: string
}

const PALETTES: Record<ShareSealAccent, SealPalette> = {
  teal: {
    ink: '#0a1228',
    body: '#123d42',
    rim: '#5eead4',
    ringOuter: 'rgba(153,246,228,0.75)',
    ringInner: 'rgba(94,234,212,0.55)',
    face: '#0f2f35',
    faceStroke: 'rgba(243,239,230,0.28)',
    line1: '#99f6e4',
    rule: 'rgba(94,234,212,0.55)'
  },
  blue: {
    ink: '#0a1228',
    body: '#152048',
    rim: '#8fa2ff',
    ringOuter: 'rgba(167,180,255,0.75)',
    ringInner: 'rgba(143,162,255,0.55)',
    face: '#151f3d',
    faceStroke: 'rgba(243,239,230,0.28)',
    line1: '#d7e0ff',
    rule: 'rgba(143,162,255,0.55)'
  }
}

function fitSealLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: 700 | 800
): number {
  for (let size = maxSize; size >= minSize; size -= 1) {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) return size
  }
  ctx.font = `${weight} ${minSize}px Inter, system-ui, sans-serif`
  return minSize
}

/** Top-right corner anchor that clears the left header copy column. */
export function shareSealAnchor(
  canvasWidth: number,
  frameInset = 36
): { x: number; y: number; radius: number; textMaxX: number } {
  const radius = SHARE_SEAL_RADIUS
  // Nest in the frame corner; leave a modest gap before header copy.
  const x = canvasWidth - frameInset - radius - 4
  const y = frameInset + radius + 10
  return { x, y, radius, textMaxX: x - radius - 16 }
}

/** Notary seal: scalloped rim, concentric rings, two-line center legend. */
export function paintNotarySeal(
  ctx: CanvasRenderingContext2D,
  options: {
    cx: number
    cy: number
    radius?: number
    line1: string
    line2: string
    accent?: ShareSealAccent
  }
) {
  const {
    cx,
    cy,
    radius = SHARE_SEAL_RADIUS,
    line1,
    line2,
    accent = 'teal'
  } = options
  const palette = PALETTES[accent]
  const lobes = 32
  const baseR = radius * 0.88
  const bumpR = radius * 0.14
  const ringOuter = radius * 0.74
  const ringInner = radius * 0.64
  const faceR = radius * 0.6
  const textMax = faceR * 1.7

  ctx.beginPath()
  for (let i = 0; i < lobes; i += 1) {
    const a0 = (i / lobes) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 1) / lobes) * Math.PI * 2 - Math.PI / 2
    const mid = (a0 + a1) / 2
    const x0 = cx + Math.cos(a0) * baseR
    const y0 = cy + Math.sin(a0) * baseR
    const bx = cx + Math.cos(mid) * (baseR + bumpR)
    const by = cy + Math.sin(mid) * (baseR + bumpR)
    const x1 = cx + Math.cos(a1) * baseR
    const y1 = cy + Math.sin(a1) * baseR
    if (i === 0) ctx.moveTo(x0, y0)
    ctx.quadraticCurveTo(bx, by, x1, y1)
  }
  ctx.closePath()
  ctx.fillStyle = palette.ink
  ctx.fill()
  ctx.fillStyle = palette.body
  ctx.fill()
  ctx.strokeStyle = palette.rim
  ctx.lineWidth = Math.max(2.5, radius * 0.028)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, ringOuter, 0, Math.PI * 2)
  ctx.strokeStyle = palette.ringOuter
  ctx.lineWidth = Math.max(2, radius * 0.022)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, ringInner, 0, Math.PI * 2)
  ctx.strokeStyle = palette.ringInner
  ctx.lineWidth = Math.max(1.5, radius * 0.016)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, faceR, 0, Math.PI * 2)
  ctx.fillStyle = palette.face
  ctx.fill()
  ctx.strokeStyle = palette.faceStroke
  ctx.lineWidth = Math.max(1.25, radius * 0.014)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.line1
  const line1Size = fitSealLine(
    ctx,
    line1,
    textMax,
    Math.round(radius * 0.2),
    Math.round(radius * 0.12),
    700
  )
  ctx.font = `700 ${line1Size}px Inter, system-ui, sans-serif`
  ctx.fillText(line1, cx, cy - radius * 0.18, textMax)

  ctx.strokeStyle = palette.rule
  ctx.lineWidth = Math.max(1.5, radius * 0.016)
  ctx.beginPath()
  ctx.moveTo(cx - faceR * 0.55, cy)
  ctx.lineTo(cx + faceR * 0.55, cy)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  const line2Size = fitSealLine(
    ctx,
    line2,
    textMax,
    Math.round(radius * 0.27),
    Math.round(radius * 0.14),
    800
  )
  ctx.font = `800 ${line2Size}px Inter, system-ui, sans-serif`
  ctx.fillText(line2, cx, cy + radius * 0.2, textMax)
}
