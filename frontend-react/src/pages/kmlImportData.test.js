import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import { createKmlUploadForm, MAX_KML_FILE_SIZE, uploadKmlParcel, validateKmlFields, validateKmlFile } from './kmlImportData.js'

const fields = {
  owner: 'Parcel owner',
  parcel_name: 'North field',
  price_m2: '12.5',
  price: '1500',
  currency: 'MGA',
  location_name: 'Antananarivo',
  description: 'Farm parcel',
  sell_category: 'to_sell',
  status_category: 'titre',
}
const boundary = {
  geometry: { rings: [[[47.1, -18.9], [47.2, -18.9], [47.2, -18.8], [47.1, -18.9]]] },
  centroid: { x: 47.16, y: -18.87 },
  areaHa: 0.24,
}
const file = () => Object.assign(new Blob(['<kml/>'], { type: 'application/vnd.google-earth.kml+xml' }), { name: 'parcel.KML' })

test('KML file validation preserves the .kml extension and 10 MB limit', () => {
  assert.equal(validateKmlFile(file()), null)
  assert.equal(validateKmlFile({ name: 'parcel.geojson', size: 10 }), 'extension')
  assert.equal(validateKmlFile({ name: 'parcel.kml', size: MAX_KML_FILE_SIZE + 1 }), 'size')
  assert.equal(validateKmlFile(null), 'required')
})

test('KML parcel fields validate required fields and numeric prices', () => {
  assert.equal(validateKmlFields(fields), null)
  assert.equal(validateKmlFields({ ...fields, parcel_name: ' ' }), 'parcel_name')
  assert.equal(validateKmlFields({ ...fields, price: '' }), 'price')
  assert.equal(validateKmlFields({ ...fields, price_m2: 'unknown' }), 'price_m2')
})

test('KML import sends the file, both-step metadata and drawn GeoJSON in one API request', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push({ path, options })
    return { success: true, message: 'uploaded' }
  }
  await uploadKmlParcel(request, { file: file(), fields, ownerEmail: 'owner@example.test', boundary })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/upload-kml')
  assert.equal(calls[0].options.method, 'POST')
  const body = calls[0].options.body
  assert.equal(body.get('kmlFile').name, 'parcel.KML')
  assert.equal(body.get('owner_uuid'), 'owner@example.test')
  assert.equal(body.get('parcel_name'), 'North field')
  assert.equal(body.get('status_category'), 'titre')
  assert.equal(body.get('sell_category'), 'to_sell')
  assert.deepEqual(JSON.parse(body.get('geojson')), { type: 'Polygon', coordinates: boundary.geometry.rings })
  assert.equal(body.get('longitude'), '47.16')
  assert.equal(body.get('latitude'), '-18.87')
  assert.equal(body.get('area_ha'), '0.24')
})

test('KML import uses the React session Bearer token and leaves multipart content type to fetch', async () => {
  const saved = { accessToken: 'session-access', refreshToken: 'session-refresh', user: null }
  const storage = { read: () => saved, write() {}, clear() {} }
  let uploadOptions
  const service = createAuthService({
    storage,
    fetchImpl: async (path, options) => {
      if (path === '/api/current_user') return Response.json({ success: true, data: { user_id: 3, email: 'owner@example.test' } })
      if (path === '/api/upload-kml') { uploadOptions = options; return Response.json({ success: true }) }
      throw new Error(`Unexpected request: ${path}`)
    },
  })
  await service.restore()
  await uploadKmlParcel(service.request, { file: file(), fields, ownerEmail: 'owner@example.test', boundary })

  assert.equal(uploadOptions.headers.get('Authorization'), 'Bearer session-access')
  assert.equal(uploadOptions.headers.has('Content-Type'), false)
  assert.equal(uploadOptions.body.get('geojson') != null, true)
})

test('invalid or missing map geometry is rejected before the upload request', () => {
  assert.throws(() => createKmlUploadForm({ file: file(), fields, ownerEmail: 'owner@example.test', boundary: { ...boundary, geometry: { rings: [] } } }), /valid parcel boundary/)
  assert.throws(() => createKmlUploadForm({ file: file(), fields, ownerEmail: 'owner@example.test', boundary: null }), /valid parcel boundary/)
})
