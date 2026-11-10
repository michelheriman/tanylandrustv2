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
    declared_area_ha: '1.2', declared_price_m2: '40000', price_source: 'calculated',
    price: '480000000', price_m2: null, currency: 'MGA', sell_category: 'to_sell',
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
  assert.match(markup, /Declared surface/)
  assert.match(markup, /Geometry area/)
  assert.match(markup, /Calculated total price/)
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

  const frenchMissing = renderToStaticMarkup(React.createElement(AdminParcelMap, { geojson: null, lang: 'fr' }))
  const frenchInvalid = renderToStaticMarkup(React.createElement(AdminParcelMap, { geojson: '{broken json', lang: 'fr' }))
  assert.match(valid, /class="admin-parcel-map" role="img" aria-label="Map showing the parcel boundary"/)
  assert.match(missing, /Map unavailable/)
  assert.match(invalid, /Map unavailable/)
  assert.match(frenchMissing, /Carte indisponible/)
  assert.match(frenchInvalid, /Carte indisponible/)
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

test('parcel detail labels follow the selected French language', () => {
  const markup = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    state: { kind: 'ready', parcel: { id: '86', parcel_name: 'Synthetic parcel', geojson: null, visibility: { is_hidden: false }, visibility_history: [] } },
    id: '86', lang: 'fr', onRetry() {}, visibilityNotice: 'The listing is hidden from the Marketplace.',
  }))
  assert.match(markup, /Retour à la liste/)
  assert.match(markup, /Supprimer la parcelle/)
  assert.match(markup, /Informations personnelles/)
  assert.match(markup, /Surface déclarée/)
  assert.match(markup, /Visibilité sur le Marketplace/)
  assert.match(markup, /L’annonce est masquée du Marketplace/)
  assert.match(markup, /Carte indisponible/)
  assert.doesNotMatch(markup, /Delete parcel|Personal information|Marketplace visibility/)
})

test('loaded parcel detail exposes the archive action for the new online backend as well as local mode', () => {
  const parcel = {
    id: '84', parcel_name: 'Synthetic parcel', sell_category: 'to_sell',
    declared_area_ha: '1.25000000', declared_price_m2: '4.50',
    area_ha: '1.10000000', price: '56250.00', price_source: 'calculated',
    price_m2: '4.50', currency: 'USD',
    visibility: { is_hidden: false, reason: null }, visibility_history: [],
  }
  const base = { state: { kind: 'ready', parcel }, id: parcel.id, onRetry() {} }
  const supabase = renderToStaticMarkup(React.createElement(AdminParcelDetailView, {
    ...base, localBackend: false,
  }))
  const local = renderToStaticMarkup(React.createElement(AdminParcelDetailView, base))
  assert.match(supabase, /<h2 id="admin-parcel-delete-title">Delete parcel<\/h2>/)
  assert.match(supabase, /Declared surface/)
  assert.match(supabase, /Geometry area/)
  assert.match(supabase, /Calculated total price/)
  assert.match(supabase, /Price per m/)
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

test('visibility success applies the returned decision locally without a second detail read', async () => {
  const source = await readFile(new URL('./AdminParcelViews.jsx', import.meta.url), 'utf8')
  const handler = source.match(/async function submitVisibilityAction\(action\) \{([\s\S]*?)\r?\n[\x20]{2}\}\r?\n\r?\n[\x20]{2}async function confirmDelete/)
  assert.ok(handler)
  assert.match(handler[1], /await hideAdminParcel\(request, id, visibilityReason\)/)
  assert.match(handler[1], /await restoreAdminParcel\(request, id, visibilityReason\)/)
  assert.match(handler[1], /applyAdminParcelVisibilityDecision\(current\.parcel, decision\)/)
  assert.doesNotMatch(handler[1], /setRetry\(/)
})
