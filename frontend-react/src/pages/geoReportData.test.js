import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import { geoReportErrorMessage, geoReportFromResponse, geoReportLookupBody, loadGeoReport, proximityPlaces } from './geoReportData.js'

const appSource = await readFile(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
const pageSource = await readFile(fileURLToPath(new URL('./GeoReport.jsx', import.meta.url)), 'utf8')
const marketplaceSource = await readFile(fileURLToPath(new URL('./Marketplace.jsx', import.meta.url)), 'utf8')
const reportApiUrl = '/api/get_infos'

// API-shaped test fixture based on the Flask get_info response schema; no UI fallback data is used.
const report = {
  elevation: 1250,
  max_slope: 18.2,
  avg_slope: 6.4,
  individual_slopes: [2, 6.4, 18.2],
  soil_value: [{ name: 'clay', unit_measure: 'g/kg', values: 230 }],
  flood: {
    coordinate: { latitude: -18.9, longitude: 47.5 },
    flood_risk: { level: 'low', description: 'Low risk' },
    forecast: { peak_discharge_m3s: 4.2 },
    statistics: { years_analyzed: 20, history_from: '2000', thresholds_m3s: { 10: 8 } },
    assessed_on: '2026-09-01',
    data_source: 'API source',
  },
  climates: {
    temperature: { overall_mean_c: 20, coldest_month_num: 7, hottest_month_num: 11 },
    precipitation: { avg_yearly_total_mm: 1200, wettest_month_num: 1, wettest_month_avg_mm: 250 },
    rainy_season: { onset: { mean_month: 11 }, end: { mean_month: 3 } },
    data_range: { start: '20000101', end: '20201231' },
  },
  proximity: { query: { radius_m: 5000 }, results: { hospital: [], market: [], transport: [] } },
}

test('GeoReport parses the backend envelope and JSON geoinfos without inventing missing reports', () => {
  assert.deepEqual(geoReportLookupBody('parcel-uuid'), { data: 'parcel-uuid' })
  assert.deepEqual(geoReportFromResponse({ success: true, data: [{ geoinfos: JSON.stringify(report) }] }), report)
  assert.deepEqual(geoReportFromResponse({ success: true, data: [{ geoinfos: report }] }), report)
  assert.throws(() => geoReportFromResponse({ success: true, data: [] }, 'parcel-uuid'), /no record for parcel UUID "parcel-uuid"/)
  assert.throws(() => geoReportFromResponse({ success: true, data: [{ geoinfos: '{' }] }), /not valid JSON/)
  assert.throws(() => geoReportFromResponse({ success: true, data: [{ geoinfos: '{}' }] }), /incomplete or unsupported/)
})

test('GeoReport localizes descriptive unit fragments and return-period text without changing API values', () => {
  const labelsStart = pageSource.indexOf('const labels = {')
  const englishStart = pageSource.indexOf('  en: {', labelsStart)
  const frenchStart = pageSource.indexOf('  fr: {', englishStart)
  const labelsEnd = pageSource.indexOf('function finite', frenchStart)
  const english = pageSource.slice(englishStart, frenchStart)
  const french = pageSource.slice(frenchStart, labelsEnd)

  assert.match(english, /elevationUnit: 'm a\.s\.l\.'/)
  assert.match(english, /averageMinimum: 'avg min'/)
  assert.match(english, /averageMaximum: 'avg max'/)
  assert.match(english, /rainfallRateUnit: 'mm\/year'/)
  assert.match(english, /returnPeriod: '\{period\}-year'/)
  assert.match(french, /elevationUnit: 'm d’altitude'/)
  assert.match(french, /averageMinimum: 'moy\. min'/)
  assert.match(french, /averageMaximum: 'moy\. max'/)
  assert.match(french, /rainfallRateUnit: 'mm\/an'/)
  assert.match(french, /returnPeriod: 'Période de \{period\} ans'/)

  assert.ok(pageSource.includes('unit={t.elevationUnit}'))
  assert.ok(pageSource.includes('unit={t.rainfallRateUnit}'))
  assert.ok(pageSource.includes('unit={`°C ${t.averageMinimum}`}'))
  assert.ok(pageSource.includes('unit={`°C ${t.averageMaximum}`}'))
  assert.ok(pageSource.includes("t.returnPeriod.replace('{period}', period)"))
  assert.equal('{period}-year'.replace('{period}', '10'), '10-year')
  assert.equal('Période de {period} ans'.replace('{period}', '10'), 'Période de 10 ans')

  const parsed = geoReportFromResponse({ success: true, data: [{ geoinfos: JSON.stringify(report) }] })
  assert.deepEqual(parsed, report)
  assert.deepEqual([parsed.elevation, parsed.avg_slope, parsed.climates.precipitation.avg_yearly_total_mm], [1250, 6.4, 1200])
  assert.ok(pageSource.includes('m³/s'))
  assert.ok(pageSource.includes('`${number(place.distanceKm, 2)} km`'))
})

test('GeoReport displays every place and converts each backend proximity distance to kilometers', () => {
  const apiResponse = {
    success: true,
    data: [{
      uuid_parcel: '3508650a-3afa-4510-baed-e79c9792a81f',
      geoinfos: JSON.stringify({
        ...report,
        proximity: {
          query: { radius_m: 5000 },
          results: {
            hospital: [
              { name: 'Hospital A', distance_m: 3400 },
              { name: 'Hospital B', distance_m: 875 },
            ],
            market: [
              { name: 'Market A', distance_m: 1325 },
              { name: 'Market B', distance_m: 2400 },
              { name: 'Market C', distance_m: 810 },
            ],
            transport: [
              { name: 'Transport A', distance_m: 420 },
              { name: 'Transport B', distance_m: 1560 },
            ],
          },
        },
      }),
    }],
  }
  const parsed = geoReportFromResponse(apiResponse, apiResponse.data[0].uuid_parcel)

  assert.deepEqual(proximityPlaces(parsed.proximity.results, 'hospital'), [
    { name: 'Hospital A', distanceKm: 3.4 },
    { name: 'Hospital B', distanceKm: 0.875 },
  ])
  assert.deepEqual(proximityPlaces(parsed.proximity.results, 'market'), [
    { name: 'Market A', distanceKm: 1.325 },
    { name: 'Market B', distanceKm: 2.4 },
    { name: 'Market C', distanceKm: 0.81 },
  ])
  assert.deepEqual(proximityPlaces(parsed.proximity.results, 'transport'), [
    { name: 'Transport A', distanceKm: 0.42 },
    { name: 'Transport B', distanceKm: 1.56 },
  ])
  assert.equal(proximityPlaces({ hospital: [] }, 'hospital'), null)
  assert.equal(proximityPlaces({}, 'hospital'), null)
  assert.deepEqual(proximityPlaces({ hospital: null }, 'hospital'), { invalid: true })
  assert.match(pageSource, /proximityPlaces\(proximity\.results, key\)/)
  assert.match(pageSource, /places\.map\(\(place, index\)/)
  assert.match(pageSource, /\$\{number\(place\.distanceKm, 2\)\} km/)
})

test('Marketplace UUIDs pass through the React route and GeoReport request without substitution', async () => {
  const marketplaceParcelUuid = '3508650a-3afa-4510-baed-e79c9792a81f'
  const otherParcelUuid = '5a667a31-c67c-4f87-8f1e-acd904dea05f'
  const calls = []
  const request = async (_path, options) => {
    calls.push(JSON.parse(options.body))
    return { success: true, data: [] }
  }

  assert.match(marketplaceSource, /href=\{`\/georeport\/\$\{encodeURIComponent\(row\.uuid\)\}`\}/)
  await assert.rejects(loadGeoReport(request, marketplaceParcelUuid), /no record for parcel UUID "3508650a-3afa-4510-baed-e79c9792a81f"/)
  await assert.rejects(loadGeoReport(request, otherParcelUuid), /no record for parcel UUID "5a667a31-c67c-4f87-8f1e-acd904dea05f"/)
  assert.deepEqual(calls, [{ data: marketplaceParcelUuid }, { data: otherParcelUuid }])
  assert.match(pageSource, /error\.kind === 'not_found' \? t\.noReport : t\.errorTitle/)
})

test('GeoReport calls the existing protected route through the shared authenticated client', async () => {
  let session = { accessToken: 'access-test', refreshToken: 'refresh-test', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write: (next) => { session = next }, clear: () => { session = null } },
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, authorization: new Headers(options.headers).get('Authorization'), body: options.body })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 1 } })
      if (path === reportApiUrl) return Response.json({ success: true, data: [{ geoinfos: JSON.stringify(report) }] })
      throw new Error(`Unexpected request ${path}`)
    },
  })
  await auth.restore()
  const result = await loadGeoReport(auth.request, 'parcel-uuid')
  assert.equal(result.flood.coordinate.latitude, -18.9)
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', reportApiUrl])
  assert.equal(calls[1].authorization, 'Bearer access-test')
  assert.deepEqual(JSON.parse(calls[1].body), { data: 'parcel-uuid' })
})

