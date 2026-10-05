import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { apiUrl } from '../api/client.js'
import { createAuthService } from '../auth/authService.js'
import { filterMarketplaceRows, geoReportErrorMessage, geoReportFromResponse, geoReportLookupBody, interestMessageBody, normalizeMarketplaceRows, productFromResponse, productLookupBody } from './marketplaceData.js'

const viteConfig = await readFile(fileURLToPath(new URL('../../vite.config.js', import.meta.url)), 'utf8')

const polygon = { type: 'Polygon', coordinates: [[[47, -18], [48, -18], [48, -17], [47, -18]]] }
const geoReport = {
  elevation: 82,
  max_slope: 2.3,
  avg_slope: 1.1,
  individual_slopes: [0.8, 1.1, 2.3],
  soil_value: [],
  flood: { coordinate: { latitude: -18, longitude: 47 }, forecast: { peak_discharge_m3s: 3 }, statistics: {} },
  climates: { temperature: {}, precipitation: {} },
  proximity: { query: { radius_m: 5000 }, results: {} },
}

test('Marketplace and GeoReport use the configured local Flask API in development', () => {
  assert.equal(apiUrl('/api/market', { hostname: '127.0.0.1', port: '5501' }), 'http://127.0.0.1:5000/api/market')
  assert.equal(apiUrl('/api/market', { hostname: 'localhost', port: '5500' }), 'http://127.0.0.1:5000/api/market')
  assert.equal(apiUrl('/api/market', { hostname: 'localhost', port: '5173' }), '/api/market')
  assert.equal(apiUrl('/api/get_infos', { hostname: 'localhost', port: '5173' }), '/api/get_infos')
  assert.equal(apiUrl('/api/get_infos', { hostname: 'localhost', port: '5501' }), 'http://127.0.0.1:5000/api/get_infos')
  assert.equal(apiUrl('/api/get_infos', { hostname: 'tanylandrustv2.vercel.app', port: '' }), '/api/get_infos')
  assert.match(viteConfig, /'\/api': \{ target: 'http:\/\/127\.0\.0\.1:5000'/)
  assert.doesNotMatch(viteConfig, /geo-report-api|pythonanywhere/)
})

test('Marketplace actions preserve legacy endpoint payloads and use the React session token', async () => {
  let session = { accessToken: 'access-token', refreshToken: 'refresh-token', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write: (next) => { session = next }, clear: () => { session = null } },
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 7, email: 'buyer@example.test' } })
      if (path === '/api/getprodd') return Response.json({ success: true, data: [{ uuid: 'parcel-uuid', owner_uuid: 'owner@example.test', parcel_name: 'Plot' }] })
      if (path === '/api/messages_w') return Response.json({ success: true }, { status: 201 })
      if (path === '/api/get_infos') return Response.json({ success: true, data: [] })
      throw new Error(`Unexpected request ${path}`)
    },
  })
  await auth.restore()
  const productResult = await auth.request('/getprodd', { method: 'POST', body: JSON.stringify(productLookupBody('parcel-uuid')) })
  const product = productFromResponse(productResult)
  assert.equal(product.uuid, 'parcel-uuid')
  assert.deepEqual(JSON.parse(calls[1].options.body), { data: 'parcel-uuid' })
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'), 'Bearer access-token')

  const messageBody = interestMessageBody(product, { email: 'buyer@example.test' }, 'Interested')
  assert.deepEqual(messageBody, { sender_id: 'buyer@example.test', receiver_id: 'owner@example.test', content: 'Interested', uuid_post: 'parcel-uuid', objet: 'buyer@example.test | Plot | owner@example.test' })
  await auth.request('/messages_w', { method: 'POST', body: JSON.stringify(messageBody) })
  assert.equal(calls[2].path, '/api/messages_w')
  assert.equal(new Headers(calls[2].options.headers).get('Authorization'), 'Bearer access-token')
  assert.deepEqual(geoReportLookupBody('parcel-uuid'), { data: 'parcel-uuid' })
})

test('Marketplace retries one 401 through the shared refresh flow and replaces both tokens', async () => {
  let session = { accessToken: 'expired-access', refreshToken: 'valid-refresh', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write: (next) => { session = next }, clear: () => { session = null } },
    fetchImpl: async (path, options = {}) => {
      const authorization = new Headers(options.headers).get('Authorization')
      calls.push({ path, authorization })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 8, email: 'buyer@example.test' } })
      if (path === '/api/market' && authorization === 'Bearer expired-access') {
        return Response.json({ success: false }, { status: 401 })
      }
      if (path === '/api/refresh-token') {
        assert.deepEqual(JSON.parse(options.body), { refresh_token: 'valid-refresh' })
        return Response.json({ success: true, token: 'new-access', refresh_token: 'rotated-refresh' })
      }
      if (path === '/api/market' && authorization === 'Bearer new-access') {
        return Response.json({ success: true, data: [] })
      }
      throw new Error(`Unexpected request ${path}`)
    },
  })
  await auth.restore()
  const result = await auth.request('/market')
  assert.deepEqual(result.data, [])
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', '/api/market', '/api/refresh-token', '/api/market'])
  assert.deepEqual(session, { accessToken: 'new-access', refreshToken: 'rotated-refresh', user: { id: 8, email: 'buyer@example.test', name: '', username: '' } })
})

