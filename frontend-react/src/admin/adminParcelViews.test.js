import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ApiError } from '../api/client.js'

let vite
let AdminParcelListView
let AdminParcelDetailView
let AdminParcelMap

before(async () => {
  vite = await createServer({
    configFile: './vite.config.js',
    mode: 'localdev',
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;({ AdminParcelListView, AdminParcelDetailView } = await vite.ssrLoadModule('/src/admin/AdminParcelViews.jsx'))
  ;({ default: AdminParcelMap } = await vite.ssrLoadModule('/src/admin/AdminParcelMap.jsx'))
})

after(async () => {
  await vite?.close()
})

test('parcel list visibly handles loading, empty and error states without sample rows', () => {
  const controls = {
    onRetry() {}, onPageChange() {}, onSort() {}, sort: 'date', direction: 'desc',
    search: '', onSearchChange() {}, onSearch(event) { event.preventDefault() },
    dateFrom: '', dateTo: '', onDateChange() {},
  }
  const loading = renderToStaticMarkup(React.createElement(AdminParcelListView, {
    ...controls, state: { kind: 'loading' },
  }))
  const empty = renderToStaticMarkup(React.createElement(AdminParcelListView, {
    ...controls, state: { kind: 'empty', pagination: { total: 0 } },
  }))
  const error = renderToStaticMarkup(React.createElement(AdminParcelListView, {
    ...controls, state: { kind: 'error', error: new ApiError('network', 'hidden diagnostic') },
  }))

  assert.match(loading, /role="status"[^>]*>Loading parcels/)
  assert.match(empty, /No parcels found\./)
  assert.doesNotMatch(empty, /Synthetic parcel|tbody><tr/)
  assert.match(error, /role="alert"/)
  assert.match(error, /Unable to reach the server/)
  assert.doesNotMatch(error, /hidden diagnostic/)
})

test('parcel detail renders returned fields and actual GeoJSON, and handles a missing parcel', () => {
  const parcel = {
    id: '82', parcel_name: 'Synthetic parcel', owner: 'Synthetic owner',
    location_name: 'Test location', description: 'Test description', area_ha: '0.12',
    price: '48000000', price_m2: '40000', currency: 'MGA', sell_category: 'to_sell',
    created_at: '2026-09-12T00:00:00Z', longitude: 47.5, latitude: -18.9,
    status_category: 'available',
    visibility: { is_hidden: false, reason: null, changed_at: null, changed_by_admin_id: null },
    visibility_history: [], visibility_history_truncated: false,
    geojson: { type: 'Polygon', coordinates: [[[47, -18], [48, -18], [48, -19], [47, -18]]] },
  }
  const markup = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    state: { kind: 'ready', parcel }, id: parcel.id, onRetry() {},
  }))
  const missing = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    state: { kind: 'notFound' }, id: '999', onRetry() {},
  }))

  assert.match(markup, /Synthetic parcel/)
  assert.match(markup, /Synthetic owner/)
  assert.match(markup, /Total price/)
  assert.match(markup, /Plot outline/)
  assert.match(markup, /Marketplace visibility/)
  assert.match(markup, /Hide from Marketplace/)
  assert.match(markup, /<polygon/)
  assert.doesNotMatch(markup, /owner_uuid|admin-image-glyph/)
  assert.match(missing, /Parcel not found/)
  assert.doesNotMatch(missing, /Synthetic parcel/)
})

test('admin parcel map renders only for valid GeoJSON and shows the unavailable state otherwise', () => {
  const validGeoJson = JSON.stringify({
    type: 'Polygon',
    coordinates: [[[47, -18], [48, -18], [48, -19], [47, -18], [47, -18]]],
  })
  const valid = renderToStaticMarkup(React.createElement(AdminParcelMap, { geojson: validGeoJson }))
  const missing = renderToStaticMarkup(React.createElement(AdminParcelMap, { geojson: null }))
  const invalid = renderToStaticMarkup(React.createElement(AdminParcelMap, { geojson: '{broken json' }))

  assert.match(valid, /class="admin-parcel-map" role="img" aria-label="Map showing the parcel boundary"/)
  assert.match(missing, /Carte indisponible/)
  assert.match(invalid, /Carte indisponible/)
  assert.doesNotMatch(missing + invalid, /class="admin-parcel-map"/)
})

