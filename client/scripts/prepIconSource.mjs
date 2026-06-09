/**
 * Prepares the canonical 1024x1024 app icon source from a generated raw image.
 *
 * Steps:
 *   1. Center-crop the source PNG to a square and resize to 1024x1024.
 *   2. Build an alpha mask from the white question-mark glyph by thresholding
 *      the greyscale of the source.
 *   3. Use that alpha to paint a pure-white glyph onto a flat brand-blue canvas.
 *
 * That gives us a deterministic, on-brand 1024x1024 PNG that drives
 * `pwa-assets-generator` to emit every icon + iOS splash variant we need.
 *
 * Re-runnable. Reads from assets/app-icon-source.png and writes to
 * public/app-icon.png.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '..', 'assets', 'app-icon-source.png')
const OUT = path.resolve(__dirname, '..', 'public', 'app-icon.png')

const SIZE = 1024
const BRAND_BLUE = { r: 0x2b, g: 0x4b, b: 0xee, alpha: 1 }

const meta = await sharp(SRC).metadata()
if (!meta.width || !meta.height) {
  throw new Error(`Could not read dimensions of ${SRC}`)
}

const side = Math.min(meta.width, meta.height)
const left = Math.floor((meta.width - side) / 2)
const top = Math.floor((meta.height - side) / 2)

// 1) Center-crop to square + resize to canonical 1024.
const squarePng = await sharp(SRC)
  .extract({ left, top, width: side, height: side })
  .resize(SIZE, SIZE, { kernel: sharp.kernel.lanczos3 })
  .removeAlpha()
  .png()
  .toBuffer()

// 2) Threshold the greyscale to get a 1-channel mask: 255 inside the glyph,
//    0 elsewhere. We then attach this as the alpha channel of an all-white
//    RGB image via joinChannel - the previous `dest-in` approach silently
//    treated the mask as fully opaque and ended up with a fully white output.
const alphaMask = await sharp(squarePng)
  .greyscale()
  .threshold(180)
  .toColourspace('b-w')
  .raw()
  .toBuffer()

const whiteGlyph = await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 3,
    background: { r: 255, g: 255, b: 255 }
  }
})
  .joinChannel(alphaMask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .png()
  .toBuffer()

// 3) Composite the masked glyph onto a flat brand-blue canvas.
await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: BRAND_BLUE
  }
})
  .composite([{ input: whiteGlyph }])
  .png({ compressionLevel: 9 })
  .toFile(OUT)

console.log(`Wrote ${OUT} (${SIZE}x${SIZE}, brand-locked #2b4bee)`)