test('concurrent StrictMode GeoReport loads share one network request', async () => {
  let resolveResponse
  let requestCount = 0
  const responsePromise = new Promise((resolve) => { resolveResponse = resolve })
  const request = async (path, options) => {
    requestCount += 1
    assert.equal(path, '/get_infos')
    assert.deepEqual(JSON.parse(options.body), { data: 'same-parcel' })
    return responsePromise
  }

  const firstLoad = loadGeoReport(request, 'same-parcel')
  const secondLoad = loadGeoReport(request, 'same-parcel')
  assert.equal(firstLoad, secondLoad)
  assert.equal(requestCount, 1)

  resolveResponse({ success: true, data: [{ geoinfos: JSON.stringify(report) }] })
  const [firstReport, secondReport] = await Promise.all([firstLoad, secondLoad])
  assert.deepEqual(firstReport, report)
  assert.deepEqual(secondReport, report)
  assert.equal(requestCount, 1)
})

test('a concurrent GeoReport HTTP 500 is shared without masking or retrying it', async () => {
  let requestCount = 0
  const failure = Object.assign(new Error('Server error'), { status: 500 })
  const request = async () => {
    requestCount += 1
    throw failure
  }

  const firstLoad = loadGeoReport(request, 'server-error-parcel')
  const secondLoad = loadGeoReport(request, 'server-error-parcel')
  assert.equal(firstLoad, secondLoad)
  await assert.rejects(firstLoad, (error) => error === failure && error.status === 500)
  await assert.rejects(secondLoad, (error) => error === failure && error.status === 500)
  assert.equal(requestCount, 1)
})

