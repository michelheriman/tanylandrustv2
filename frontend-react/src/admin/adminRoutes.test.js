import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_NAV_ITEMS, getAdminReturnPath, getAdminSignInHref, isAdminPath, resolveAdminRoute } from './adminRoutes.js'
import { getAdminPageModel, ADMIN_UNAVAILABLE_MESSAGE } from './adminViewModel.js'

test('admin navigation exposes the four requested sections in the expected paths', () => {
  assert.deepEqual(ADMIN_NAV_ITEMS.map(({ label, href }) => [label, href]), [
    ['Parcel', '/admin/parcels'],
    ['Message', '/admin/conversations'],
    ['Users', '/admin/users'],
    ['Dashboard', '/admin/dashboard'],
  ])
})

test('admin list and detail paths resolve without inventing records', () => {
  assert.deepEqual(resolveAdminRoute('/admin'), { section: 'dashboard', view: 'overview', href: '/admin' })
  assert.deepEqual(resolveAdminRoute('/admin/parcels'), { section: 'parcels', view: 'list', href: '/admin/parcels' })
  assert.deepEqual(resolveAdminRoute('/admin/parcels/5'), { section: 'parcels', view: 'detail', id: '5', href: '/admin/parcels/5' })
  assert.deepEqual(resolveAdminRoute('/admin/users/42'), { section: 'users', view: 'detail', id: '42', href: '/admin/users/42' })
  assert.deepEqual(resolveAdminRoute('/admin/conversations/thread-7'), { section: 'conversations', view: 'detail', id: 'thread-7', href: '/admin/conversations/thread-7' })
  assert.deepEqual(resolveAdminRoute('/admin/conversation-reports'), { section: 'conversations', view: 'reports', href: '/admin/conversation-reports' })
  assert.equal(isAdminPath('/admin/users/42'), true)
  assert.equal(isAdminPath('/main'), false)
  assert.equal(resolveAdminRoute('/admin/parcels/one/two').view, 'notFound')
})

test('sign-in return paths remain on known admin routes', () => {
  assert.equal(getAdminReturnPath('/admin/users/42'), '/admin/users/42')
  assert.equal(getAdminReturnPath('//outside.example/path'), null)
  assert.equal(getAdminReturnPath('/main'), null)
  assert.equal(getAdminReturnPath('/admin/unknown'), null)
  assert.equal(getAdminReturnPath('/admin/users/%2e%2e%2Fsignin'), null)
  assert.equal(getAdminSignInHref('/admin/conversations/7'), '/signin?next=%2Fadmin%2Fconversations%2F7')
})

test('dashboard and records expose their labels without carrying fabricated record values', () => {
  const dashboard = getAdminPageModel(resolveAdminRoute('/admin/dashboard'))
  assert.equal(dashboard.kind, 'dashboard')
  assert.deepEqual(dashboard.metrics, [
    'Annonces à vendre maintenant', 'Annonces contactées',
    'Conversations sans première réponse', 'Inscriptions ce mois', 'Constats internes récents',
  ])
  assert.equal(Object.hasOwn(dashboard, 'charts'), false)
  assert.equal(dashboard.unavailableMessage, ADMIN_UNAVAILABLE_MESSAGE)
  assert.equal(Object.hasOwn(dashboard, 'values'), false)
  assert.equal(Object.hasOwn(dashboard, 'rows'), false)

  for (const pathname of ['/admin/parcels', '/admin/users', '/admin/conversations']) {
    const model = getAdminPageModel(resolveAdminRoute(pathname))
    assert.equal(model.kind, 'list')
    assert.ok(model.columns.length > 0)
    assert.equal(model.unavailableMessage, ADMIN_UNAVAILABLE_MESSAGE)
    assert.equal(Object.hasOwn(model, 'rows'), false)
  }

  const userDetail = getAdminPageModel(resolveAdminRoute('/admin/users/42'))
  const conversationDetail = getAdminPageModel(resolveAdminRoute('/admin/conversations/thread-7'))
  assert.equal(userDetail.actionDisabled, true)
  assert.equal(conversationDetail.actionDisabled, true)
  assert.equal(Object.hasOwn(conversationDetail, 'messages'), false)
})
