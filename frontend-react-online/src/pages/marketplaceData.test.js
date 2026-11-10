import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { apiUrl } from '../api/client.js'
import { createAuthService } from '../auth/authService.js'
import { filterMarketplaceRows, geoReportErrorMessage, geoReportFromResponse, geoReportLookupBody, hasMarketplaceUuid, interestMessageBody, loadMarketplaceRows, normalizeMarketplaceRows, productFromResponse, productLookupBody } from './marketplaceData.js'

const viteConfig = await readFile(fileURLToPath(new URL('../../vite.config.js', import.meta.url)), 'utf8')
const marketplaceComponent = await readFile(new URL('./Marketplace.jsx', import.meta.url), 'utf8')

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

test('Marketplace visible parcel labels are localized in English and French', () => {
  for (const [english, french] of [
    ["fieldDataManager: 'Field Data Manager'", "fieldDataManager: 'Gestionnaire de données foncières'"],
    ["pricePerM2: 'Price per m²'", "pricePerM2: 'Prix au m²'"],
    ["locationLabel: 'Location'", "locationLabel: 'Localisation'"],
    ["referenceLabel: 'Reference'", "referenceLabel: 'Référence'"],
    ["vendorLabel: 'Vendor'", "vendorLabel: 'Vendeur'"],
    ["priceLabel: 'Price'", "priceLabel: 'Prix'"],
  ]) {
    assert.ok(marketplaceComponent.includes(english), `missing English label: ${english}`)
    assert.ok(marketplaceComponent.includes(french), `missing French label: ${french}`)
  }

  assert.match(marketplaceComponent, /const labels = text\[lang\]/)
  assert.match(marketplaceComponent, /\{labels\.fieldDataManager\}/)
  assert.match(marketplaceComponent, /unitPriceLabel\(row\)/)
  assert.match(marketplaceComponent, /unitPriceLabel\(selectedParcel\)/)
  for (const label of [
    'Surface déclarée', 'Surface déclarée non renseignée', 'Prix total calculé',
    'Prix historique (non recalculé)', 'Declared area', 'Declared area not provided',
    'Calculated total price', 'Historical price (not recalculated)', 'Surface déclarée',
  ]) assert.ok(marketplaceComponent.includes(label), `missing local Marketplace label: ${label}`)
  assert.match(marketplaceComponent, /\{labels\.locationLabel\}/)
  assert.match(marketplaceComponent, /\{labels\.referenceLabel\}/)
})

test('Marketplace localization leaves parcel names, IDs, prices and backend rows untouched', () => {
  const row = {
    uuid: 'parcel-reference-1',
    parcel_name: 'Backend parcel name',
    owner: 'Backend owner',
    price: 1250,
    price_m2: 25,
    currency: 'USD',
    location_name: 'Backend location',
    description: 'Backend description',
    geojson: polygon,
  }
  const [normalized] = normalizeMarketplaceRows([row])

  assert.equal(normalized.uuid, row.uuid)
  assert.equal(normalized.parcel_name, row.parcel_name)
  assert.equal(normalized.owner, row.owner)
  assert.equal(normalized.price, row.price)
  assert.equal(normalized.price_m2, row.price_m2)
  assert.equal(normalized.currency, row.currency)
  assert.equal(normalized.location_name, row.location_name)
  assert.equal(normalized.description, row.description)
  assert.equal(normalized.geojson, row.geojson)
  assert.match(marketplaceComponent, /\{row\.parcel_name \|\| '—'\}/)
  assert.match(marketplaceComponent, /\{row\.uuid \|\| '—'\}/)
  assert.match(marketplaceComponent, /formatPrice\(unitPriceValue\(row\), row\.currency\)/)
})

