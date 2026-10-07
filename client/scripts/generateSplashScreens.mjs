/**
 * Generates branded iOS startup screens for both the game and admin PWAs.
 *
 * iOS requires one PNG and <link> tag per viewport. The client index is the
 * canonical device list; this script mirrors those links into the admin index
 * and renders matching artwork with an extra "Admin" label.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(clientRoot, '..')
const clientIndexPath = path.join(clientRoot, 'index.html')
const adminIndexPath = path.join(repoRoot, 'admin', 'index.html')
const clientPublic = path.join(clientRoot, 'public')
const adminPublic = path.join(repoRoot, 'admin', 'public')
const logoPath = path.join(clientPublic, 'brand-logo.svg')

const START = '    <!-- pwa-splash-links:start -->'
const END = '    <!-- pwa-splash-links:end -->'

function replaceBlock(source, content) {
  const start = source.indexOf(START)
  const end = source.indexOf(END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Missing pwa-splash-links markers')
  }
  return `${source.slice(0, start)}${START}\n${content}\n${source.slice(end)}`
}

function splashSvg({ width, height, dark, admin, logoDataUri }) {
  const landscape = width > height
  const unit = Math.min(width, height)
  const background = dark ? '#101322' : '#2b4bee'
  const deepBlue = dark ? '#090b16' : '#172cae'
  const gold = '#fcd34d'
  const adminPurple = dark ? '#a78bfa' : '#7c3aed'
  const titleSize = Math.round(unit * (landscape ? 0.13 : 0.12))
  const logoSize = Math.round(titleSize * 1.27)
  const titleY = Math.round(height * (landscape ? 0.47 : 0.45))
  const totalWidth = Math.round(titleSize * 4.72)
  const left = Math.round((width - totalWidth) / 2)
  const baseline = titleY + Math.round(titleSize * 0.8)
  const logoX = left + Math.round(titleSize * 1.45)
  const rightX = logoX + Math.round(logoSize * 0.93)
  const badgeWidth = Math.round(unit * 0.42)
  const badgeHeight = Math.round(unit * 0.055)
  const badgeX = Math.round((width - badgeWidth) / 2)
  const badgeY = titleY - Math.round(unit * 0.12)
  const radius = Math.round(badgeHeight / 2)
  const adminY = titleY + Math.round(titleSize * 1.62)
  const sparkSize = Math.round(unit * 0.04)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(${width * 0.12} ${height * 0.15}) rotate(35) scale(${width * 0.65} ${height * 0.4})">
          <stop stop-color="#fff" stop-opacity=".20"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(${width * 0.9} ${height * 0.85}) rotate(215) scale(${width * 0.62} ${height * 0.4})">
          <stop stop-color="#fff" stop-opacity=".13"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <filter id="titleShadow" x="-20%" y="-30%" width="140%" height="180%">
          <feDropShadow dx="0" dy="${Math.max(5, Math.round(unit * 0.008))}" stdDeviation="0"
            flood-color="${deepBlue}" flood-opacity=".55"/>
        </filter>
        <filter id="logoShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="${Math.max(6, Math.round(unit * 0.009))}"
            stdDeviation="${Math.max(3, Math.round(unit * 0.004))}" flood-color="#07105a" flood-opacity=".45"/>
        </filter>
      </defs>

      <rect width="100%" height="100%" fill="${background}"/>
      <rect width="100%" height="100%" fill="url(#glowA)"/>
      <rect width="100%" height="100%" fill="url(#glowB)"/>
      <g opacity=".09" fill="none" stroke="#fff" stroke-width="${Math.max(2, unit * 0.002)}">
        <circle cx="${width * 0.16}" cy="${height * 0.76}" r="${unit * 0.2}"/>
        <circle cx="${width * 0.83}" cy="${height * 0.23}" r="${unit * 0.13}"/>
      </g>

      <g transform="rotate(-1 ${width / 2} ${badgeY + badgeHeight / 2})">
        <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}"
          rx="${radius}" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".28"/>
        <path d="M ${badgeX + badgeHeight * 0.48} ${badgeY + badgeHeight * 0.28}
          l ${badgeHeight * 0.06} ${badgeHeight * 0.14} ${badgeHeight * 0.14} ${badgeHeight * 0.06}
          l-${badgeHeight * 0.14} ${badgeHeight * 0.06} -${badgeHeight * 0.06} ${badgeHeight * 0.14}
          -${badgeHeight * 0.06} -${badgeHeight * 0.14} -${badgeHeight * 0.14} -${badgeHeight * 0.06}
          ${badgeHeight * 0.14} -${badgeHeight * 0.06}z" fill="${gold}"/>
        <text x="${badgeX + badgeWidth * 0.57}" y="${badgeY + badgeHeight * 0.68}"
          text-anchor="middle" fill="#fff" font-family="Arial, sans-serif"
          font-weight="700" font-size="${badgeHeight * 0.28}" letter-spacing="${badgeHeight * 0.055}">
          THE BIBLE GUESSING GAME
        </text>
      </g>

      <g filter="url(#titleShadow)" fill="#fff"
        font-family="'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif"
        font-weight="700" font-size="${titleSize}" letter-spacing="${titleSize * 0.025}">
        <text x="${left}" y="${baseline}">Wh</text>
        <text x="${rightX}" y="${baseline}">Am I?</text>
      </g>
      <image href="${logoDataUri}" x="${logoX}" y="${titleY - logoSize * 0.1}"
        width="${logoSize}" height="${logoSize}" filter="url(#logoShadow)"
        transform="rotate(-2 ${logoX + logoSize / 2} ${titleY + logoSize / 2})"/>

      <g fill="${gold}" opacity=".9">
        <path d="M ${left - sparkSize * 0.8} ${titleY + sparkSize}
          l ${sparkSize * 0.16} ${sparkSize * 0.36} ${sparkSize * 0.36} ${sparkSize * 0.16}
          -${sparkSize * 0.36} ${sparkSize * 0.16} -${sparkSize * 0.16} ${sparkSize * 0.36}
          -${sparkSize * 0.16} -${sparkSize * 0.36} -${sparkSize * 0.36} -${sparkSize * 0.16}
          ${sparkSize * 0.36} -${sparkSize * 0.16}z"/>
      </g>

      ${admin ? `
        <g>
          <rect x="${width / 2 - unit * 0.17}" y="${adminY - unit * 0.055}"
            width="${unit * 0.34}" height="${unit * 0.095}" rx="${unit * 0.0475}"
            fill="#18181b" fill-opacity=".32" stroke="${adminPurple}"
            stroke-width="${Math.max(4, unit * 0.007)}"/>
          <text x="${width / 2}" y="${adminY + unit * 0.012}" text-anchor="middle"
            fill="#fff" font-family="Arial, sans-serif" font-weight="700"
            font-size="${unit * 0.048}" letter-spacing="${unit * 0.008}">ADMIN</text>
        </g>
      ` : ''}
    </svg>`
}

await mkdir(clientPublic, { recursive: true })
await mkdir(adminPublic, { recursive: true })

const [clientIndex, adminIndex, logo] = await Promise.all([
  readFile(clientIndexPath, 'utf8'),
  readFile(adminIndexPath, 'utf8'),
  readFile(logoPath)
])

const linkPattern = /^    <link rel="apple-touch-startup-image".*href="\/(apple-splash-[^"]+\.png)" \/>$/gm
const links = [...clientIndex.matchAll(linkPattern)]
if (!links.length) throw new Error('No canonical splash links found in client/index.html')

const linkLines = links.map((match) => match[0]).join('\n')
await writeFile(adminIndexPath, replaceBlock(adminIndex, linkLines))

const logoDataUri = `data:image/svg+xml;base64,${logo.toString('base64')}`
const gameFavicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="Who Am I?">
  <rect width="600" height="600" fill="#fff"/>
  <image href="${logoDataUri}" x="39" y="34" width="522" height="532"/>
</svg>
`
await writeFile(path.join(clientPublic, 'favicon.svg'), gameFavicon)

const files = new Map(links.map((match) => [match[1], match[1]]))

for (const filename of files.keys()) {
  const dimensions = filename.match(/-(\d+)x(\d+)\.png$/)
  if (!dimensions) throw new Error(`Could not parse dimensions from ${filename}`)
  const width = Number(dimensions[1])
  const height = Number(dimensions[2])
  const dark = filename.includes('-dark-')

  for (const [admin, outputDir] of [[false, clientPublic], [true, adminPublic]]) {
    const svg = splashSvg({ width, height, dark, admin, logoDataUri })
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(outputDir, filename))
  }
}

console.log(`Generated ${files.size} startup screens for each PWA (${files.size * 2} PNGs total)`)
