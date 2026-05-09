import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset
} from '@vite-pwa/assets-generator/config'

/**
 * Asset pipeline for the installable PWA. One source PNG (`public/app-icon.png`)
 * fans out to:
 *   - favicon.ico + favicon.svg (transparent set)
 *   - 192/512 icon PNGs (regular + maskable)
 *   - 180×180 apple-touch-icon
 *   - apple-touch-startup-image splash screens for the modern device cohort
 *
 * iOS Safari does not honour the manifest for splash screens; it requires a
 * discrete `apple-touch-startup-image` per device pixel-density combination.
 * We target a sensible subset of currently-shipping devices rather than every
 * historical model so the build doesn't spit out 50+ images.
 *
 * Re-run with `npm run pwa-assets`.
 */
export default defineConfig({
  preset: combinePresetAndAppleSplashScreens(
    minimal2023Preset,
    {
      padding: 0.3,
      resizeOptions: { background: '#2b4bee', fit: 'contain' },
      darkResizeOptions: { background: '#101322', fit: 'contain' },
      linkMediaOptions: { log: false }
    },
    [
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 15 Pro Max',
      'iPhone 15 Pro',
      'iPhone 15 Plus',
      'iPhone 15',
      'iPhone 14 Pro Max',
      'iPhone 14 Pro',
      'iPhone 13 Pro Max',
      'iPhone 13',
      'iPhone 13 mini',
      'iPhone SE 4.7"',
      'iPad Pro 12.9"',
      'iPad Pro 11"',
      'iPad Air 11"',
      'iPad 10.2"',
      'iPad mini 8.3"'
    ]
  ),
  images: ['public/app-icon.png']
})
