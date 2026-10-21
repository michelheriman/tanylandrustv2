import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_USER_UNAVAILABLE,
  adminUserDetailViewState,
  adminUserListViewState,
  buildAdminUserListQuery,
  displayAdminUserValue,
  formatAdminUserDate,
  getAdminUserInitial,
  readAdminUserDateFilters,
} from './adminUserData.js'

test('user list query includes only connected search, date, sorting and pagination filters', () => {
  assert.deepEqual(buildAdminUserListQuery({
    page: 3, perPage: 20, search: '  sample  ', sort: 'name', direction: 'asc',
    dateFrom: '2026-01-01', dateTo: '2026-02-01',
  }), {
    page: 3, per_page: 20, sort: 'name', direction: 'asc', q: 'sample',
    date_from: '2026-01-01', date_to: '2026-02-01',
  })
})

test('registration dashboard links initialize the bounded inclusive UTC date filters', () => {
  assert.deepEqual(readAdminUserDateFilters('?date_from=2026-10-01&date_to=2026-10-31'), {
    dateFrom: '2026-10-01', dateTo: '2026-10-31',
  })
  assert.deepEqual(readAdminUserDateFilters('?date_from=bad&date_to=2026-10-31'), {
    dateFrom: '', dateTo: '2026-10-31',
  })
})

test('user list and detail state helpers preserve loading, empty, error and not-found states', () => {
  assert.deepEqual(adminUserListViewState({ loading: true }), { kind: 'loading' })
  assert.deepEqual(adminUserListViewState({ loading: false, result: { data: [], pagination: { total: 0 } } }), {
    kind: 'empty', pagination: { total: 0 },
  })
  const failure = { status: 500 }
  assert.deepEqual(adminUserListViewState({ loading: false, error: failure }), { kind: 'error', error: failure })
  assert.deepEqual(adminUserListViewState({ loading: false, result: { data: [{ id: '2' }], pagination: { total: 1 } } }), {
    kind: 'ready', users: [{ id: '2' }], pagination: { total: 1 },
  })
  assert.deepEqual(adminUserDetailViewState({ loading: true }), { kind: 'loading' })
  assert.deepEqual(adminUserDetailViewState({ loading: false, error: { status: 404 } }), { kind: 'notFound' })
  const user = { id: '2' }
  assert.deepEqual(adminUserDetailViewState({ loading: false, user }), { kind: 'ready', user })
})

test('profile display helpers report missing values instead of inventing status or activity', () => {
  assert.equal(displayAdminUserValue(null), ADMIN_USER_UNAVAILABLE)
  assert.equal(formatAdminUserDate(null), ADMIN_USER_UNAVAILABLE)
  assert.equal(formatAdminUserDate('invalid'), ADMIN_USER_UNAVAILABLE)
  assert.notEqual(formatAdminUserDate('2026-09-12'), ADMIN_USER_UNAVAILABLE)
  assert.equal(getAdminUserInitial({ name: 'Synthetic User' }), 'S')
  assert.equal(getAdminUserInitial({ name: null, username: null }), '')
})
