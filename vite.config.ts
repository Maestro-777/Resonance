import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: { alias: { '@': projectRoot } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Resonance',
        short_name: 'Resonance',
        description: 'Твоя музыка. Твоё пространство.',
        theme_color: '#111318',
        background_color: '#111318',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.startsWith('/api/stream/'), handler: 'NetworkOnly' },
          { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly' },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', '.ts.net'],
    proxy: { '/api': { target: 'http://127.0.0.1:4317', changeOrigin: true } },
  },
  preview: { host: '127.0.0.1' },
})
