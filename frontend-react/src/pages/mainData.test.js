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
