import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Prevent service worker caching from hiding UI changes in development.
      // (Backend and data APIs still behave normally; only SW caching is disabled.)
      devOptions: { enabled: false },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Central and Southern African CPD Hub',
        short_name: 'CPD Hub',
        description: 'Continuing Professional Development for Central and Southern Africa\'s healthcare professionals',
        theme_color: '#14b8a6',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Production API
            urlPattern: /^https:\/\/api\.zimhealthcpd\.co\.zw\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
          {
            // Development API (localhost:4000)
            urlPattern: /^http:\/\/localhost:4000\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache-dev',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    exclude: [...configDefaults.exclude, '**/e2e/**'],
    passWithNoTests: true,
  },
  server: { port: 3000 },
});
