// noinspection ES6PreferShortImport

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

const isUnminified = process.env.UNMINIFIED === '1'

export default defineConfig({
  build: {
    target: 'es2022', // asked here why: https://github.com/vitejs/vite/discussions/20247
    cssMinify: !isUnminified,
    minify: !isUnminified,
  },
  plugins: [
    //
    tailwindcss(),
    solid(),
    // visualizer({
    //   open: true,
    //   gzipSize: true,
    //   filename: 'dist/stats.html',
    // }),
  ],
  server: {
    port: 3011,
    // fs: {
    //   allow: ['..'],
    // },
    allowedHosts: ['contentkong.hyperknot.com'],
  },
})
