import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ApiError } from '../api/client.js'

let vite
let AdminConversationListView
let AdminConversationDetailView
let AdminConversationReportsView

before(async () => {
  vite = await createServer({
    configFile: './vite.config.js',
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;({ AdminConversationListView, AdminConversationDetailView, AdminConversationReportsView } = await vite.ssrLoadModule('/src/admin/AdminConversationViews.jsx'))
})

after(async () => {
  await vite?.close()
})

test('conversation list renders loading, empty, error and returned rows without sample data', () => {
  const loading = renderToStaticMarkup(React.createElement(AdminConversationListView, {
    state: { kind: 'loading' }, onRetry() {}, onPageChange() {},
  }))
  const empty = renderToStaticMarkup(React.createElement(AdminConversationListView, {
    state: { kind: 'empty', unlinkedHistoryExcluded: true, pagination: { page: 1, pages: 1, total: 0 } },
    onRetry() {}, onPageChange() {},
  }))
  const error = renderToStaticMarkup(React.createElement(AdminConversationListView, {
    state: { kind: 'error', error: new ApiError('network', 'private SQL details') }, onRetry() {}, onPageChange() {},
  }))
  const ready = renderToStaticMarkup(React.createElement(AdminConversationListView, {
    state: {
      kind: 'ready', unlinkedHistoryExcluded: true,
      pagination: { page: 1, pages: 1, total: 1 },
      conversations: [{
        conversation_id: '73', parcel_id: '42', parcel_name: 'Synthetic parcel',
        participants: [
          { profile_id: '31', name: 'Synthetic buyer', username: 'buyer-test' },
          { profile_id: '32', name: 'Synthetic seller', username: 'seller-test' },
        ],
        last_message: { id: '99', content: 'Linked preview', created_at: '2026-10-15T09:00:00Z' },
      }],
    }, onRetry() {}, onPageChange() {},
  }))

  assert.match(loading, /role="status"[^>]*>Loading conversations/)
  assert.match(empty, /No conversations found\./)
  assert.match(empty, /Unlinked historical messages are excluded/)
  assert.match(error, /role="alert"/)
  assert.doesNotMatch(error, /private SQL details/)
  assert.match(ready, /Synthetic parcel/)
  assert.match(ready, /Synthetic buyer/)
  assert.match(ready, /Linked preview/)
  assert.match(ready, /href="\/admin\/conversations\/73"/)
  assert.match(ready, /Unlinked historical messages are excluded/)
  assert.doesNotMatch(ready, /Unlinked historical message content/)
})

test('first-response list announces its filter and internal finding list has explicit empty and linked states', () => {
  const filtered = renderToStaticMarkup(React.createElement(AdminConversationListView, {
    state: { kind: 'empty', pagination: { page: 1, per_page: 20, total: 0, pages: 1 }, unlinkedHistoryExcluded: true },
    awaitingFirstResponse: true, onRetry() {}, onPageChange() {},
  }))
  const empty = renderToStaticMarkup(React.createElement(AdminConversationReportsView, {
    state: { kind: 'empty', pagination: { page: 1, per_page: 20, total: 0, pages: 1 }, period: {} }, onRetry() {}, onPageChange() {},
  }))
  const ready = renderToStaticMarkup(React.createElement(AdminConversationReportsView, {
    state: {
      kind: 'ready', pagination: { page: 1, per_page: 20, total: 1, pages: 1 }, period: {},
      reports: [{ id: '52', conversation_id: '73', finding: 'Synthetic finding', created_at: '2026-10-19T12:00:00Z', parcel_id: null, parcel_name: null }],
    }, onRetry() {}, onPageChange() {},
  }))
  assert.match(filtered, /exactly two participants/)
  assert.match(filtered, /href="\/admin\/conversations"/)
  assert.match(empty, /No findings recorded during this period/)
  assert.match(ready, /Synthetic finding/)
  assert.match(ready, /href="\/admin\/conversations\/73"/)
  assert.match(ready, /does not indicate whether a finding has been processed/)
})

test('conversation detail renders linked content, unavailable parcel fields, 404, loading and safe errors', () => {
  const loading = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'loading' }, reportState: { kind: 'loading' }, onRetry() {},
  }))
  const missing = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'notFound' }, onRetry() {},
  }))
  const error = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'error', error: new ApiError('network', 'private diagnostics') }, onRetry() {},
  }))
  const ready = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: {
      kind: 'ready',
      detail: {
        unlinkedHistoryExcluded: true,
        conversation: { conversation_id: '73', parcel_id: '42', parcel_name: 'Synthetic parcel', created_at: '2026-10-15T00:00:00Z' },
        participants: [
          { profile_id: '31', name: 'Synthetic buyer', username: 'buyer-test' },
          { profile_id: '32', name: 'Synthetic seller', username: 'seller-test' },
        ],
        messages: [
          { id: '99', created_at: '2026-10-15T09:00:00Z', sender_profile_id: '31', receiver_profile_id: '32', content: 'First linked message' },
          { id: '100', created_at: '2026-10-15T10:00:00Z', sender_profile_id: '32', receiver_profile_id: '31', content: 'Second linked message' },
        ],
      },
    },
    reportState: { kind: 'ready', reports: [{ id: '17', finding: 'Internal review note', created_at: '2026-10-16T09:00:00Z' }] },
    finding: 'A new note', reportSubmission: { kind: 'idle' },
    onFindingChange() {}, onSubmitReport() {}, onRetryReports() {}, onRetry() {},
  }))

  assert.match(loading, /Loading conversation/)
  assert.match(missing, /Conversation not found/)
  assert.match(error, /role="alert"/)
  assert.doesNotMatch(error, /private diagnostics/)
  assert.match(ready, /First linked message/)
  assert.match(ready, /Second linked message/)
  assert.match(ready, /Unlinked historical messages are excluded/)
  assert.match(ready, /href="\/admin\/parcels\/42"/)
  assert.match(ready, /href="\/admin\/users\/31"/)
  assert.match(ready, /href="\/admin\/users\/32"/)
  assert.match(ready, /<textarea[^>]*>A new note<\/textarea>/)
  assert.match(ready, /Internal review note/)
  assert.match(ready, /<button class="admin-danger-button" type="submit">Report/)
  assert.match(ready, /Internal note for administrators only/)
  assert.doesNotMatch(ready, /Unlinked historical message content/)
})

