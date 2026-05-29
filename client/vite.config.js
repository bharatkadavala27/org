import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'શ્રી સગર જ્ઞાતિ સમાજ, જૂનાગઢ',
        short_name: 'સગર સમાજ',
        description: 'Samuh Lagna & Fund Management App',
        theme_color: '#b91c1c',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: { port: 5173, host: true },
  // relative base so the Capacitor APK can load assets from the file system
  base: './',
});
