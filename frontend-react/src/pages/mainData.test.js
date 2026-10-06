import assert from 'node:assert/strict'
import test from 'node:test'
import { loadParcels, saveParcelField } from './mainData.js'

test('loads real parcel rows from the protected map-data endpoint', async () => {
  const rows = [{ id: 7, parcel_name: 'Lot A' }]
  assert.deepEqual(await loadParcels(async (path) => {
    assert.equal(path, '/map-data')
    return { success: true, data: rows }
}), rows)
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

test('sends the existing update_t payload without changing other fields', async () => {
  let call
  await saveParcelField(async (path, options) => { call = { path, options }; return { success: true, data: [] } }, 7, 'price', '1200')
  assert.equal(call.path, '/update_t')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), { element: { price: '1200' }, id: 7 })
})

test('rejects an unexpected list and fields outside the legacy editor', async () => {
  await assert.rejects(loadParcels(async () => ({ success: true, data: {} })), /unexpected format/)
  await assert.rejects(saveParcelField(async () => {}, 7, 'owner_uuid', 'other'), /cannot be updated/)
})
