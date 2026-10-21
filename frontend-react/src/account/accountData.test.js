import assert from 'node:assert/strict'
import test from 'node:test'
import { loadAccountOffer, loadAccountProfile } from './accountData.js'

test('profile page reads the authenticated profile and projects only display fields', async () => {
  const calls = []
  const profile = await loadAccountProfile(async (path) => {
    calls.push(path)
    return {
      success: true,
      data: {
        user_id: 31,
        name: 'Ada Example',
        username: 'ada',
        email: 'ada@example.test',
        password_hash: 'must-not-escape',
        refresh_token_hash: 'must-not-escape',
        access_token: 'must-not-escape',
      },
    }
  })

  assert.deepEqual(calls, ['/current_user'])
  assert.deepEqual(profile, {
    name: 'Ada Example',
    username: 'ada',
    email: 'ada@example.test',
  })
})

test('local offer uses the server effective offer, current parcel usage, rights and test provenance', async () => {
  const calls = []
  const offer = await loadAccountOffer(async (path) => {
    calls.push(path)
    return {
      success: true,
      data: {
        code: 'pro',
        parcel_limit: 20,
        active_parcel_count: 3,
        can_delete_owned_parcels: true,
        source: 'subscription',
        provenance: 'test_grant',
        subscription_period: {
          starts_at: '2026-10-01T00:00:00Z',
          ends_at: '2026-11-01T00:00:00Z',
        },
      },
    }
  }, { localBackend: true })

  assert.deepEqual(calls, ['/account/offer'])
  assert.deepEqual(offer, {
    mode: 'local',
    code: 'pro',
    parcelLimit: 20,
    parcelCount: 3,
    canDeleteOwnedParcels: true,
    source: 'subscription',
    provenance: 'test_grant',
    period: {
      starts_at: '2026-10-01T00:00:00Z',
      ends_at: '2026-11-01T00:00:00Z',
    },
  })
})

test('local Free fallback has no claimed subscription or period', async () => {
  const offer = await loadAccountOffer(async (path) => {
    assert.equal(path, '/account/offer')
    return {
      success: true,
      data: {
        code: 'free', parcel_limit: 2, active_parcel_count: 2,
        can_delete_owned_parcels: false, source: 'free_fallback',
        provenance: null, subscription_period: null,
      },
    }
  }, { localBackend: true })

  assert.equal(offer.code, 'free')
  assert.equal(offer.parcelCount, 2)
  assert.equal(offer.canDeleteOwnedParcels, false)
  assert.equal(offer.period, null)
})

test('Supabase offer page reads only its existing recorded profile account contract', async () => {
  const calls = []
  const offer = await loadAccountOffer(async (path) => {
    calls.push(path)
    return { success: true, data: [{ account: 'pro' }] }
  }, { localBackend: false })

  assert.deepEqual(calls, ['/account'])
  assert.deepEqual(offer, { mode: 'supabase', recordedPlan: 'pro' })
})

test('incomplete profile or offer responses fail rather than inventing account values', async () => {
  await assert.rejects(() => loadAccountProfile(async () => ({ success: true, data: null })), { kind: 'protocol' })
  await assert.rejects(() => loadAccountOffer(async () => ({ success: true, data: { code: 'pro' } }), { localBackend: true }), { kind: 'protocol' })
})
