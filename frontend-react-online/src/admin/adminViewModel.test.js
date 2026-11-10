import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveAdminRoute } from './adminRoutes.js'
import { ADMIN_UNAVAILABLE_MESSAGE, getAdminPageModel } from './adminViewModel.js'

test('admin list models expose the columns represented by the reference layouts without rows', () => {
  const expected = {
    parcels: ['Parcel name', 'User', 'Surface', 'Price', 'Date', 'Action'],
    users: ['User name', 'Email', 'Status', 'Date', 'Action'],
    conversations: ['Parcel', 'Users', 'Last message', 'Action'],
  }

  for (const [section, columns] of Object.entries(expected)) {
    const model = getAdminPageModel(resolveAdminRoute(`/admin/${section}`))
    assert.deepEqual(model.columns, columns)
    assert.equal(model.unavailableMessage, ADMIN_UNAVAILABLE_MESSAGE)
    assert.equal(Object.hasOwn(model, 'rows'), false)
  }
})

test('admin dashboard model keeps labels without embedding fabricated metric values', () => {
  const model = getAdminPageModel(resolveAdminRoute('/admin/dashboard'))
  assert.deepEqual(model.metrics, [
    'Listings for sale now', 'Contacted listings',
    'Conversations awaiting first reply', 'Registrations this month', 'Recent internal findings',
  ])
  assert.equal(Object.hasOwn(model, 'charts'), false)
  assert.equal(model.unavailableMessage, ADMIN_UNAVAILABLE_MESSAGE)
  assert.equal(Object.hasOwn(model, 'values'), false)
})

test('all admin details preserve a back link and unavailable state', () => {
  for (const section of ['parcels', 'users', 'conversations']) {
    const model = getAdminPageModel(resolveAdminRoute(`/admin/${section}/test-id`))
    assert.equal(model.kind, 'detail')
    assert.equal(model.backHref, `/admin/${section}`)
    assert.equal(model.unavailableMessage, ADMIN_UNAVAILABLE_MESSAGE)
  }
})
