import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import { createKmlUploadForm, KML_SALE_CATEGORIES, KML_TITLE_STATUSES, MAX_KML_FILE_SIZE, uploadKmlParcel, validateKmlFields, validateKmlFile } from './kmlImportData.js'

const kmlImportSource = readFileSync(new URL('./KmlImport.jsx', import.meta.url), 'utf8')

const fields = {
  owner: 'Parcel owner',
  parcel_name: 'North field',
  declared_area_m2: '27500',
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

test('normal KML parcel fields require declared pricing sources and supported currency', () => {
  assert.equal(validateKmlFields(fields), null)
  assert.equal(validateKmlFields({ ...fields, owner: '', price: '', declared_area_m2: '', price_m2: '', currency: '' }), 'declared_area_m2')
  assert.equal(validateKmlFields({ ...fields, parcel_name: ' ' }), 'parcel_name')
  assert.equal(validateKmlFields({ ...fields, location_name: ' ' }), 'location_name')
  assert.equal(validateKmlFields({ ...fields, sell_category: '' }), 'sell_category')
  assert.equal(validateKmlFields({ ...fields, status_category: '' }), 'status_category')
  assert.equal(validateKmlFields({ ...fields, price_m2: 'unknown' }), 'price_m2')
  assert.equal(validateKmlFields({ ...fields, price_m2: '-1' }), 'price_m2')
  assert.match(kmlImportSource, /<label>\{labels\.declaredArea\}<input required/)
  assert.match(kmlImportSource, /<label>\{labels\.priceM2\}<input required/)
  assert.match(kmlImportSource, /<p className="main-add-estimate" role="status">/)
  assert.doesNotMatch(kmlImportSource, /<label>\{labels\.price\}/)
})

test('local KML retains the local owner label requirement while sharing declared price sources', () => {
  assert.equal(validateKmlFields(fields, { localBackend: true }), null)
  assert.equal(validateKmlFields({ ...fields, owner: ' ' }, { localBackend: true }), 'owner')
  assert.equal(validateKmlFields({ ...fields, declared_area_m2: '' }, { localBackend: true }), 'declared_area_m2')
  assert.equal(validateKmlFields({ ...fields, price_m2: '0' }, { localBackend: true }), 'price_m2')
  assert.equal(validateKmlFields({ ...fields, currency: '' }, { localBackend: true }), 'currency')
})

test('normal KML import sends declared pricing sources without owner identity or a total', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push({ path, options })
    return { status: 'success', message: 'uploaded' }
  }
  await uploadKmlParcel(request, { file: file(), fields: { ...fields, owner: '' } })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].path, '/upload-kml')
  assert.equal(calls[0].options.method, 'POST')
  const body = calls[0].options.body
  assert.deepEqual([...body.keys()], ['kmlFile', 'parcel_name', 'price_m2', 'declared_area_ha', 'currency', 'location_name', 'description', 'sell_category', 'status_category'])
  assert.equal(body.get('kmlFile').name, 'parcel.KML')
  assert.equal(await body.get('kmlFile').text(), validKml)
  assert.equal(body.get('declared_area_ha'), '2.75')
  assert.equal(body.get('price_m2'), '12.5')
  assert.equal(body.has('price'), false)
  assert.equal(body.has('owner_uuid'), false)
  assert.equal(body.has('owner'), false)
  assert.equal(body.get('parcel_name'), 'North field')
  assert.equal(body.get('status_category'), 'titre')
  assert.equal(body.get('sell_category'), 'to_sell')
  assert.equal(body.has('geojson'), false)
  assert.equal(body.has('longitude'), false)
  assert.equal(body.has('latitude'), false)
  assert.equal(body.has('area_ha'), false)
  assert.equal(calls[0].options.acceptStatusSuccess, true)
})

test('local KML upload keeps its display compatibility fields but omits client total', async () => {
  const calls = []
  await uploadKmlParcel(async (path, options) => {
    calls.push({ path, options })
    return { status: 'success' }
  }, { file: file(), fields, ownerEmail: 'owner@example.test', localBackend: true })
  const body = calls[0].options.body
  assert.equal(body.get('declared_area_ha'), '2.75')
  assert.equal(body.get('price_m2'), '12.5')
  assert.equal(body.has('price'), false)
  assert.deepEqual([...body.keys()], ['kmlFile', 'owner', 'owner_uuid', 'parcel_name', 'price_m2', 'declared_area_ha', 'currency', 'location_name', 'description', 'sell_category', 'status_category'])
})

test('KML area entered as 10000 square metres is uploaded as one hectare', () => {
  const body = createKmlUploadForm({
    file: file(),
    fields: { ...fields, declared_area_m2: '10000' },
  })
  assert.equal(body.get('declared_area_ha'), '1')
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

test('missing or invalid KML files and incomplete local pricing are rejected before upload', () => {
  assert.throws(() => createKmlUploadForm({ file: null, fields, ownerEmail: 'owner@example.test' }), /Invalid KML file/)
  assert.throws(() => createKmlUploadForm({ file: { name: 'parcel.txt', size: 4 }, fields, ownerEmail: 'owner@example.test' }), /Invalid KML file/)
  assert.throws(() => createKmlUploadForm({ file: file(), fields: { ...fields, declared_area_m2: '' } }), /Invalid parcel field/)
  assert.throws(() => createKmlUploadForm({ file: file(), fields: { ...fields, owner: '' }, localBackend: true, ownerEmail: 'owner@example.test' }), /Invalid parcel field/)
  assert.throws(() => createKmlUploadForm({ file: file(), fields, localBackend: true, ownerEmail: '' }), /email is unavailable/)
})
