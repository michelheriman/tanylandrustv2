import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { mountAdminParcelMap, parseAdminParcelMapGeometry } from './adminParcelMap.js'

const polygon = {
  type: 'Polygon',
  coordinates: [[[47, -18], [48, -18], [48, -19], [47, -19], [47, -18]]],
}

test('admin map accepts valid Polygon, Feature and MultiPolygon GeoJSON', () => {
  assert.deepEqual(parseAdminParcelMapGeometry(polygon), polygon)
  assert.deepEqual(parseAdminParcelMapGeometry(JSON.stringify({ type: 'Feature', properties: {}, geometry: polygon })), polygon)
  assert.equal(parseAdminParcelMapGeometry({
    type: 'MultiPolygon',
    coordinates: [polygon.coordinates, [[[49, -18], [50, -18], [50, -19], [49, -19], [49, -18]]]],
  }).type, 'MultiPolygon')
})

test('admin map rejects absent, malformed, open, out-of-range and non-polygon GeoJSON', () => {
  assert.equal(parseAdminParcelMapGeometry(null), null)
  assert.equal(parseAdminParcelMapGeometry('not json'), null)
  assert.equal(parseAdminParcelMapGeometry({ type: 'LineString', coordinates: [[47, -18], [48, -19]] }), null)
  assert.equal(parseAdminParcelMapGeometry({ type: 'Polygon', coordinates: [[[47, -18], [48, -18], [48, -19], [47, -19]]] }), null)
  assert.equal(parseAdminParcelMapGeometry({
    type: 'Polygon', coordinates: [[[47, -18], [181, -18], [48, -19], [47, -18]]],
  }), null)
})

test('admin map draws the parcel boundary over the existing basemap and fits its bounds without scroll gestures', () => {
  const calls = {}
  const map = {
    fitBounds(bounds, options) { calls.fit = { bounds, options }; return this },
    remove() { calls.removed = true },
  }
  const bounds = { isValid: () => true }
  const layer = {
    addTo(target) { calls.geoJsonAddedTo = target; return this },
    getBounds: () => bounds,
  }
  const L = {
    map(host, options) { calls.host = host; calls.options = options; return map },
    tileLayer(url, options) {
      calls.tile = { url, options }
      return { addTo(target) { calls.tileAddedTo = target } }
    },
    geoJSON(feature, options) { calls.feature = feature; calls.style = options; return layer },
  }
  const host = {}

  const result = mountAdminParcelMap(L, host, polygon)

  assert.equal(result.map, map)
  assert.equal(calls.host, host)
  assert.equal(calls.options.scrollWheelZoom, false)
  assert.equal(calls.options.dragging, false)
  assert.equal(calls.options.touchZoom, false)
  assert.equal(calls.options.zoomControl, true)
  assert.equal(calls.tile.url, 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
  assert.equal(calls.tile.options.attribution, 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community')
  assert.deepEqual(calls.feature.geometry, polygon)
  assert.deepEqual(calls.fit, { bounds, options: { padding: [20, 20], maxZoom: 17 } })
  assert.equal(calls.style.interactive, false)
  assert.deepEqual(calls.style.style, { color: '#f0d57c', weight: 3, fillColor: '#d7b555', fillOpacity: 0.2 })
})

test('admin satellite layer matches the main map satellite basemap source', async () => {
  const mainMap = await readFile(new URL('../pages/ParcelMap.jsx', import.meta.url), 'utf8')
  const adminMap = await readFile(new URL('./adminParcelMap.js', import.meta.url), 'utf8')
  assert.match(mainMap, /new Map\(\{ basemap: 'satellite' \}\)/)
  assert.match(adminMap, /World_Imagery\/MapServer\/tile/)
  assert.doesNotMatch(adminMap, /openstreetmap\.org/)
})

test('admin map refuses an invalid Leaflet extent and removes the empty map', () => {
  const calls = { removed: false }
  const map = { remove() { calls.removed = true }, fitBounds() { assert.fail('invalid bounds must not be fitted') } }
  const L = {
    map: () => map,
    tileLayer: () => ({ addTo() {} }),
    geoJSON: () => ({ addTo() { return this }, getBounds: () => ({ isValid: () => false }) }),
  }
  assert.equal(mountAdminParcelMap(L, {}, polygon), null)
  assert.equal(calls.removed, true)
})
