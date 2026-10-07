import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/export': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
  // Production hosting must proxy /api and /export to Flask.
  preview: { proxy: {} },
})
