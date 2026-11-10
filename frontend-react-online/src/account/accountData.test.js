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

test('Supabase offer page reads effective subscription rights instead of profiles.account', async () => {
  const calls = []
  const offer = await loadAccountOffer(async (path) => {
    calls.push(path)
    return {
      success: true,
      data: {
        code: 'pro', parcel_limit: 20, active_parcel_count: 3,
        can_delete_owned_parcels: true, source: 'subscription', provenance: 'manual_grant',
        subscription_period: { starts_at: '2026-10-01T00:00:00Z', ends_at: null },
      },
    }
  }, { localBackend: false })

  assert.deepEqual(calls, ['/account/offer'])
  assert.equal(offer.mode, 'supabase')
  assert.equal(offer.code, 'pro')
  assert.equal(offer.source, 'subscription')
  assert.equal(offer.canDeleteOwnedParcels, true)
})

test('incomplete profile or offer responses fail rather than inventing account values', async () => {
  await assert.rejects(() => loadAccountProfile(async () => ({ success: true, data: null })), { kind: 'protocol' })
  await assert.rejects(() => loadAccountOffer(async () => ({ success: true, data: { code: 'pro' } }), { localBackend: true }), { kind: 'protocol' })
})

function validFreeOfferResponse() {
  return {
    success: true,
    data: {
      code: 'free', parcel_limit: 2, active_parcel_count: 0,
      can_delete_owned_parcels: false, source: 'free_fallback',
      provenance: null, subscription_period: null,
    },
  }
}

test('simultaneous offer loads for the same request function share one in-flight promise', async () => {
  let resolveResponse
  let calls = 0
  const request = (path) => {
    assert.equal(path, '/account/offer')
    calls += 1
    return new Promise((resolve) => { resolveResponse = resolve })
  }

  const first = loadAccountOffer(request, { localBackend: true })
  const second = loadAccountOffer(request, { localBackend: true })
  assert.strictEqual(second, first)
  await Promise.resolve()
  assert.equal(calls, 1)

  resolveResponse(validFreeOfferResponse())
  const [firstOffer, secondOffer] = await Promise.all([first, second])
  assert.deepEqual(firstOffer, secondOffer)
  assert.equal(firstOffer.code, 'free')
})

test('a completed offer is not cached and a later load starts a fresh request', async () => {
  let calls = 0
  const request = async (path) => {
    assert.equal(path, '/account/offer')
    calls += 1
    return validFreeOfferResponse()
  }

  await loadAccountOffer(request, { localBackend: true })
  await loadAccountOffer(request, { localBackend: true })
  assert.equal(calls, 2)
})

test('a failed offer request is removed so a later load can retry', async () => {
  let calls = 0
  const request = async (path) => {
    assert.equal(path, '/account/offer')
    calls += 1
    if (calls === 1) throw new Error('transient request failure')
    return validFreeOfferResponse()
  }

  const first = loadAccountOffer(request, { localBackend: true })
  const duplicate = loadAccountOffer(request, { localBackend: true })
  assert.strictEqual(duplicate, first)
  await assert.rejects(first, /transient request failure/)

  const retry = loadAccountOffer(request, { localBackend: true })
  assert.notStrictEqual(retry, first)
  assert.equal((await retry).code, 'free')
  assert.equal(calls, 2)
})
