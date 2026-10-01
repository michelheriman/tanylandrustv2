import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { fileURLToPath } from 'node:url'

const bridgePath = fileURLToPath(new URL('./src/legacy/bridge.js', import.meta.url))
const legacyFiles = [
  'table_manager.html', 'app.js', 'real_add_kml.html', 'test.js',
  'add_kml.html', 'add_kml.js', 'main_market.html', 'main.js',
  'products_details.html', 'prodd.js', 'details_parcel.html', 'details_app.js',
  'legal.html', 'logo_.png',
]
const legacyNames = new Set([...legacyFiles, 'bridge.js', 'signin.html', 'signup.html'])

function legacySource(name) {
  if (name === 'bridge.js') return readFileSync(bridgePath)
  if (name === 'signin.html' || name === 'signup.html') {
    const destination = name === 'signin.html' ? '/signin' : '/signup'
    return Buffer.from(`<!doctype html><meta http-equiv="refresh" content="0;url=${destination}"><a href="${destination}">Continue</a>`)
  }
  const source = readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)))
  if (!name.endsWith('.html')) return source
  return Buffer.from(source.toString('utf8').replace(/<head>/i, '<head><script src="/legacy/bridge.js"></script>'))
}

function legacyPages() {
  return {
    name: 'tany-legacy-pages',
    configureServer(server) {
      server.middlewares.use('/legacy', (request, response, next) => {
        const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '')
        if (!legacyNames.has(name)) return next()
        try {
          response.setHeader('Content-Type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.png') ? 'image/png' : 'text/javascript; charset=utf-8')
          response.end(legacySource(name))
        } catch (error) { next(error) }
      })
    },
    generateBundle() {
      for (const name of legacyNames) this.emitFile({ type: 'asset', fileName: `legacy/${name}`, source: legacySource(name) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyPages()],
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
