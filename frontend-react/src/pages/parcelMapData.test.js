import test from 'node:test'
import assert from 'node:assert/strict'
import { addParcelStepForField, checkParcelLimit, createParcel, findInvalidAddParcelControl, isValidParcelBoundary, makeParcelPayload, parseParcelGeometry, parcelsToFeatureCollection } from './parcelMapData.js'

test('parcel map GeoJSON accepts the stored Polygon and MultiPolygon formats', () => {
  const polygon = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]] }, properties: { parcel_name: 'Field' } }
  const rows = [
    { id: 1, uuid: 'parcel-1', parcel_name: 'Field', geojson: JSON.stringify(polygon) },
    { id: 2, parcel_name: 'Fields', geojson: { type: 'MultiPolygon', coordinates: [[[[3, 3], [4, 3], [4, 4], [3, 3]]]] } },
    { id: 3, parcel_name: 'Broken', geojson: '{bad json' },
  ]
  const collection = parcelsToFeatureCollection(rows)
  assert.equal(collection.features.length, 2)
  assert.equal(collection.features[0].properties.id, 1)
  assert.equal('geojson' in collection.features[0].properties, false)
  assert.equal(parseParcelGeometry(rows[1].geojson).type, 'MultiPolygon')
  assert.equal(parseParcelGeometry({ type: 'Point', coordinates: [0, 0] }), null)
})

test('new parcel payload matches the current parcels_w field names and encoding', () => {
  const payload = makeParcelPayload({ owner: 'Owner', parcel_name: 'Lot A', price_m2: '0', price: '200', currency: 'USD', location_name: 'North', description: 'Land', sell_category: 'to_sell', status_category: 'titre' }, { rings: [[[1, 2], [3, 2], [3, 4], [1, 2]]], spatialReference: { wkid: 4326 } }, 'owner@example.test', { x: 2, y: 3 }, 0.05)
  assert.equal(payload.owner_uuid, 'owner@example.test')
  assert.equal(payload.longitude, 2)
  assert.equal(payload.latitude, 3)
  assert.equal(payload.area_ha, 0.05)
  assert.deepEqual(JSON.parse(payload.geojson), { type: 'Polygon', coordinates: [[[1, 2], [3, 2], [3, 4], [1, 2]]] })
  assert.deepEqual(Object.keys(payload).sort(), ['owner', 'price_m2', 'price', 'currency', 'location_name', 'description', 'owner_uuid', 'sell_category', 'status_category', 'longitude', 'latitude', 'parcel_name', 'geojson', 'area_ha'].sort())
})

test('parcel drawing gate accepts closed WGS84 polygons and rejects empty or invalid rings', () => {
  const valid = { geometry: { rings: [[[1, 2], [3, 2], [3, 4], [1, 2]]] }, centroid: { x: 2, y: 3 } }
  assert.equal(isValidParcelBoundary(valid), true)
  assert.equal(isValidParcelBoundary(null), false)
  assert.equal(isValidParcelBoundary({ ...valid, geometry: { rings: [] } }), false)
  assert.equal(isValidParcelBoundary({ ...valid, geometry: { rings: [[[1, 2], [3, 2], [3, 4], [1, 3]]] } }), false)
  assert.equal(isValidParcelBoundary({ ...valid, geometry: { rings: [[[181, 2], [3, 2], [3, 4], [181, 2]]] } }), false)
  assert.equal(isValidParcelBoundary({ ...valid, centroid: { x: 181, y: 3 } }), false)
})

test('Add Parcel wizard checks required controls from both steps, including hidden fields', () => {
  const hiddenStepOneField = { name: 'location_name', hidden: true, willValidate: true, checkValidity: () => false }
  const visibleStepTwoField = { name: 'price', hidden: false, willValidate: true, checkValidity: () => true }
  assert.equal(findInvalidAddParcelControl({ elements: [hiddenStepOneField, visibleStepTwoField] }), hiddenStepOneField)
  assert.equal(addParcelStepForField(hiddenStepOneField.name), 1)
  assert.equal(addParcelStepForField('status_category'), 2)
  assert.equal(findInvalidAddParcelControl({ elements: [
    { willValidate: false, checkValidity: () => false },
    visibleStepTwoField,
  ] }), null)
})

test('final Add Parcel submission sends one combined payload with geometry and blocks without a valid contour', async () => {
  const calls = []
  const request = async (path, options) => { calls.push({ path, options }); return { success: true } }
  const form = { owner: 'Owner', parcel_name: 'Lot A', price_m2: '12', price: '200', currency: 'USD', location_name: 'North', description: 'Land', sell_category: 'to_sell', status_category: 'titre' }
  const draft = { geometry: { rings: [[[1, 2], [3, 2], [3, 4], [1, 2]]], spatialReference: { wkid: 4326 } }, centroid: { x: 2, y: 3 }, areaHa: 0.05 }

  await createParcel(request, form, draft, 'owner@example.test')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/parcels_w')
  assert.equal(calls[0].options.method, 'POST')
  const sent = JSON.parse(calls[0].options.body)
  assert.equal(sent.parcel_name, 'Lot A')
  assert.equal(sent.location_name, 'North')
  assert.equal(sent.price, '200')
  assert.deepEqual(JSON.parse(sent.geojson), { type: 'Polygon', coordinates: draft.geometry.rings })

  calls.length = 0
  assert.throws(() => createParcel(request, form, null, 'owner@example.test'), /valid parcel boundary/)
  assert.equal(calls.length, 0)
})

test('parcel quota uses the backend profile account and legacy thresholds', () => {
  assert.deepEqual(checkParcelLimit({ data: [{ account: 'free' }] }, 1), { allowed: true, limit: 2, plan: 'free' })
  assert.equal(checkParcelLimit({ data: [{ account: 'pro5' }] }, 5).allowed, false)
  assert.equal(checkParcelLimit({ data: [{ account: 'pro10' }] }, 14).allowed, true)
  assert.throws(() => checkParcelLimit({ data: [] }, 0), /plan could not be checked/)
})
