/**
 * Builds the canonical PWA icon from the portrait brand mark.
 *
 * The logo stays inside the adaptive-icon safe zone so Android can mask it
 * without clipping the magnifying glass. The surrounding blue matches the
 * manifest background, making Android's generated launch screen read as the
 * logo on blue rather than as an icon tile.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '..', 'public', 'brand-logo.svg')
const OUT = path.resolve(__dirname, '..', 'public', 'app-icon.png')

const SIZE = 1024
const LOGO_WIDTH = 640
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (532 / 522))
const BRAND_BLUE = { r: 0x2b, g: 0x4b, b: 0xee, alpha: 1 }

const logo = await sharp(SRC)
  .resize(LOGO_WIDTH, LOGO_HEIGHT, { fit: 'contain' })
  .png()
  .toBuffer()

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: BRAND_BLUE
  }
})
  .composite([{
    input: logo,
    left: Math.round((SIZE - LOGO_WIDTH) / 2),
    top: Math.round((SIZE - LOGO_HEIGHT) / 2)
  }])
  .png({ compressionLevel: 9 })
  .toFile(OUT)

console.log(`Wrote ${OUT} (${SIZE}x${SIZE}, portrait logo on #2b4bee)`)
