import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { apiUrl } from './client.js'

const backendOrigin = 'https://mtk.pythonanywhere.com'

test('Vite development and production modes point to the online Flask origin', async () => {
  for (const filename of ['../../.env.development', '../../.env.localdev', '../../.env.production']) {
    const contents = await readFile(new URL(filename, import.meta.url), 'utf8')
    assert.equal(contents.trim(), `VITE_API_BASE_URL=${backendOrigin}`)
  }
})

test('online API URL construction preserves API and export paths', () => {
  assert.equal(
    apiUrl('/api/current_user', { hostname: 'localhost', port: '5173' }, backendOrigin),
    `${backendOrigin}/api/current_user`,
  )
  assert.equal(
    apiUrl('/export/kml', { hostname: 'localhost', port: '5173' }, backendOrigin),
    `${backendOrigin}/export/kml`,
  )
})

test('Vercel routes direct SPA URLs to the React entry document', async () => {
  const configuration = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert.deepEqual(configuration.rewrites, [{ source: '/(.*)', destination: '/index.html' }])
})
