import test from 'node:test'
import assert from 'node:assert/strict'
import { checkParcelLimit, makeParcelPayload, parseParcelGeometry, parcelsToFeatureCollection } from './parcelMapData.js'

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

test('parcel quota uses the backend profile account and legacy thresholds', () => {
  assert.deepEqual(checkParcelLimit({ data: [{ account: 'free' }] }, 1), { allowed: true, limit: 2, plan: 'free' })
  assert.equal(checkParcelLimit({ data: [{ account: 'pro5' }] }, 5).allowed, false)
  assert.equal(checkParcelLimit({ data: [{ account: 'pro10' }] }, 14).allowed, true)
  assert.throws(() => checkParcelLimit({ data: [] }, 0), /plan could not be checked/)
})