test('parcel detail shows manual hide state and its reasoned decision history', () => {
  const parcel = {
    id: '83', parcel_name: 'Synthetic parcel', sell_category: 'to_sell',
    visibility: { is_hidden: true, reason: 'Reviewed report', changed_at: '2026-10-19T12:00:00Z', changed_by_admin_id: '9' },
    visibility_history: [{ id: '3', action: 'hide', admin_id: '9', reason: 'Reviewed report', created_at: '2026-10-19T12:00:00Z' }],
    visibility_history_truncated: false,
  }
  const markup = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    state: { kind: 'ready', parcel }, id: parcel.id, onRetry() {},
    visibilityReason: 'Restore after review', onReasonChange() {}, onVisibilityAction() {},
  }))

  assert.match(markup, /This listing is manually hidden from the Marketplace/)
  assert.match(markup, /Last decision: Reviewed report/)
  assert.match(markup, /Restore visibility/)
  assert.match(markup, /Admin ID 9/)
  assert.match(markup, /Restore after review/)
  assert.match(markup, /Restoring visibility does not change that category/)
})

test('loaded parcel detail shows Delete parcel in Vite local mode and hides it outside local mode', () => {
  const parcel = {
    id: '84', parcel_name: 'Synthetic parcel', sell_category: 'to_sell',
    visibility: { is_hidden: false, reason: null }, visibility_history: [],
  }
  const base = { state: { kind: 'ready', parcel }, id: parcel.id, onRetry() {} }
  const supabase = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    ...base, localBackend: false,
  }))
  const local = renderToStaticMarkup(React.createElement(AdminParcelDetailView, base))
  assert.doesNotMatch(supabase, /Delete parcel|Confirm deletion/)
  assert.match(local, /<h2 id="admin-parcel-delete-title">Delete parcel<\/h2>/)
  assert.match(local, /<button class="admin-parcel-delete-button"[^>]*>Delete parcel<\/button>/)
  assert.ok(local.indexOf('admin-parcel-delete-panel') < local.indexOf('admin-parcel-detail-grid'))
  assert.doesNotMatch(local, /Confirm permanent removal/)
  assert.doesNotMatch(local, /parcel_snapshot|deleted_parcels/)

  const confirmation = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    ...base, deleteOpen: true, deleteReason: '',
  }))
  assert.match(confirmation, /Confirm permanent removal/)
  assert.match(confirmation, /complete record and the responsible admin are retained/)
  assert.match(confirmation, /Reason \(required, up to 1000 characters\)/)
  assert.match(confirmation, /disabled=""[^>]*>Confirm deletion/)
  assert.match(confirmation, />Cancel</)
})

test('admin deletion confirmation calls the endpoint only from the confirm handler and success offers a fresh list', async () => {
  const source = await readFile(new URL('./AdminParcelViews.jsx', import.meta.url), 'utf8')
  assert.match(source, /onClick=\{onDeleteConfirm\}/)
  assert.match(source, /await deleteAdminParcel\(request, id, deleteReason, \{ confirmed: true \}\)/)
  assert.match(source, /deleteFlightRef\.current = true/)
  assert.match(source, /onDeleteCancel=\{\(\) => \{ if \(!deletePending && !deleteFlightRef\.current\)/)
  const complete = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    state: { kind: 'ready', parcel: { id: '85' } }, id: '85', localBackend: true, deleteComplete: true,
  }))
  assert.match(complete, /Parcel deleted/)
  assert.match(complete, /href="\/admin\/parcels"/)
  assert.doesNotMatch(complete, /parcel_snapshot|deleted_parcels|Synthetic/)
})
