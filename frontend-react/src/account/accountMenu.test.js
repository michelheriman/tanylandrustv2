import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accountDisplayName,
  accountInitials,
  accountPageFromHash,
  accountPageHash,
  isAccountMenuEscape,
  isOutsideAccountMenu,
} from './accountMenu.js'

test('account trigger shows the authenticated name and initials', () => {
  assert.equal(accountDisplayName({ name: 'Ada Lovelace', username: 'ada', email: 'ada@example.test' }), 'Ada Lovelace')
  assert.equal(accountInitials({ name: 'Ada Lovelace' }), 'AL')
  assert.equal(accountDisplayName({ username: 'ada' }), 'ada')
})

test('account pages have navigable hashes without becoming public routes', () => {
  assert.equal(accountPageHash('profile'), '/main#profile')
  assert.equal(accountPageHash('offer'), '/main#offer')
  assert.equal(accountPageFromHash('#profile'), 'profile')
  assert.equal(accountPageFromHash('#offer'), 'offer')
  assert.equal(accountPageFromHash('#tasks'), null)
  assert.throws(() => accountPageHash('payments'), TypeError)
})

test('menu close helpers distinguish Escape and outside pointer targets', () => {
  const inside = {}
  const outside = {}
  const root = { contains: (target) => target === inside }
  assert.equal(isAccountMenuEscape('Escape'), true)
  assert.equal(isAccountMenuEscape('Enter'), false)
  assert.equal(isOutsideAccountMenu(inside, root), false)
  assert.equal(isOutsideAccountMenu(outside, root), true)
  assert.equal(isOutsideAccountMenu(outside, null), false)
})
