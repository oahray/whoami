// vite.config.ts
import { defineConfig } from "file:///sessions/rcw-01cprj4klcmcgb3qm1ects6k/mnt/whoami/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/rcw-01cprj4klcmcgb3qm1ects6k/mnt/whoami/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///sessions/rcw-01cprj4klcmcgb3qm1ects6k/mnt/whoami/node_modules/vite-plugin-pwa/dist/index.js";
var SPLASH_COLOR = "#000000";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      /**
       * `prompt` (rather than `autoUpdate`) gives the app a chance to defer
       * the reload while the user is mid-game. The deferred-prompt component
       * lives in src/pwa/UpdatePrompt.tsx.
       */
      registerType: "prompt",
      /**
       * We register the SW manually via workbox-window in src/pwa/registerSW.ts
       * rather than using the plugin's virtual module - gives us a stable React
       * hook without depending on Vite-version-coupled virtual module support.
       */
      injectRegister: false,
      filename: "sw.js",
      strategies: "generateSW",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon-180x180.png",
        "apple-splash-*.png"
      ],
      manifest: {
        name: "Who Am I? - Bible Character Quiz",
        short_name: "Who Am I?",
        description: "Real-time multiplayer Bible character guessing game.",
        theme_color: SPLASH_COLOR,
        background_color: SPLASH_COLOR,
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        /**
         * Globs to precache. The build's JS/CSS/HTML get added by default;
         * we explicitly include the static asset PNGs so the splash screens
         * and icons are available offline.
         */
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        /**
         * Single-page app navigation: serve `index.html` for any deep link.
         * The denylist is critical - these paths must NOT be intercepted by
         * the SW because they are server-side routes (Supabase auth, REST API,
         * Socket.IO). Letting the SW serve `index.html` for them would break
         * authentication and real-time gameplay.
         */
        navigateFallback: "/index.html",
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
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvcmN3LTAxY3ByajRrbGNtY2diM3FtMWVjdHM2ay9tbnQvd2hvYW1pL2NsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3Jjdy0wMWNwcmo0a2xjbWNnYjNxbTFlY3RzNmsvbW50L3dob2FtaS9jbGllbnQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3Jjdy0wMWNwcmo0a2xjbWNnYjNxbTFlY3RzNmsvbW50L3dob2FtaS9jbGllbnQvdml0ZS5jb25maWcudHNcIjsvLy8gPHJlZmVyZW5jZSB0eXBlcz1cInZpdGVzdFwiIC8+XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcblxuLyoqXG4gKiBTcGxhc2ggZmlsbCBhbmQgdGhlIEFuZHJvaWQgbmF2aWdhdGlvbiBiYXIuXG4gKiBUaGUgbGl2ZSBzdGF0dXMgYmFyIHVzZXMgdGhlIHBhZ2UgdGhlbWUtY29sb3IgbWV0YSBpbnN0ZWFkLlxuICovXG5jb25zdCBTUExBU0hfQ09MT1IgPSAnIzAwMDAwMCdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgVml0ZVBXQSh7XG4gICAgICAvKipcbiAgICAgICAqIGBwcm9tcHRgIChyYXRoZXIgdGhhbiBgYXV0b1VwZGF0ZWApIGdpdmVzIHRoZSBhcHAgYSBjaGFuY2UgdG8gZGVmZXJcbiAgICAgICAqIHRoZSByZWxvYWQgd2hpbGUgdGhlIHVzZXIgaXMgbWlkLWdhbWUuIFRoZSBkZWZlcnJlZC1wcm9tcHQgY29tcG9uZW50XG4gICAgICAgKiBsaXZlcyBpbiBzcmMvcHdhL1VwZGF0ZVByb21wdC50c3guXG4gICAgICAgKi9cbiAgICAgIHJlZ2lzdGVyVHlwZTogJ3Byb21wdCcsXG4gICAgICAvKipcbiAgICAgICAqIFdlIHJlZ2lzdGVyIHRoZSBTVyBtYW51YWxseSB2aWEgd29ya2JveC13aW5kb3cgaW4gc3JjL3B3YS9yZWdpc3RlclNXLnRzXG4gICAgICAgKiByYXRoZXIgdGhhbiB1c2luZyB0aGUgcGx1Z2luJ3MgdmlydHVhbCBtb2R1bGUgLSBnaXZlcyB1cyBhIHN0YWJsZSBSZWFjdFxuICAgICAgICogaG9vayB3aXRob3V0IGRlcGVuZGluZyBvbiBWaXRlLXZlcnNpb24tY291cGxlZCB2aXJ0dWFsIG1vZHVsZSBzdXBwb3J0LlxuICAgICAgICovXG4gICAgICBpbmplY3RSZWdpc3RlcjogZmFsc2UsXG4gICAgICBmaWxlbmFtZTogJ3N3LmpzJyxcbiAgICAgIHN0cmF0ZWdpZXM6ICdnZW5lcmF0ZVNXJyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcbiAgICAgICAgJ2Zhdmljb24uc3ZnJyxcbiAgICAgICAgJ2FwcGxlLXRvdWNoLWljb24tMTgweDE4MC5wbmcnLFxuICAgICAgICAnYXBwbGUtc3BsYXNoLSoucG5nJ1xuICAgICAgXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdXaG8gQW0gST8gLSBCaWJsZSBDaGFyYWN0ZXIgUXVpeicsXG4gICAgICAgIHNob3J0X25hbWU6ICdXaG8gQW0gST8nLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1JlYWwtdGltZSBtdWx0aXBsYXllciBCaWJsZSBjaGFyYWN0ZXIgZ3Vlc3NpbmcgZ2FtZS4nLFxuICAgICAgICB0aGVtZV9jb2xvcjogU1BMQVNIX0NPTE9SLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBTUExBU0hfQ09MT1IsXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgb3JpZW50YXRpb246ICdwb3J0cmFpdCcsXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxuICAgICAgICBzY29wZTogJy8nLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHsgc3JjOiAncHdhLTY0eDY0LnBuZycsIHNpemVzOiAnNjR4NjQnLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAncHdhLTE5MngxOTIucG5nJywgc2l6ZXM6ICcxOTJ4MTkyJywgdHlwZTogJ2ltYWdlL3BuZycgfSxcbiAgICAgICAgICB7IHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsIHNpemVzOiAnNTEyeDUxMicsIHR5cGU6ICdpbWFnZS9wbmcnIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnbWFza2FibGUtaWNvbi01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgd29ya2JveDoge1xuICAgICAgICAvKipcbiAgICAgICAgICogR2xvYnMgdG8gcHJlY2FjaGUuIFRoZSBidWlsZCdzIEpTL0NTUy9IVE1MIGdldCBhZGRlZCBieSBkZWZhdWx0O1xuICAgICAgICAgKiB3ZSBleHBsaWNpdGx5IGluY2x1ZGUgdGhlIHN0YXRpYyBhc3NldCBQTkdzIHNvIHRoZSBzcGxhc2ggc2NyZWVuc1xuICAgICAgICAgKiBhbmQgaWNvbnMgYXJlIGF2YWlsYWJsZSBvZmZsaW5lLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfSddLFxuICAgICAgICAvKipcbiAgICAgICAgICogU2luZ2xlLXBhZ2UgYXBwIG5hdmlnYXRpb246IHNlcnZlIGBpbmRleC5odG1sYCBmb3IgYW55IGRlZXAgbGluay5cbiAgICAgICAgICogVGhlIGRlbnlsaXN0IGlzIGNyaXRpY2FsIC0gdGhlc2UgcGF0aHMgbXVzdCBOT1QgYmUgaW50ZXJjZXB0ZWQgYnlcbiAgICAgICAgICogdGhlIFNXIGJlY2F1c2UgdGhleSBhcmUgc2VydmVyLXNpZGUgcm91dGVzIChTdXBhYmFzZSBhdXRoLCBSRVNUIEFQSSxcbiAgICAgICAgICogU29ja2V0LklPKS4gTGV0dGluZyB0aGUgU1cgc2VydmUgYGluZGV4Lmh0bWxgIGZvciB0aGVtIHdvdWxkIGJyZWFrXG4gICAgICAgICAqIGF1dGhlbnRpY2F0aW9uIGFuZCByZWFsLXRpbWUgZ2FtZXBsYXkuXG4gICAgICAgICAqL1xuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFtcbiAgICAgICAgICAvXlxcL2FkbWluXFwvYXBpLyxcbiAgICAgICAgICAvXlxcL2F1dGhcXC8vLFxuICAgICAgICAgIC9eXFwvaW50ZXJuYWxcXC8vLFxuICAgICAgICAgIC9eXFwvaGVhbHRoLyxcbiAgICAgICAgICAvXlxcL3NvY2tldFxcLmlvL1xuICAgICAgICBdLFxuICAgICAgICAvKipcbiAgICAgICAgICogRG9uJ3QgdHJ5IHRvIGNhY2hlIGNyb3NzLW9yaWdpbiByZXF1ZXN0cyBieSBkZWZhdWx0LiBTb2NrZXQuSU9cbiAgICAgICAgICogdXBncmFkZXMgb3ZlciBXZWJTb2NrZXQgYnlwYXNzIHRoZSBTVyBlbnRpcmVseSwgYnV0IFhIUiBmYWxsYmFja3NcbiAgICAgICAgICogYW5kIHRoZSBBUEkgc2VydmVyIGxpdmUgb24gYSBkaWZmZXJlbnQgb3JpZ2luIChSYWlsd2F5KSBhbmQgd2VcbiAgICAgICAgICogZG9uJ3Qgd2FudCB0aGVtIGluIHRoZSBwcmVjYWNoZS5cbiAgICAgICAgICovXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcbiAgICAgICAgY2xpZW50c0NsYWltOiBmYWxzZSxcbiAgICAgICAgc2tpcFdhaXRpbmc6IGZhbHNlXG4gICAgICB9LFxuICAgICAgZGV2T3B0aW9uczoge1xuICAgICAgICBlbmFibGVkOiBmYWxzZVxuICAgICAgfVxuICAgIH0pXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgaG9zdDogdHJ1ZVxuICB9LFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBzZXR1cEZpbGVzOiAnLi9zcmMvdGVzdC9zZXR1cC50cydcbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBTXhCLElBQU0sZUFBZTtBQUVyQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BTU4sY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1kLGdCQUFnQjtBQUFBLE1BQ2hCLFVBQVU7QUFBQSxNQUNWLFlBQVk7QUFBQSxNQUNaLGVBQWU7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsUUFDYixXQUFXO0FBQUEsUUFDWCxPQUFPO0FBQUEsUUFDUCxPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssaUJBQWlCLE9BQU8sU0FBUyxNQUFNLFlBQVk7QUFBQSxVQUMxRCxFQUFFLEtBQUssbUJBQW1CLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUM5RCxFQUFFLEtBQUssbUJBQW1CLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUM5RDtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQU1QLGNBQWMsQ0FBQyxzQ0FBc0M7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBUXJELGtCQUFrQjtBQUFBLFFBQ2xCLDBCQUEwQjtBQUFBLFVBQ3hCO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQU9BLHVCQUF1QjtBQUFBLFFBQ3ZCLGNBQWM7QUFBQSxRQUNkLGFBQWE7QUFBQSxNQUNmO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixTQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZO0FBQUEsRUFDZDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
