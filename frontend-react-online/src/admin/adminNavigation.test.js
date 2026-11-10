import assert from 'node:assert/strict'
import test from 'node:test'
import { getAdminNavigationTarget, shouldHandleAdminLinkClick } from './adminNavigation.js'

test('admin links resolve in-app with query strings and preserve their destination', () => {
  assert.deepEqual(getAdminNavigationTarget('/admin/parcels/5?visibility=hidden', 'http://localhost:5173'), {
    href: '/admin/parcels/5?visibility=hidden',
    route: {
      section: 'parcels', view: 'detail', id: '5', href: '/admin/parcels/5',
      navigationHref: '/admin/parcels/5?visibility=hidden',
    },
  })
  assert.equal(getAdminNavigationTarget('https://example.test/admin/users', 'http://localhost:5173'), null)
  assert.equal(getAdminNavigationTarget('/main', 'http://localhost:5173'), null)
})

test('only unmodified primary clicks are intercepted for client-side navigation', () => {
  const click = { defaultPrevented: false, button: 0 }
  assert.equal(shouldHandleAdminLinkClick(click), true)
  assert.equal(shouldHandleAdminLinkClick({ ...click, ctrlKey: true }), false)
  assert.equal(shouldHandleAdminLinkClick({ ...click, button: 1 }), false)
  assert.equal(shouldHandleAdminLinkClick({ ...click, defaultPrevented: true }), false)
})