test('Marketplace rows require real identity and supported polygon geometry', () => {
  const rows = normalizeMarketplaceRows([{ uuid: 'parcel-uuid', parcel_name: 'Plot', geojson: polygon }])
  assert.equal(rows[0].id, 'parcel-uuid')
  assert.throws(() => normalizeMarketplaceRows([{ uuid: 'broken', geojson: '{' }]), /invalid geometry or identity/i)
})

test('Marketplace location filter is a text match against location_name and composes with search', () => {
  const rows = [
    { parcel_name: 'Amber plot', location_name: 'North Lake' },
    { parcel_name: 'Amber field', location_name: 'North Ridge' },
    { parcel_name: 'Amber farm', location_name: 'South Lake' },
    { parcel_name: 'Amber unknown', location_name: null },
  ]
  assert.deepEqual(filterMarketplaceRows(rows, { location: 'north' }).map((row) => row.parcel_name), ['Amber plot', 'Amber field'])
  assert.deepEqual(filterMarketplaceRows(rows, { query: 'field', location: 'north' }).map((row) => row.parcel_name), ['Amber field'])
  assert.deepEqual(filterMarketplaceRows(rows, { location: 'district 1' }), [])
})

test('Marketplace price bounds only compare valid amounts in the selected currency', () => {
  const rows = [
    { parcel_name: 'USD low', price: 90, currency: 'USD' },
    { parcel_name: 'USD match', price: '120', currency: 'usd' },
    { parcel_name: 'USD high', price: 220, currency: 'USD' },
    { parcel_name: 'EUR match', price: 120, currency: 'EUR' },
    { parcel_name: 'Missing price', price: null, currency: 'USD' },
    { parcel_name: 'Missing currency', price: 120 },
  ]
  assert.deepEqual(filterMarketplaceRows(rows, { minPrice: '100', maxPrice: '150', currency: 'USD' }).map((row) => row.parcel_name), ['USD match'])
  assert.deepEqual(filterMarketplaceRows(rows, { minPrice: '100', currency: '' }), [])
  assert.deepEqual(filterMarketplaceRows(rows, { currency: 'EUR' }).map((row) => row.parcel_name), rows.map((row) => row.parcel_name))
  assert.deepEqual(filterMarketplaceRows(rows, { minPrice: '150', maxPrice: '100', currency: 'USD' }), [])
})

test('Marketplace area bounds accept numeric strings and exclude missing or invalid area_ha', () => {
  const rows = [
    { parcel_name: 'Small', area_ha: 0.5 },
    { parcel_name: 'Match', area_ha: '1.75' },
    { parcel_name: 'Large', area_ha: 3 },
    { parcel_name: 'Missing', area_ha: null },
    { parcel_name: 'Invalid', area_ha: 'unknown' },
  ]
  assert.deepEqual(filterMarketplaceRows(rows, { minArea: '1', maxArea: '2' }).map((row) => row.parcel_name), ['Match'])
  assert.deepEqual(filterMarketplaceRows(rows, { minArea: '0.4' }).map((row) => row.parcel_name), ['Small', 'Match', 'Large'])
  assert.deepEqual(filterMarketplaceRows(rows, { minArea: '2', maxArea: '1' }), [])
})

test('Marketplace search, location, price and area filters combine before the existing sort', () => {
  const rows = [
    { parcel_name: 'Amber B', location_name: 'North coast', price: 130, currency: 'USD', area_ha: 2 },
    { parcel_name: 'Amber A', location_name: 'North coast', price: 110, currency: 'USD', area_ha: 1.5 },
    { parcel_name: 'Amber C', location_name: 'North coast', price: 120, currency: 'EUR', area_ha: 2 },
    { parcel_name: 'Other', location_name: 'North coast', price: 120, currency: 'USD', area_ha: 2 },
  ]
  const filtered = filterMarketplaceRows(rows, {
    query: 'amber', location: 'coast', minPrice: '100', maxPrice: '140', currency: 'USD', minArea: '1.75',
  })
  assert.deepEqual(filtered.map((row) => row.parcel_name), ['Amber B'])
})

test('GeoReport accepts serialized or parsed geoinfos, and distinguishes empty and malformed data', () => {
  assert.deepEqual(geoReportFromResponse({ data: [{ geoinfos: JSON.stringify(geoReport) }] }), geoReport)
  assert.deepEqual(geoReportFromResponse({ data: [{ geoinfos: geoReport }] }), geoReport)
  assert.throws(() => geoReportFromResponse({ data: [] }, 'parcel-uuid'), /no record for parcel UUID "parcel-uuid"/i)
  assert.throws(() => geoReportFromResponse({ data: [{ geoinfos: '{' }] }), /not valid JSON/i)
  assert.throws(() => geoReportFromResponse({ data: [{ geoinfos: { flood: {} } }] }), /structure is incomplete/i)
  assert.throws(() => geoReportFromResponse({ data: undefined }), /data list/i)
})

test('GeoReport messages distinguish expired sessions, plan-denial status and network failures', () => {
  assert.equal(geoReportErrorMessage({ kind: 'not_found', parcelUuid: 'parcel-uuid' }, 'fr'), 'Aucun GeoReport disponible pour cette parcelle')
  assert.match(geoReportErrorMessage({ kind: 'auth', status: 401 }), /session has expired/i)
  assert.match(geoReportErrorMessage({ kind: 'server', status: 500 }), /backend uses HTTP 500/i)
  assert.match(geoReportErrorMessage({ kind: 'network' }), /server is unreachable/i)
})
