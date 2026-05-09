/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const THEME_COLOR = '#2b4bee'
const BACKGROUND_COLOR = '#f6f6f8'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      /**
       * `prompt` (rather than `autoUpdate`) gives the app a chance to defer
       * the reload while the user is mid-game. The deferred-prompt component
       * lives in src/pwa/UpdatePrompt.tsx.
       */
      registerType: 'prompt',
      /**
       * We register the SW manually via workbox-window in src/pwa/registerSW.ts
       * rather than using the plugin's virtual module — gives us a stable React
       * hook without depending on Vite-version-coupled virtual module support.
       */
      injectRegister: false,
      filename: 'sw.js',
      strategies: 'generateSW',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon-180x180.png',
        'apple-splash-*.png'
      ],
      manifest: {
        name: 'Who Am I? - Bible Character Quiz',
        short_name: 'Who Am I?',
        description: 'Real-time multiplayer Bible character guessing game.',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        /**
         * Globs to precache. The build's JS/CSS/HTML get added by default;
         * we explicitly include the static asset PNGs so the splash screens
         * and icons are available offline.
         */
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        /**
         * Single-page app navigation: serve `index.html` for any deep link.
         * The denylist is critical — these paths must NOT be intercepted by
         * the SW because they are server-side routes (Supabase auth, REST API,
         * Socket.IO). Letting the SW serve `index.html` for them would break
         * authentication and real-time gameplay.
         */
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/admin\/api/,
          /^\/auth\//,
          /^\/internal\//,
          /^\/health/,
          /^\/socket\.io/
        ],
        /**
         * Don't try to cache cross-origin requests by default. Socket.IO
         * upgrades over WebSocket bypass the SW entirely, but XHR fallbacks
         * and the API server live on a different origin (Railway) and we
         * don't want them in the precache.
         */
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
