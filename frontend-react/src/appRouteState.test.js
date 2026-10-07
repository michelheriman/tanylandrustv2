import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { resolveAuthRoute } from './appRouteState.js'

const appSource = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

test('unavailable session keeps Sign In and Sign Up routes accessible', () => {
  assert.equal(resolveAuthRoute('/signin', 'unavailable'), 'signin')
  assert.equal(resolveAuthRoute('/signup', 'unavailable'), 'signup')
  assert.match(appSource, /const routeView = resolveAuthRoute\(pathname, status, \{ isGeoReport \}\)/)
  assert.match(appSource, /\{isSignUp \? <SignUp \/> : <SignIn \/>\}/)
})

test('unavailable protected routes keep the retryable service error screen', () => {
  assert.equal(resolveAuthRoute('/main', 'unavailable'), 'unavailable')
  assert.equal(resolveAuthRoute('/main.html', 'unavailable'), 'unavailable')
  assert.equal(resolveAuthRoute('/georeport/parcel-uuid', 'unavailable', { isGeoReport: true }), 'unavailable')
  assert.match(appSource, /if \(routeView === 'unavailable'\)/)
  assert.match(appSource, /\{copy\.unavailableTitle\}/)
  assert.match(appSource, /import \{ apiErrorMessage \} from '\.\/api\/apiErrorMessages\.js'/)
  assert.match(appSource, /\{apiErrorMessage\(error, language\) \|\| copy\.retryHelp\}/)
  assert.doesNotMatch(appSource, /error\?\.message|error\.message/)
  assert.match(appSource, /\{copy\.retry\}/)
  assert.match(appSource, /onClick=\{\(\) => void restore\(\{ retry: true \}\)\}/)
})

test('App state labels are available in both supported languages', async () => {
  const { AUTH_TRANSLATIONS } = await import('./authTranslations.js')

  assert.equal(AUTH_TRANSLATIONS.en.app.restoring, 'Restoring your session…')
  assert.equal(AUTH_TRANSLATIONS.fr.app.restoring, 'Restauration de votre session…')
  assert.equal(AUTH_TRANSLATIONS.en.app.unavailableTitle, 'Your dashboard is temporarily unavailable')
  assert.equal(AUTH_TRANSLATIONS.fr.app.unavailableTitle, 'Votre tableau de bord est temporairement indisponible')
  assert.equal(AUTH_TRANSLATIONS.en.app.retry, 'Try again')
  assert.equal(AUTH_TRANSLATIONS.fr.app.retry, 'Réessayer')
})

test('anonymous protected routes still redirect to Sign In', () => {
  assert.equal(resolveAuthRoute('/main', 'anonymous'), 'redirect')
  assert.equal(resolveAuthRoute('/georeport/parcel-uuid', 'anonymous', { isGeoReport: true }), 'redirect')
  assert.match(appSource, /if \(status === 'anonymous' && \(isMain \|\| isGeoReport\)\) window\.location\.replace\('\/signin'\)/)
  assert.match(appSource, /if \(routeView === 'redirect'\)/)
})

test('authenticated Main and GeoReport routes render their React pages', () => {
  assert.equal(resolveAuthRoute('/main', 'authenticated'), 'main')
  assert.equal(resolveAuthRoute('/georeport/parcel-uuid', 'authenticated', { isGeoReport: true }), 'georeport')
  assert.match(appSource, /if \(routeView === 'main'\) return <Main \/>/)
  assert.match(appSource, /if \(routeView === 'georeport'\) return <Suspense fallback=\{pageLoadingFallback\}><GeoReport parcelUuid=\{parcelUuid\} \/><\/Suspense>/)
})

test('unknown paths render a dedicated NotFound page regardless of session state', () => {
  for (const status of ['anonymous', 'authenticated', 'restoring', 'unavailable']) {
    assert.equal(resolveAuthRoute('/does-not-exist', status), 'notFound')
  }
  assert.match(appSource, /if \(routeView === 'notFound'\) return <NotFound lang=\{language\} \/>/)
  assert.match(appSource, /status === 'authenticated' && \(isSignIn \|\| isSignUp\)/)
})

test('GeoReport and legal pages are lazy-loaded with an accessible localized fallback', () => {
  assert.match(appSource, /const GeoReport = lazy\(\(\) => import\('\.\/pages\/GeoReport\.jsx'\)\)/)
  assert.match(appSource, /const LegalPage = lazy\(\(\) => import\('\.\/pages\/LegalPage\.jsx'\)\)/)
  assert.match(appSource, /role="status" aria-live="polite">\s*\{language === 'fr' \? 'Chargement…' : 'Loading…'\}/)
  assert.match(appSource, /if \(legalDocument\) return <Suspense fallback=\{pageLoadingFallback\}><LegalPage document=\{legalDocument\} \/><\/Suspense>/)
})

test('auth route resolution is pure and does not alter the saved session', () => {
  const storedSession = Object.freeze({ accessToken: 'kept-access', refreshToken: 'kept-refresh' })
  const before = { ...storedSession }

  assert.equal(resolveAuthRoute('/signin', 'unavailable'), 'signin')
  assert.equal(resolveAuthRoute('/signup', 'unavailable'), 'signup')
  assert.deepEqual(storedSession, before)
})