test('GeoReport reuses the shared one-time refresh flow for an expired access token', async () => {
  let session = { accessToken: 'expired-access', refreshToken: 'valid-refresh', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write: (next) => { session = next }, clear: () => { session = null } },
    fetchImpl: async (path, options = {}) => {
      const authorization = new Headers(options.headers).get('Authorization')
      calls.push({ path, authorization })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 1 } })
      if (path === reportApiUrl && authorization === 'Bearer expired-access') return Response.json({ success: false }, { status: 401 })
      if (path === '/api/refresh-token') return Response.json({ success: true, token: 'renewed-access', refresh_token: 'rotated-refresh' })
      if (path === reportApiUrl && authorization === 'Bearer renewed-access') return Response.json({ success: true, data: [{ geoinfos: JSON.stringify(report) }] })
      throw new Error(`Unexpected request ${path}`)
    },
  })
  await auth.restore()
  assert.equal((await loadGeoReport(auth.request, 'parcel-uuid')).elevation, report.elevation)
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', reportApiUrl, '/api/refresh-token', reportApiUrl])
  assert.deepEqual(session, { accessToken: 'renewed-access', refreshToken: 'rotated-refresh', user: null })
})

test('the app protects a dedicated GeoReport route and the page bundles local Leaflet', () => {
  assert.match(appSource, /GeoReport from '\.\/pages\/GeoReport\.jsx'/)
  assert.match(appSource, /georeport\\\/\(\[\^\/\]\+\)/)
  assert.match(appSource, /<GeoReport parcelUuid=\{parcelUuid\}/)
  assert.match(marketplaceSource, /href=\{`\/georeport\/\$\{encodeURIComponent\(row\.uuid\)\}`\}/)
  assert.match(pageSource, /from 'leaflet'/)
  assert.match(pageSource, /leaflet\/dist\/leaflet\.css/)
  assert.doesNotMatch(pageSource, /unpkg\.com\/leaflet/)
})

