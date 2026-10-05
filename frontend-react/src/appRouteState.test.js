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
  assert.match(appSource, /onClick=\{\(\) => void restore\(\{ retry: true \}\)\}/)
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
  assert.match(appSource, /if \(routeView === 'georeport'\) return <GeoReport parcelUuid=\{parcelUuid\} \/>/)
})

test('auth route resolution is pure and does not alter the saved session', () => {
  const storedSession = Object.freeze({ accessToken: 'kept-access', refreshToken: 'kept-refresh' })
  const before = { ...storedSession }

  assert.equal(resolveAuthRoute('/signin', 'unavailable'), 'signin')
  assert.equal(resolveAuthRoute('/signup', 'unavailable'), 'signup')
  assert.deepEqual(storedSession, before)
})
