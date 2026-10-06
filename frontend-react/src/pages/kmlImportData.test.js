import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import { createKmlUploadForm, KML_SALE_CATEGORIES, KML_TITLE_STATUSES, MAX_KML_FILE_SIZE, uploadKmlParcel, validateKmlFields, validateKmlFile } from './kmlImportData.js'

const kmlImportSource = readFileSync(new URL('./KmlImport.jsx', import.meta.url), 'utf8')

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
const validKml = '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>47.1,-18.9,0 47.2,-18.9,0 47.2,-18.8,0 47.1,-18.9,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>'
const file = () => Object.assign(new Blob([validKml], { type: 'application/vnd.google-earth.kml+xml' }), { name: 'parcel.KML' })

test('KML select options use French and English labels while retaining backend values', () => {
  const englishStart = kmlImportSource.indexOf('  en: {')
  const frenchStart = kmlImportSource.indexOf('  fr: {')
  const english = kmlImportSource.slice(englishStart, frenchStart)
  const french = kmlImportSource.slice(frenchStart, kmlImportSource.indexOf('function fileErrorMessage', frenchStart))
  assert.match(english, /saleToSell: 'For sale'/)
  assert.match(english, /saleSold: 'Sold'/)
  assert.match(english, /titleStatus: 'Title'/)
  assert.match(english, /titleAndMarkers: 'Title and boundary markers'/)
  assert.match(french, /saleToSell: 'A vendre'/)
  assert.match(french, /saleSold: 'Vendue'/)
  assert.match(french, /titleStatus: 'Titre'/)
  assert.match(french, /titleAndMarkers: 'Titre et borne'/)
  assert.match(kmlImportSource, /copy\[lang === 'fr' \? 'fr' : 'en'\]/)

  for (const [value, label] of [
    ['to_sell', 'saleToSell'], ['vendu', 'saleSold'], ['autre', 'saleOther'], ['na', 'saleNA'],
    ['titre', 'titleStatus'], ['titre_borne', 'titleAndMarkers'], ['kt', 'karanTany'], ['na', 'statusNA'],
  ]) assert.ok(kmlImportSource.includes(`<option value="${value}">{labels.${label}}</option>`))
  assert.deepEqual(KML_SALE_CATEGORIES, ['to_sell', 'vendu', 'autre', 'na'])
  assert.deepEqual(KML_TITLE_STATUSES, ['titre', 'titre_borne', 'kt', 'na'])
})

test('KML file validation preserves the .kml extension and 10 MB limit', () => {
  assert.equal(validateKmlFile(file()), null)
  assert.equal(validateKmlFile({ name: 'parcel.geojson', size: 10 }), 'extension')
  assert.equal(validateKmlFile({ name: 'parcel.kml', size: MAX_KML_FILE_SIZE + 1 }), 'size')
  assert.equal(validateKmlFile(null), 'required')
})

test('KML parcel fields enforce backend-required values and allow optional prices and currency', () => {
  assert.equal(validateKmlFields(fields), null)
  assert.equal(validateKmlFields({ ...fields, price: '', price_m2: '', currency: '' }), null)
  assert.equal(validateKmlFields({ ...fields, owner: ' ' }), 'owner')
  assert.equal(validateKmlFields({ ...fields, parcel_name: ' ' }), 'parcel_name')
  assert.equal(validateKmlFields({ ...fields, location_name: ' ' }), 'location_name')
  assert.equal(validateKmlFields({ ...fields, sell_category: '' }), 'sell_category')
  assert.equal(validateKmlFields({ ...fields, status_category: '' }), 'status_category')
  assert.equal(validateKmlFields({ ...fields, price: 'unknown' }), 'price')
  assert.equal(validateKmlFields({ ...fields, price: '-1' }), 'price')
  assert.equal(validateKmlFields({ ...fields, price_m2: 'unknown' }), 'price_m2')
  assert.equal(validateKmlFields({ ...fields, price_m2: '-1' }), 'price_m2')
})

test('KML import sends the file and required parcel metadata as multipart without a drawn boundary', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push({ path, options })
    return { status: 'success', message: 'uploaded' }
  }
  await uploadKmlParcel(request, { file: file(), fields, ownerEmail: 'owner@example.test' })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/upload-kml')
  assert.equal(calls[0].options.method, 'POST')
  const body = calls[0].options.body
  assert.deepEqual([...body.keys()], ['kmlFile', 'owner', 'owner_uuid', 'parcel_name', 'price_m2', 'price', 'currency', 'location_name', 'description', 'sell_category', 'status_category'])
  assert.equal(body.get('kmlFile').name, 'parcel.KML')
  assert.equal(await body.get('kmlFile').text(), validKml)
  assert.equal(body.get('owner_uuid'), 'owner@example.test')
  assert.equal(body.get('parcel_name'), 'North field')
  assert.equal(body.get('status_category'), 'titre')
  assert.equal(body.get('sell_category'), 'to_sell')
  assert.equal(body.has('geojson'), false)
  assert.equal(body.has('longitude'), false)
  assert.equal(body.has('latitude'), false)
  assert.equal(body.has('area_ha'), false)
  assert.equal(calls[0].options.acceptStatusSuccess, true)
})

test('KML import uses the React session Bearer token and leaves multipart content type to fetch', async () => {
  const saved = { accessToken: 'session-access', refreshToken: 'session-refresh', user: null }
  const storage = { read: () => saved, write() {}, clear() {} }
  let uploadOptions
  const service = createAuthService({
    storage,
    fetchImpl: async (path, options) => {
      if (path === '/api/current_user') return Response.json({ success: true, data: { user_id: 3, email: 'owner@example.test' } })
      if (path === '/api/upload-kml') { uploadOptions = options; return Response.json({ status: 'success', message: 'uploaded' }) }
      throw new Error(`Unexpected request: ${path}`)
    },
  })
  await service.restore()
  await uploadKmlParcel(service.request, { file: file(), fields, ownerEmail: 'owner@example.test' })

  assert.equal(uploadOptions.headers.get('Authorization'), 'Bearer session-access')
  assert.equal(uploadOptions.headers.has('Content-Type'), false)
  assert.equal(uploadOptions.body.get('kmlFile').name, 'parcel.KML')
  assert.equal(uploadOptions.body.has('geojson'), false)
  assert.equal(uploadOptions.acceptStatusSuccess, undefined)
})

test('missing or invalid KML file is rejected before the upload request', () => {
  assert.throws(() => createKmlUploadForm({ file: null, fields, ownerEmail: 'owner@example.test' }), /Invalid KML file/)
  assert.throws(() => createKmlUploadForm({ file: { name: 'parcel.txt', size: 4 }, fields, ownerEmail: 'owner@example.test' }), /Invalid KML file/)
  assert.throws(() => createKmlUploadForm({ file: file(), fields: { ...fields, owner: '' }, ownerEmail: 'owner@example.test' }), /Invalid parcel field/)
  assert.throws(() => createKmlUploadForm({ file: file(), fields, ownerEmail: '' }), /email is unavailable/)
})