test('Marketplace and GeoReport use the configured PythonAnywhere API in development', () => {
  assert.equal(apiUrl('/api/market', { hostname: '127.0.0.1', port: '5501' }), 'https://mtk.pythonanywhere.com/api/market')
  assert.equal(apiUrl('/api/market', { hostname: 'localhost', port: '5500' }), 'https://mtk.pythonanywhere.com/api/market')
  assert.equal(apiUrl('/api/market', { hostname: 'localhost', port: '5173' }), '/api/market')
  assert.equal(apiUrl('/api/get_infos', { hostname: 'localhost', port: '5173' }), '/api/get_infos')
  assert.equal(apiUrl('/api/get_infos', { hostname: 'localhost', port: '5501' }), 'https://mtk.pythonanywhere.com/api/get_infos')
  assert.equal(apiUrl('/api/get_infos', { hostname: 'tanylandrustv2.vercel.app', port: '' }), '/api/get_infos')
  assert.match(viteConfig, /port: 5173/)
  assert.doesNotMatch(viteConfig, /proxy:/)
  assert.doesNotMatch(viteConfig, /geo-report-api|pythonanywhere/)
})

test('an explicit PythonAnywhere origin overrides local static-server defaults', () => {
  assert.equal(
    apiUrl('/export/kml', { hostname: 'localhost', port: '5500' }, 'https://mtk.pythonanywhere.com'),
    'https://mtk.pythonanywhere.com/export/kml',
  )
})

test('production API origin is applied to both API and export paths without credentials', () => {
  assert.equal(apiUrl('/api/market', undefined, 'https://api.tany.example'), 'https://api.tany.example/api/market')
  assert.equal(apiUrl('/export/kml', undefined, 'https://api.tany.example'), 'https://api.tany.example/export/kml')
  assert.throws(() => apiUrl('/api/market', undefined, 'https://user:pass@api.tany.example'), /HTTP\(S\) origin/)
  assert.throws(() => apiUrl('/api/market', undefined, 'https://api.tany.example/base'), /without credentials or a path/)
})

test('Marketplace shares one in-flight market load and does not cache completed results', async () => {
  const rows = [{ id: 'plot-1', uuid: 'plot-1', parcel_name: 'Market lot', geojson: polygon }]
  const calls = []
  const resolvers = []
  const request = (path) => {
    calls.push(path)
    return new Promise((resolve) => resolvers.push(resolve))
  }

  const first = loadMarketplaceRows(request)
  const second = loadMarketplaceRows(request)
  assert.strictEqual(first, second)
  await Promise.resolve()
  assert.deepEqual(calls, ['/market'])
  resolvers[0]({ success: true, data: rows })
  const [firstRows, secondRows] = await Promise.all([first, second])
  assert.deepEqual(firstRows, normalizeMarketplaceRows(rows))
  assert.deepEqual(secondRows, firstRows)

  const later = loadMarketplaceRows(request)
  await Promise.resolve()
  assert.deepEqual(calls, ['/market', '/market'])
  resolvers[1]({ success: true, data: rows })
  assert.deepEqual(await later, firstRows)
})

test('Marketplace clears a failed market flight so Retry can issue a new request', async () => {
  const rows = [{ id: 'plot-2', uuid: 'plot-2', parcel_name: 'Retry lot', geojson: polygon }]
  let calls = 0
  const request = () => {
    calls += 1
    return calls === 1
      ? Promise.reject(new Error('temporary marketplace failure'))
      : Promise.resolve({ success: true, data: rows })
  }

  await assert.rejects(loadMarketplaceRows(request), /temporary marketplace failure/)
  assert.deepEqual(await loadMarketplaceRows(request), normalizeMarketplaceRows(rows))
  assert.equal(calls, 2)
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
  assert.equal(Object.hasOwn(messageBody, 'parcel_id'), false)
  await auth.request('/messages_w', { method: 'POST', body: JSON.stringify(messageBody) })
  assert.equal(calls[2].path, '/api/messages_w')
  assert.equal(new Headers(calls[2].options.headers).get('Authorization'), 'Bearer access-token')
  assert.deepEqual(geoReportLookupBody('parcel-uuid'), { data: 'parcel-uuid' })
})