test('GeoReport errors are localized, neutral, and omit internal details', () => {
  const uuid = '3508650a-3afa-4510-baed-e79c9792a81f'
  const noReport = Object.assign(new Error(`The GeoReport API returned no record for parcel UUID "${uuid}".`), {
    kind: 'not_found',
    parcelUuid: uuid,
  })

  for (const lang of ['fr', 'en']) {
    const message = geoReportErrorMessage(noReport, lang)
    assert.doesNotMatch(message, new RegExp(uuid))
    assert.match(message, /GeoReport/i)
  }
  assert.equal(geoReportErrorMessage(noReport, 'fr'), 'Aucun GeoReport n’est disponible pour cette parcelle.')
  assert.equal(geoReportErrorMessage(noReport, 'en'), 'No GeoReport is available for this parcel.')

  for (const status of [500, 503]) {
    assert.equal(geoReportErrorMessage({ kind: 'server', status, message: 'raw backend body' }, 'fr'), 'Le GeoReport est temporairement indisponible.')
    assert.equal(geoReportErrorMessage({ kind: 'server', status, message: 'raw backend body' }, 'en'), 'GeoReport is temporarily unavailable.')
  }
  assert.equal(geoReportErrorMessage({ status: 401 }, 'fr'), 'Votre session a expiré. Reconnectez-vous pour consulter ce GeoReport.')
  assert.equal(geoReportErrorMessage({ status: 401 }, 'en'), 'Your session has expired. Sign in again to view this GeoReport.')
  assert.equal(geoReportErrorMessage({ status: 403 }, 'fr'), 'Un compte Pro est nécessaire pour consulter ce GeoReport.')
  assert.equal(geoReportErrorMessage({ status: 403 }, 'en'), 'A Pro account is required to view this GeoReport.')
  assert.equal(geoReportErrorMessage({ status: 404 }, 'fr'), 'La ressource GeoReport demandée est introuvable.')
  assert.equal(geoReportErrorMessage({ status: 404 }, 'en'), 'The requested GeoReport resource was not found.')
  assert.equal(geoReportErrorMessage({ kind: 'network', message: 'fetch failed' }, 'fr'), 'Impossible de contacter le serveur GeoReport. Vérifiez votre connexion puis réessayez.')
  assert.equal(geoReportErrorMessage({ kind: 'network', message: 'fetch failed' }, 'en'), 'Unable to reach the GeoReport server. Check your connection and try again.')
  assert.equal(geoReportErrorMessage({ kind: 'protocol', message: 'internal parser detail' }, 'fr'), 'Le serveur a renvoyé une réponse GeoReport invalide.')
  assert.equal(geoReportErrorMessage({ kind: 'protocol', message: 'internal parser detail' }, 'en'), 'The server returned an invalid GeoReport response.')
  assert.equal(geoReportErrorMessage(new Error(`The GeoReport geoinfos value is not valid JSON for ${uuid}`), 'en'), 'Unable to load the GeoReport. Please try again.')
  assert.match(pageSource, /geoReportErrorMessage\(error, lang\)/)
  assert.doesNotMatch(pageSource, /<p>\{error\.message\}<\/p>/)
})
