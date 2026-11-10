import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { sanitizeArcGISError, setArcGISLocale } from './parcelMapLocale.js'

test('ParcelMap maps the React French and English preferences to ArcGIS locales', () => {
  const locales = []
  const intl = { setLocale: (locale) => locales.push(locale) }

  setArcGISLocale(intl, 'fr')
  setArcGISLocale(intl, 'en')

  assert.deepEqual(locales, ['fr', 'en'])
})

test('ArcGIS errors are replaced with localized generic messages before reaching page UI', () => {
  const rawError = new Error('ArcGIS failed at https://internal.example/arcgis?token=secret')
  const french = sanitizeArcGISError(rawError, 'fr')
  const english = sanitizeArcGISError(rawError, 'en')

  assert.equal(french.message, 'Impossible de charger la carte. Veuillez réessayer.')
  assert.equal(english.message, 'Unable to load the map. Please try again.')
  assert.doesNotMatch(french.message, /internal\.example|token=secret|ArcGIS/)
  assert.doesNotMatch(english.message, /internal\.example|token=secret|ArcGIS/)
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

test('ArcGIS initialization failure shows localized generic copy and an accessible Retry button', async () => {
  const source = await readFile(new URL('./ParcelMap.jsx', import.meta.url), 'utf8')
  assert.match(source, /Impossible de charger la carte\. Veuillez réessayer\./)
  assert.match(source, /Unable to load the map\. Please try again\./)
  assert.match(source, /lang === 'fr' \? 'Réessayer' : 'Retry'/)
  assert.match(source, /className="main-map-load-error" role="alert"/)
  assert.doesNotMatch(source, /loadError\.message/)

  const initializationStart = source.indexOf('loadArcGIS().then(async (modules) => {')
  const initializationCatch = source.indexOf('}).catch(() => {', initializationStart)
  const cleanupStart = source.indexOf('return () => {', initializationCatch)
  const failureHandler = source.slice(initializationCatch, cleanupStart)
  assert.match(failureHandler, /setLoadError\(true\)/)
  assert.doesNotMatch(failureHandler, /onError\?\.\(error\)/)
})

test('SDK operation failures sent to Main and Marketplace are sanitized', async () => {
  const source = await readFile(new URL('./ParcelMap.jsx', import.meta.url), 'utf8')
  const sanitizedCallbacks = source.match(/callbacksRef\.current\.onError\?\.\(sanitizeArcGISError\(error, languageRef\.current\)\)/g) || []
  assert.equal(sanitizedCallbacks.length, 3)
  assert.doesNotMatch(source, /onError\?\.\(error\)/)
  assert.match(source, /layer\.when\(\)\.catch\(\(error\) => \{ if \(live\) callbacksRef\.current\.onError\?\.\(sanitizeArcGISError\(error, languageRef\.current\)\) \}\)/)
  assert.match(source, /viewRef\.current\.goTo\([\s\S]*?\.catch\(\(error\) => callbacksRef\.current\.onError\?\.\(sanitizeArcGISError\(error, languageRef\.current\)\)\)/)
})

test('Retry reruns ArcGIS initialization after cleanup and allows either outcome', async () => {
  const source = await readFile(new URL('./ParcelMap.jsx', import.meta.url), 'utf8')
  assert.match(source, /const \[initAttempt, setInitAttempt\] = useState\(0\)/)
  assert.match(source, /setInitAttempt\(\(attempt\) => attempt \+ 1\)/)
  assert.match(source, /\}, \[initAttempt\]\)/)
  assert.match(source, /const retryInitialization = \(\) => \{\s*setLoadError\(null\)\s*setReady\(false\)\s*setInitAttempt/)
  assert.match(source, /if \(view\) view\.destroy\(\)/)
  assert.match(source, /else map\?\.destroy\?\.\(\)/)
  assert.match(source, /await view\.when\(\)[\s\S]*setLoadError\(null\)[\s\S]*setReady\(true\)/)
  assert.match(source, /setLoadError\(true\)[\s\S]*setReady\(false\)/)
  assert.match(source, /loadError && <div[\s\S]*onClick=\{retryInitialization\}/)
  assert.match(source, /new MapView\(/)
  assert.match(source, /new Search\(\{ view \}\)/)
})

test('a failed ArcGIS script is removed so Retry can load the SDK again', async () => {
  const source = await readFile(new URL('./ParcelMap.jsx', import.meta.url), 'utf8')
  const scriptErrorHandler = source.slice(source.indexOf("script.addEventListener('error'"), source.indexOf("if (!existing) document.head.appendChild(script)"))
  assert.match(scriptErrorHandler, /script\.remove\(\)/)
  assert.match(scriptErrorHandler, /reject\(new Error\('ArcGIS API failed to load\.'\)\)/)
  assert.match(source, /\.catch\(\(error\) => \{ arcgisReady = null; throw error \}\)/)
})

test('locale update safely does nothing if the loaded ArcGIS module has no setLocale method', () => {
  assert.doesNotThrow(() => setArcGISLocale({}, 'fr'))
})