test('Marketplace carries the selected stable parcel ID through detail lookup and first message', async () => {
  let session = { accessToken: 'access-token', refreshToken: 'refresh-token', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write: (next) => { session = next }, clear: () => { session = null } },
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 7, email: 'buyer@example.test' } })
      if (path === '/api/getprodd') return Response.json({ success: true, data: [{ id: '17', uuid: 'duplicate-uuid', owner_uuid: 'owner@example.test', parcel_name: 'Plot' }] })
      if (path === '/api/messages_w') return Response.json({ success: true }, { status: 201 })
      throw new Error(`Unexpected request ${path}`)
    },
  })
  await auth.restore()

  const lookupBody = productLookupBody('duplicate-uuid', 17)
  assert.deepEqual(lookupBody, { data: 'duplicate-uuid', parcel_id: '17' })
  const product = productFromResponse(await auth.request('/getprodd', {
    method: 'POST', body: JSON.stringify(lookupBody),
  }))
  const messageBody = interestMessageBody(product, { email: 'buyer@example.test' }, 'Interested', { localBackend: true })
  assert.deepEqual(messageBody, { parcel_id: '17', content: 'Interested' })
  await auth.request('/messages_w', { method: 'POST', body: JSON.stringify(messageBody) })

  assert.deepEqual(JSON.parse(calls[1].options.body), { data: 'duplicate-uuid', parcel_id: '17' })
  assert.deepEqual(JSON.parse(calls[2].options.body), { parcel_id: '17', content: 'Interested' })
  assert.match(marketplaceComponent, /setTargetParcel\(\{ uuid: row\.uuid, id: row\.id \}\)/)
  assert.match(marketplaceComponent, /productLookupBody\(uuid, parcelId\)/)
})

