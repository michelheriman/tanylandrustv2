import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adminConversationReportListViewState,
  buildAdminConversationListQuery,
  readAdminConversationListFilter,
  readAdminConversationReportPeriod,
} from './adminConversationData.js'

test('first-response dashboard link selects only the corresponding conversation filter', () => {
  assert.deepEqual(buildAdminConversationListQuery({ page: 2, perPage: 20, awaitingFirstResponse: true }), {
    page: 2, per_page: 20, awaiting_first_response: 'true',
  })
  assert.equal(readAdminConversationListFilter('?awaiting_first_response=true'), true)
  assert.equal(readAdminConversationListFilter('?awaiting_first_response=false'), false)
})

test('finding list accepts only explicit timezone-aware bounded intervals', () => {
  const period = readAdminConversationReportPeriod('?created_from=2026-09-19T12%3A00%3A00Z&created_to=2026-10-19T12%3A00%3A00Z')
  assert.deepEqual(period, { created_from: '2026-09-19T12:00:00Z', created_to: '2026-10-19T12:00:00Z' })
  assert.equal(readAdminConversationReportPeriod('?created_from=2026-09-19T12%3A00%3A00&created_to=2026-10-19T12%3A00%3A00Z'), null)
  assert.equal(readAdminConversationReportPeriod('?created_from=2026-08-01T00%3A00%3A00Z&created_to=2026-10-19T12%3A00%3A00Z'), null)
})

test('finding list state distinguishes loading, empty, error and populated rows', () => {
  assert.deepEqual(adminConversationReportListViewState({ loading: true }), { kind: 'loading' })
  assert.deepEqual(adminConversationReportListViewState({ loading: false, result: { data: [], pagination: {}, period: {} } }), {
    kind: 'empty', pagination: {}, period: {},
  })
  assert.equal(adminConversationReportListViewState({ loading: false, error: new Error('failure') }).kind, 'error')
  assert.deepEqual(adminConversationReportListViewState({ loading: false, result: { data: [{ id: '1' }], pagination: {}, period: {} } }), {
    kind: 'ready', reports: [{ id: '1' }], pagination: {}, period: {},
  })
})
