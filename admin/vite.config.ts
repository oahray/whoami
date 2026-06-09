/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const THEME_COLOR = '#18181b'
const BACKGROUND_COLOR = '#f4f4f5'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      filename: 'sw.js',
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'brand-logo.svg'],
      manifest: {
        name: 'Who Am I? Admin',
        short_name: 'WhoAmI Admin',
        description: 'Content management for Who Am I?',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth\//],
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
    port: 5174,
    host: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
})
