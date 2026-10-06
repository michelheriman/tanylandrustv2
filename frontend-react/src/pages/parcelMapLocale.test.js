import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { setArcGISLocale } from './parcelMapLocale.js'

test('ParcelMap maps the React French and English preferences to ArcGIS locales', () => {
  const locales = []
  const intl = { setLocale: (locale) => locales.push(locale) }

  setArcGISLocale(intl, 'fr')
  setArcGISLocale(intl, 'en')

  assert.deepEqual(locales, ['fr', 'en'])
})

test('ParcelMap sets locale before creating Search and keeps its existing map interactions', async () => {
  const source = await readFile(new URL('./ParcelMap.jsx', import.meta.url), 'utf8')
  const localeSetup = source.indexOf('setArcGISLocale(modules[\'esri/intl\'], languageRef.current)')
  const searchCreation = source.indexOf('new Search({ view })')

  assert.match(source, /'esri\/intl'/)
  assert.ok(localeSetup >= 0 && localeSetup < searchCreation)
  assert.match(source, /setArcGISLocale\(intl, lang\)/)
  assert.match(source, /new Search\(\{ view \}\)/)
  assert.match(source, /availableCreateTools: \['polygon'\]/)
  assert.match(source, /callbacksRef\.current\.onGeometryComplete\(/)
  assert.match(source, /callbacksRef\.current\.onSelectParcel\(id\)/)
})

test('locale update safely does nothing if the loaded ArcGIS module has no setLocale method', () => {
  assert.doesNotThrow(() => setArcGISLocale({}, 'fr'))
})
