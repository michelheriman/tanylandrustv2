import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAdminParcelListQuery,
  formatParcelArea,
  formatParcelDate,
  formatParcelMoney,
  getParcelOutline,
  outlineToSvg,
  parcelDetailViewState,
  parcelListViewState,
  readAdminParcelMetricFilters,
} from './adminParcelData.js'

test('parcel query maps only connected controls and keeps pagination explicit', () => {
  assert.deepEqual(buildAdminParcelListQuery({
    page: 2, perPage: 20, search: '  synthetic  ', sort: 'date', direction: 'desc',
    dateFrom: '2026-09-01', dateTo: '',
  }), {
    page: 2, per_page: 20, sort: 'date', direction: 'desc', q: 'synthetic', date_from: '2026-09-01',
  })
})

test('dashboard parcel filters map to the same allowlisted API fields and read from the destination URL', () => {
  assert.deepEqual(buildAdminParcelListQuery({
    page: 1, perPage: 20, search: '', sort: 'date', direction: 'desc', dateFrom: '', dateTo: '',
    sellCategory: 'to_sell', visibility: 'visible', contactedFrom: '2026-09-19T12:00:00+00:00', contactedTo: '2026-10-19T12:00:00+00:00',
  }), {
    page: 1, per_page: 20, sort: 'date', direction: 'desc', sell_category: 'to_sell',
    visibility: 'visible',
    contacted_from: '2026-09-19T12:00:00+00:00', contacted_to: '2026-10-19T12:00:00+00:00',
  })
  assert.deepEqual(readAdminParcelMetricFilters('?sell_category=to_sell&visibility=visible&contacted_from=a&contacted_to=b'), {
    sellCategory: 'to_sell', visibility: 'visible', contactedFrom: 'a', contactedTo: 'b',
  })
  assert.equal(readAdminParcelMetricFilters('?sell_category=unknown').sellCategory, '')
})

test('parcel list states distinguish loading, empty, error, and ready responses', () => {
  assert.deepEqual(parcelListViewState({ loading: true }), { kind: 'loading' })
  assert.deepEqual(parcelListViewState({ loading: false, result: { data: [], pagination: { total: 0 } } }), {
    kind: 'empty', pagination: { total: 0 },
  })
  const failure = { status: 500 }
  assert.deepEqual(parcelListViewState({ loading: false, error: failure }), { kind: 'error', error: failure })
  assert.deepEqual(parcelListViewState({ loading: false, result: { data: [{ id: '1' }], pagination: { total: 1 } } }), {
    kind: 'ready', parcels: [{ id: '1' }], pagination: { total: 1 },
  })
})

test('parcel detail states preserve loading, missing, error and ready outcomes', () => {
  assert.deepEqual(parcelDetailViewState({ loading: true }), { kind: 'loading' })
  assert.deepEqual(parcelDetailViewState({ loading: false, error: { status: 404 } }), { kind: 'notFound' })
  assert.deepEqual(parcelDetailViewState({ loading: false, error: { status: 500 } }), { kind: 'error', error: { status: 500 } })
  const parcel = { id: '12', geojson: null }
  assert.deepEqual(parcelDetailViewState({ loading: false, parcel }), { kind: 'ready', parcel })
})

test('detail formatting and outline use actual supplied values and reject absent geometry', () => {
  const geojson = {
    type: 'Polygon',
    coordinates: [[[47, -18], [48, -18], [48, -19], [47, -18]]],
  }
  const rings = getParcelOutline(geojson)
  assert.equal(rings.length, 1)
  assert.match(outlineToSvg(rings)[0], /^\d+\.\d+,\d+\.\d+/)
  assert.deepEqual(getParcelOutline(null), [])
  assert.equal(formatParcelArea('0.12'), '0.12 ha (1,200 m²)')
  assert.equal(formatParcelArea(null), '—')
  assert.equal(formatParcelMoney('48000000.00', 'MGA'), '48,000,000 MGA')
  assert.equal(formatParcelMoney('not-numeric', 'MGA'), '—')
  assert.notEqual(formatParcelDate('2026-09-12'), '—')
  assert.equal(formatParcelDate('invalid'), '—')
})
