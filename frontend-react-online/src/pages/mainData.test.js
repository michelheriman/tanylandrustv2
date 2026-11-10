import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { requestJson } from '../api/client.js'
import { deleteOwnedParcel } from '../api/parcelDeletion.js'
import { loadParcels, removeDeletedOwnerParcel, saveParcelField, saveParcelFields } from './mainData.js'

const mainSource = await readFile(new URL('./Main.jsx', import.meta.url), 'utf8')

test('loads real parcel rows from the protected map-data endpoint', async () => {
  const rows = [{ id: 7, parcel_name: 'Lot A', admin_visibility_hidden: true }]
  assert.deepEqual(await loadParcels(async (path) => {
    assert.equal(path, '/map-data')
    return { success: true, data: rows }
}), rows)
  assert.match(mainSource, /row\.admin_visibility_hidden &&/)
  assert.match(mainSource, /Masquée par l’administration/)
})

test('owner delete control requires a fresh effective-rights result, waits for confirmation, and never trusts account fields', () => {
  assert.match(mainSource, /loadOwnerParcelDeletionRights\(request\)/)
  assert.match(mainSource, /showOwnerDelete\(row\.id\) && <div className="main-parcel-delete-wrap"/)
  assert.match(mainSource, /deleteOwnedParcel\(request, parcelId, \{ confirmed: true \}\)/)
  assert.match(mainSource, /deleteFlightRef\.current = true/)
  assert.match(mainSource, /onClick=\{cancelDeleteParcel\}/)
  assert.match(mainSource, /removeDeletedOwnerParcel\(/)
  assert.match(mainSource, /setOwnerDeletionRights\(\{ status: 'loading', canDeleteOwnedParcels: false \}\)/)
  assert.doesNotMatch(mainSource, /user\?\.account|profiles\.account/)
  assert.match(mainSource, /protected archive/)
})

test('successful owner deletion immediately removes the row and clears its map and confirmation selection without reloading', () => {
  const state = {
    parcels: [{ id: 3, parcel_name: 'Deleted lot' }, { id: 4, parcel_name: 'Kept lot' }],
    selectedParcelId: 3,
    expandedParcelId: 3,
    deleteConfirmationId: '3',
  }
  assert.deepEqual(removeDeletedOwnerParcel(state, '3'), {
    parcels: [{ id: 4, parcel_name: 'Kept lot' }],
    selectedParcelId: null,
    expandedParcelId: null,
    deleteConfirmationId: null,
  })
  assert.deepEqual(state.parcels.map((parcel) => parcel.id), [3, 4], 'the transition does not mutate prior state')

  const successPath = mainSource
    .split('const deletion = await deleteOwnedParcel(request, parcelId, { confirmed: true })')[1]
    .split('} catch (failure)')[0]
  assert.ok(successPath, 'Main must apply the tested successful-delete transition')
  assert.match(successPath, /removeDeletedOwnerParcel\(/)
  assert.doesNotMatch(successPath, /setReloadKey|loadParcels|loadOwnerParcelDeletionRights/)
})

test('the actual flat HTTP 200 deletion JSON reaches Main as success and immediately clears its parcel state', async () => {
  const backendJson = {
    actor_role: 'pro',
    archive_id: 5,
    deleted_at: '2026-11-03T19:28:16.633302+00:00',
    parcel_id: 7,
    success: true,
  }
  const requests = []
  const request = (path, options = {}) => requestJson(
    path,
    { ...options, token: 'test-session-token' },
    async (url, init) => {
      requests.push({ url, method: init.method, authorization: init.headers.get('Authorization') })
      return Response.json(backendJson, { status: 200 })
    },
  )
  const parcels = [{ id: 7, parcel_name: 'Deleted lot' }, { id: 8, parcel_name: 'Kept lot' }]
  const state = { parcels, selectedParcelId: 7, expandedParcelId: 7, deleteConfirmationId: '7' }

  const acknowledgement = await deleteOwnedParcel(request, 7, { confirmed: true })
  const updated = removeDeletedOwnerParcel(state, acknowledgement.parcelId)

  assert.deepEqual(requests, [{
    url: '/api/parcels/7/delete',
    method: 'POST',
    authorization: 'Bearer test-session-token',
  }])
  assert.deepEqual(updated, {
    parcels: [{ id: 8, parcel_name: 'Kept lot' }],
    selectedParcelId: null,
    expandedParcelId: null,
    deleteConfirmationId: null,
  })
  const successPath = mainSource
    .split('const deletion = await deleteOwnedParcel(request, parcelId, { confirmed: true })')[1]
    .split('} catch (failure)')[0]
  assert.match(successPath, /setNotice\(/)
  assert.match(successPath, /setDeleteConfirmationId\(nextState\.deleteConfirmationId\)/)
  assert.doesNotMatch(successPath, /setDeleteError\(/)
})

test('shares one in-flight map-data load and starts a fresh load after it resolves', async () => {
  const rows = [{ id: 8, parcel_name: 'Shared lot' }]
  const calls = []
  const resolvers = []
  const request = (path) => {
    calls.push(path)
    return new Promise((resolve) => resolvers.push(resolve))
  }

  const first = loadParcels(request)
  const second = loadParcels(request)
  assert.strictEqual(first, second)
  await Promise.resolve()
  assert.deepEqual(calls, ['/map-data'])
  resolvers[0]({ success: true, data: rows })
  const [firstRows, secondRows] = await Promise.all([first, second])
  assert.strictEqual(firstRows, rows)
  assert.strictEqual(secondRows, rows)

  const later = loadParcels(request)
  await Promise.resolve()
  assert.deepEqual(calls, ['/map-data', '/map-data'])
  resolvers[1]({ success: true, data: rows })
  assert.strictEqual(await later, rows)
})

test('clears a failed map-data flight so Retry can issue a new request', async () => {
  const rows = [{ id: 9 }]
  let calls = 0
  const request = () => {
    calls += 1
    return calls === 1
      ? Promise.reject(new Error('temporary failure'))
      : Promise.resolve({ success: true, data: rows })
  }

  await assert.rejects(loadParcels(request), /temporary failure/)
  assert.deepEqual(await loadParcels(request), rows)
  assert.equal(calls, 2)
})

test('normal editor allows a source-field update and never allows a total update', async () => {
  let call
  await saveParcelField(async (path, options) => { call = { path, options }; return { success: true, data: [] } }, 7, 'declared_area_ha', '1.25')
  assert.equal(call.path, '/update_t')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), { element: { declared_area_ha: '1.25' }, id: 7 })
  await assert.rejects(saveParcelField(async () => {}, 7, 'price', '1200'), /cannot be updated/)
})

test('normal editor sends partial changes together and preserves omitted source data', async () => {
  const calls = []
  const request = async (path, options = {}) => {
    calls.push({ path, options })
    if (path === '/update_t') return { success: true }
    throw new Error(`Unexpected request ${path}`)
  }

  const result = await saveParcelFields(request, 7, [{ key: 'price_m2' }, { key: 'location_name' }], {
    price_m2: '12',
    location_name: 'New location',
  })
  assert.deepEqual(result, { success: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/update_t')
  assert.deepEqual(JSON.parse(calls[0].options.body), { element: { price_m2: '12', location_name: 'New location' }, id: 7 })
})

test('saveParcelFields refuses totals and sends no request', async () => {
  let calls = 0
  const result = await saveParcelFields(async () => { calls += 1 }, 7, [{ key: 'price' }], { price: '1200' })
  assert.equal(result.success, false)
  assert.match(result.error.message, /cannot be changed/)
  assert.equal(calls, 0)
})

test('normal partial source-pricing edit sends only the edited source with one request', async () => {
  const calls = []
  const request = async (path, options = {}) => { calls.push({ path, options }); return { success: true } }
  const result = await saveParcelFields(request, 19, [{ key: 'price_m2' }], {
    declared_area_ha: '2', price_m2: '7.5', currency: 'USD',
  })
  assert.deepEqual(result, { success: true })
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(calls[0].options.body), { element: { price_m2: '7.5' }, id: 19 })
})

test('area editor accepts square metres and sends hectares to the existing backend contract', async () => {
  let sent
  const result = await saveParcelFields(async (path, options) => {
    sent = { path, body: JSON.parse(options.body) }
    return { success: true }
  }, 7, [{ key: 'declared_area_m2' }], { declared_area_m2: '10000' })
  assert.deepEqual(result, { success: true })
  assert.equal(sent.path, '/update_t')
  assert.deepEqual(sent.body, { element: { declared_area_ha: '1' }, id: 7 })
})

test('rejects an unexpected list and fields outside the legacy editor', async () => {
  await assert.rejects(loadParcels(async () => ({ success: true, data: {} })), /unexpected format/)
  await assert.rejects(saveParcelField(async () => {}, 7, 'owner_uuid', 'other'), /cannot be updated/)
})
