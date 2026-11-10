import assert from 'node:assert/strict'
import test from 'node:test'
import { isLocalBackendConfigured } from './backendMode.js'

test('local-only destructive controls are opt-in and fail closed in other modes', () => {
  assert.equal(isLocalBackendConfigured('localdev'), true)
  assert.equal(isLocalBackendConfigured('local'), false)
  assert.equal(isLocalBackendConfigured('supabase'), false)
  assert.equal(isLocalBackendConfigured('development'), false)
  assert.equal(isLocalBackendConfigured(undefined), false)
})