test('Marketplace refuses to turn an imprecise or out-of-range number into a parcel ID', () => {
  assert.deepEqual(productLookupBody('parcel-uuid', Number.MAX_SAFE_INTEGER + 1), { data: 'parcel-uuid' })
  assert.deepEqual(productLookupBody('parcel-uuid', '9223372036854775808'), { data: 'parcel-uuid' })
  assert.throws(() => productLookupBody('', Number.MAX_SAFE_INTEGER + 1), /stable parcel identity/i)
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

test('Marketplace keeps id-only listings but neutralizes UUID-dependent actions', () => {
  const [row] = normalizeMarketplaceRows([{ id: 17, parcel_name: 'No UUID plot', geojson: polygon }])
  assert.equal(row.id, 17)
  assert.equal(hasMarketplaceUuid(row), false)
  assert.equal(hasMarketplaceUuid({ ...row, uuid: 'parcel-uuid' }), true)
  assert.throws(() => productLookupBody(undefined), /stable parcel identity is required/)
  assert.match(marketplaceComponent, /if \(!hasMarketplaceUuid\(row\)\) return/)
  assert.match(marketplaceComponent, /disabled=\{!hasMarketplaceUuid\(row\)\}/)
  assert.match(marketplaceComponent, /hasMarketplaceUuid\(row\)\s*\?\s*<a className="market-react-report-link"/)
  assert.match(marketplaceComponent, /uuidUnavailable: 'Parcel reference unavailable\.'/)
  assert.match(marketplaceComponent, /uuidUnavailable: '.+indisponible\.'/)
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

test('Marketplace area bounds are in square metres and exclude geometry area fallback', () => {
  const rows = [
    { parcel_name: 'Small', declared_area_ha: 0.5, area_ha: 80 },
    { parcel_name: 'Match', declared_area_ha: '1.75', area_ha: 0.1 },
    { parcel_name: 'Large', declared_area_ha: 3, area_ha: 0.2 },
    { parcel_name: 'Missing', declared_area_ha: null, area_ha: 1.5 },
    { parcel_name: 'Invalid', declared_area_ha: 'unknown', area_ha: 1.5 },
  ]
  assert.deepEqual(filterMarketplaceRows(rows, { minArea: '10000', maxArea: '20000' }).map((row) => row.parcel_name), ['Match'])
  assert.deepEqual(filterMarketplaceRows(rows, { minArea: '4000' }).map((row) => row.parcel_name), ['Small', 'Match', 'Large'])
  assert.deepEqual(filterMarketplaceRows(rows, { minArea: '20000', maxArea: '10000' }), [])
  assert.deepEqual(
    filterMarketplaceRows([{ parcel_name: 'One hectare', declared_area_ha: '1' }], { minArea: '10000', maxArea: '10000' })
      .map((row) => row.parcel_name),
    ['One hectare'],
  )
})

test('normal Marketplace filters use the displayed calculated or historical total and declared area only', () => {
  const rows = [
    { parcel_name: 'New listing', price: 120, price_source: 'calculated', currency: 'USD', area_ha: 20, declared_area_ha: '1.5' },
    { parcel_name: 'Historical listing', price: 130, price_source: 'historical', currency: 'USD', area_ha: 2, declared_area_ha: null },
  ]
  assert.deepEqual(filterMarketplaceRows(rows, {
    minPrice: '119', maxPrice: '121', currency: 'USD',
  }).map((row) => row.parcel_name), ['New listing'])
  assert.deepEqual(filterMarketplaceRows(rows, {
    minArea: '10000',
  }).map((row) => row.parcel_name), ['New listing'])
  assert.equal(filterMarketplaceRows(rows, {
    minPrice: '120', maxPrice: '120', currency: 'USD',
  })[0].price, 120)
  const precise = [{ parcel_name: 'Precise amount', price: '9007199254740993.00', currency: 'USD' }]
  assert.equal(filterMarketplaceRows(precise, {
    minPrice: '9007199254740993', maxPrice: '9007199254740993.00', currency: 'USD',
  })[0].price, '9007199254740993.00')
  assert.deepEqual(filterMarketplaceRows(precise, {
    minPrice: '9007199254740994', currency: 'USD',
  }), [])
  assert.doesNotMatch(marketplaceComponent, /calculated_total_price/)
  assert.match(marketplaceComponent, /Surface déclarée non renseignée/)
  assert.match(marketplaceComponent, /Prix historique \(non recalculé\)/)
  assert.match(marketplaceComponent, /Prix total calculé/)
  assert.match(marketplaceComponent, /product\.price_source === 'calculated'/)
  assert.match(marketplaceComponent, /row\.declared_area_ha == null/)
  assert.match(marketplaceComponent, /Declared area \(m\\u00b2\)/)
  assert.match(marketplaceComponent, /formatAreaSquareMeters\(row\.declared_area_ha/)
  assert.doesNotMatch(marketplaceComponent, /localBackend && <div><dt>\{areaLabel\}/)
  assert.match(marketplaceComponent, /<dt>\{product\.price_source === 'calculated'/)
  assert.match(marketplaceComponent, /<b>\{areaLabel\}:<\/b>/)
})

test('Marketplace search, location, price and area filters combine before the existing sort', () => {
  const rows = [
    { parcel_name: 'Amber B', location_name: 'North coast', price: 130, currency: 'USD', declared_area_ha: 2 },
    { parcel_name: 'Amber A', location_name: 'North coast', price: 110, currency: 'USD', declared_area_ha: 1.5 },
    { parcel_name: 'Amber C', location_name: 'North coast', price: 120, currency: 'EUR', declared_area_ha: 2 },
    { parcel_name: 'Other', location_name: 'North coast', price: 120, currency: 'USD', declared_area_ha: 2 },
  ]
  const filtered = filterMarketplaceRows(rows, {
    query: 'amber', location: 'coast', minPrice: '100', maxPrice: '140', currency: 'USD', minArea: '17500',
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
  assert.equal(geoReportErrorMessage({ kind: 'not_found', parcelUuid: 'parcel-uuid' }, 'fr'), 'Aucun GeoReport n’est disponible pour cette parcelle.')
  assert.match(geoReportErrorMessage({ kind: 'auth', status: 401 }), /session has expired/i)
  assert.equal(geoReportErrorMessage({ kind: 'server', status: 500 }, 'en'), 'GeoReport is temporarily unavailable.')
  assert.match(geoReportErrorMessage({ kind: 'network' }), /Unable to reach the GeoReport server/i)
})
