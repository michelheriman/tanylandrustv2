import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ApiError } from '../api/client.js'

let vite
let AdminUserListView
let AdminUserDetailView

before(async () => {
  vite = await createServer({
    configFile: './vite.config.js',
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;({ AdminUserListView, AdminUserDetailView } = await vite.ssrLoadModule('/src/admin/AdminUserViews.jsx'))
})

after(async () => {
  await vite?.close()
})

function listProps(state) {
  return {
    state, onRetry() {}, onPageChange() {}, onSort() {}, sort: 'date', direction: 'desc',
    search: '', onSearchChange() {}, onSearch(event) { event.preventDefault() },
    dateFrom: '', dateTo: '', onDateChange() {},
  }
}

test('user list renders loading, empty, error and current profile rows without fake accounts', () => {
  const loading = renderToStaticMarkup(React.createElement(AdminUserListView, listProps({ kind: 'loading' })))
  const empty = renderToStaticMarkup(React.createElement(AdminUserListView, listProps({ kind: 'empty', pagination: { total: 0 } })))
  const error = renderToStaticMarkup(React.createElement(AdminUserListView, listProps({ kind: 'error', error: new ApiError('network', 'private') })))
  const ready = renderToStaticMarkup(React.createElement(AdminUserListView, listProps({
    kind: 'ready', users: [{ id: '3', name: 'Synthetic Profile', username: 'sample-user', email: 'sample@example.test', created_at: '2026-09-12' }],
    pagination: { page: 1, pages: 1, total: 1 },
  })))

  assert.match(loading, /role="status"[^>]*>Loading users/)
  assert.match(empty, /No users found\./)
  assert.doesNotMatch(empty, /sample-user/)
  assert.match(error, /role="alert"/)
  assert.match(error, /Unable to reach the server/)
  assert.doesNotMatch(error, /private/)
  assert.match(ready, /sample-user/)
  assert.match(ready, /sample@example\.test/)
  assert.match(ready, /Donnée indisponible/)
  assert.match(ready, /href="\/admin\/users\/3"/)
  assert.match(ready, /button[^>]*disabled/)
})

test('user detail uses actual profile fields and labels unsupported status, activity and parcel association unavailable', () => {
  const user = {
    id: '3', name: 'Synthetic Person', username: 'sample-user', email: 'sample@example.test',
    mobile: '+000000000', account: 'pro', created_at: '2026-09-12T00:00:00Z',
    effective_offer: { code: 'free', parcel_limit: 2, can_delete_owned_parcels: false },
    parcel_association: { available: false, total_associated: null, for_sale_count: null, data: [], pagination: null },
  }
  const markup = renderToStaticMarkup(React.createElement(AdminUserDetailView, {
    state: { kind: 'ready', user }, onRetry() {},
  }))
  const missing = renderToStaticMarkup(React.createElement(AdminUserDetailView, {
    state: { kind: 'notFound' }, onRetry() {},
  }))
  const loading = renderToStaticMarkup(React.createElement(AdminUserDetailView, {
    state: { kind: 'loading' }, onRetry() {},
  }))
  const failed = renderToStaticMarkup(React.createElement(AdminUserDetailView, {
    state: { kind: 'error', error: new ApiError('network', 'private') }, onRetry() {},
  }))

  assert.match(markup, /Synthetic Person/)
  assert.match(markup, /sample@example\.test/)
  assert.match(markup, /\+000000000/)
  assert.match(markup, /Effective offer/)
  assert.match(markup, /<dd>Free<\/dd>/)
  assert.match(markup, /Resolved from current subscriptions/)
  assert.doesNotMatch(markup, /Account plan \(recorded\)|recorded account offer/)
  assert.match(markup, /Last activity: Donnée indisponible/)
  assert.match(markup, /Parcelles associées à l’email actuel \(provisoire\) : Association indisponible/u)
  assert.match(markup, /Annonces à vendre : Association indisponible/u)
  assert.match(markup, /ne prouve pas la propriété historique/u)
  assert.doesNotMatch(markup, /admin\/parcels\//)
  assert.equal((markup.match(/disabled=""/g) || []).length, 3)
  assert.doesNotMatch(markup, /password_hash|refresh_token_hash|local_auth_credentials/)
  assert.match(missing, /User not found/)
  assert.doesNotMatch(missing, /Synthetic Person/)
  assert.match(loading, /role="status"[^>]*>Loading user/)
  assert.match(failed, /role="alert"/)
  assert.match(failed, /Unable to reach the server/)
  assert.doesNotMatch(failed, /private/)
})

test('user detail separates provisional associated parcels from for-sale count and links rows to admin parcel details', () => {
  const user = {
    id: '3', name: 'Synthetic Person', username: 'sample-user', email: 'sample@example.test',
    account: 'free',
    effective_offer: { code: 'pro', parcel_limit: 20, can_delete_owned_parcels: true },
    parcel_association: {
      available: true,
      total_associated: 2,
      for_sale_count: 1,
      data: [
        { id: '31', parcel_name: 'Synthetic parcel A', location_name: 'Test location', sell_category: 'to_sell', created_at: null },
        { id: '32', parcel_name: 'Synthetic parcel B', location_name: 'Other location', sell_category: 'draft', created_at: null },
      ],
      pagination: { page: 1, per_page: 20, total: 2, pages: 1 },
    },
  }
  const markup = renderToStaticMarkup(React.createElement(AdminUserDetailView, {
    state: { kind: 'ready', user }, onRetry() {}, onPageChange() {},
  }))

  assert.match(markup, /<dt>Effective offer<\/dt><dd>Pro<\/dd>/)
  assert.match(markup, /<dt>Parcel limit<\/dt><dd>20<\/dd>/)
  assert.match(markup, /<dt>Can delete own parcels<\/dt><dd>Yes<\/dd>/)
  assert.match(markup, /Parcelles associées à l’email actuel \(provisoire\) : 2/u)
  assert.match(markup, /Annonces à vendre : 1/u)
  assert.match(markup, /Synthetic parcel A/)
  assert.match(markup, /Synthetic parcel B/)
  assert.match(markup, /href="\/admin\/parcels\/31"/)
  assert.match(markup, /href="\/admin\/parcels\/32"/)
  assert.match(markup, /ne prouve pas la propriété historique/u)
})

test('user detail shows a genuine empty result when the unique email has no associated parcels', () => {
  const user = {
    id: '3', name: 'Synthetic Person',
    parcel_association: {
      available: true, total_associated: 0, for_sale_count: 0, data: [],
      pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
    },
  }
  const markup = renderToStaticMarkup(React.createElement(AdminUserDetailView, {
    state: { kind: 'ready', user }, onRetry() {},
  }))

  assert.match(markup, /Annonces à vendre : 0/u)
  assert.match(markup, /Aucune parcelle associée à l’email actuel/u)
  assert.doesNotMatch(markup, /href="\/admin\/parcels\//)
})