test('conversation report panel renders loading, empty, success, and safe failure states', () => {
  const loading = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'ready', detail: {
      conversation: { conversation_id: '73', parcel_id: null, parcel_name: null, created_at: null },
      participants: [], messages: [],
    } }, reportState: { kind: 'loading' }, finding: '', onRetry() {},
  }))
  const empty = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'ready', detail: {
      conversation: { conversation_id: '73', parcel_id: null, parcel_name: null, created_at: null },
      participants: [], messages: [],
    } }, reportState: { kind: 'empty' }, finding: '', onRetry() {},
  }))
  const failed = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'ready', detail: {
      conversation: { conversation_id: '73', parcel_id: null, parcel_name: null, created_at: null },
      participants: [], messages: [],
    } }, reportState: { kind: 'empty' },
    reportSubmission: { kind: 'error', error: new ApiError('server', 'private database details') },
    finding: 'Unsent note', onRetry() {}, onRetryReports() {},
  }))
  const success = renderToStaticMarkup(React.createElement(AdminConversationDetailView, {
    state: { kind: 'ready', detail: {
      conversation: { conversation_id: '73', parcel_id: null, parcel_name: null, created_at: null },
      participants: [], messages: [],
    } }, reportState: { kind: 'empty' }, reportSubmission: { kind: 'success' }, finding: '', onRetry() {},
  }))

  assert.match(loading, /Loading reports/)
  assert.match(empty, /No reports recorded for this conversation/)
  assert.match(success, /Report saved/)
  assert.match(failed, /role="alert"/)
  assert.match(failed, /<textarea[^>]*>Unsent note<\/textarea>/)
  assert.doesNotMatch(failed, /private database details/)
})
