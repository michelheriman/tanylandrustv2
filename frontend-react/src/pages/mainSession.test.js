import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import { createSessionStorage } from '../auth/storage.js'
import { loadParcels } from './mainData.js'

function response(status, data) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function setup(fetchImpl) {
  let saved = { accessToken: 'old-access', refreshToken: 'old-refresh', user: null }
  const storage = {
    read: () => saved,
    write: (value) => { saved = value },
    clear: () => { saved = null },
  }
  return { service: createAuthService({ storage, fetchImpl }), current: () => saved }
}

test('migrates legacy token keys and removes only authentication storage on clear', () => {
  const values = new Map([
    ['auth_token', 'old-access'],
    ['token', 'newer-access'],
    ['refresh_token', 'old-refresh'],
    ['user', '{"email":"user@example.test"}'],
    ['language', 'fr'],
  ])
  const browserStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const storage = createSessionStorage(() => browserStorage)

  assert.deepEqual(storage.read(), {
    accessToken: 'newer-access',
    refreshToken: 'old-refresh',
    user: { email: 'user@example.test' },
  })
  assert.equal(values.has('token'), false)
  assert.equal(values.has('auth_token'), false)
  assert.equal(values.has('refresh_token'), false)
  assert.equal(values.get('language'), 'fr')

  values.set('auth_token', 'stale-access')
  values.set('token', 'stale-access')
  values.set('refresh_token', 'stale-refresh')
  assert.equal(storage.read().accessToken, 'newer-access')
  assert.equal(values.has('auth_token'), false)
  assert.equal(values.has('token'), false)
  assert.equal(values.has('refresh_token'), false)

  storage.clear()
  assert.equal(values.has('tany.auth.session'), false)
  assert.equal(values.get('language'), 'fr')

  const incompleteValues = new Map([['auth_token', 'expired-access'], ['language', 'fr']])
  const incompleteStorage = createSessionStorage(() => ({
    getItem: (key) => incompleteValues.get(key) ?? null,
    setItem: (key, value) => incompleteValues.set(key, value),
    removeItem: (key) => incompleteValues.delete(key),
  }))
  assert.equal(incompleteStorage.read(), null)
  assert.equal(incompleteValues.has('auth_token'), false)
  assert.equal(incompleteValues.get('language'), 'fr')
})

test('a protected parcel load retries once after refreshing both tokens', async () => {
  let parcelCalls = 0
  let refreshCalls = 0
  const { service, current } = setup((path, options) => {
    if (path === '/api/current_user') return response(200, { success: true, data: { user_id: 1, email: 'user@example.test' } })
    if (path === '/api/refresh-token') { refreshCalls += 1; return response(200, { success: true, token: 'new-access', refresh_token: 'new-refresh' }) }
    if (path === '/api/map-data') {
      parcelCalls += 1
      return options.headers.get('Authorization') === 'Bearer new-access'
        ? response(200, { success: true, data: [{ id: 5 }] })
        : response(401, { success: false })
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  await service.restore()
  assert.deepEqual(await loadParcels(service.request), [{ id: 5 }])
  assert.equal(parcelCalls, 2)
  assert.equal(refreshCalls, 1)
  assert.equal(current().accessToken, 'new-access')
  assert.equal(current().refreshToken, 'new-refresh')
})

test('restores an expired access token with a valid refresh token and survives a page reload', async () => {
  let saved = { accessToken: 'expired-access', refreshToken: 'valid-refresh', user: null }
  let refreshCalls = 0
  const storage = {
    read: () => saved,
    write: (session) => { saved = session },
    clear: () => { saved = null },
  }
  const fetchImpl = (path, options) => {
    if (path === '/api/current_user') {
      return options.headers.get('Authorization') === 'Bearer expired-access'
        ? response(401, { success: false })
        : response(200, { success: true, data: { user_id: 8, email: 'user@example.test' } })
    }
    if (path === '/api/refresh-token') {
      refreshCalls += 1
      return response(200, { success: true, token: 'renewed-access', refresh_token: 'rotated-refresh' })
    }
    throw new Error(`Unexpected request: ${path}`)
  }

  const firstPage = createAuthService({ storage, fetchImpl })
  await firstPage.restore()
  assert.equal(firstPage.getSnapshot().status, 'authenticated')
  assert.equal(saved.accessToken, 'renewed-access')
  assert.equal(saved.refreshToken, 'rotated-refresh')
  assert.equal(refreshCalls, 1)

  const reloadedPage = createAuthService({ storage, fetchImpl })
  await reloadedPage.restore()
  assert.equal(reloadedPage.getSnapshot().status, 'authenticated')
  assert.equal(reloadedPage.getSnapshot().user.email, 'user@example.test')
  assert.equal(refreshCalls, 1)
})

test('clears only the session when the refresh token is rejected during restoration', async () => {
  let saved = { accessToken: 'expired-access', refreshToken: 'expired-refresh', user: null }
  const storage = {
    read: () => saved,
    write: (session) => { saved = session },
    clear: () => { saved = null },
  }
  const service = createAuthService({ storage, fetchImpl: (path) => path === '/api/current_user'
    ? response(401, { success: false })
    : response(401, { success: false }) })

  await service.restore()
  assert.equal(service.getSnapshot().status, 'anonymous')
  assert.equal(saved, null)
})

test('keeps the session when refresh returns a server error', async () => {
  let saved = { accessToken: 'expired-access', refreshToken: 'stored-refresh', user: null }
  const storage = {
    read: () => saved,
    write: (session) => { saved = session },
    clear: () => { saved = null },
  }
  const service = createAuthService({ storage, fetchImpl: (path) => path === '/api/current_user'
    ? response(401, { success: false })
    : response(503, { success: false }) })

  await service.restore()
  assert.equal(service.getSnapshot().status, 'unavailable')
  assert.deepEqual(saved, { accessToken: 'expired-access', refreshToken: 'stored-refresh', user: null })
})

test('keeps the session when refresh fails because of a network error', async () => {
  let saved = { accessToken: 'expired-access', refreshToken: 'stored-refresh', user: null }
  const storage = {
    read: () => saved,
    write: (session) => { saved = session },
    clear: () => { saved = null },
  }
  const service = createAuthService({ storage, fetchImpl: (path) => {
    if (path === '/api/current_user') return response(401, { success: false })
    throw new TypeError('network unavailable')
  } })

  await service.restore()
  assert.equal(service.getSnapshot().status, 'unavailable')
  assert.deepEqual(saved, { accessToken: 'expired-access', refreshToken: 'stored-refresh', user: null })
  assert.equal(service.getSnapshot().error.kind, 'network')
})

test('a server error during parcel loading keeps the session', async () => {
  const { service, current } = setup((path) => path === '/api/current_user'
    ? response(200, { success: true, data: { user_id: 1, email: 'user@example.test' } })
    : response(500, { success: false }))
  await service.restore()
  await assert.rejects(loadParcels(service.request), { kind: 'server' })
  assert.equal(service.getSnapshot().status, 'authenticated')
  assert.ok(current())
})

test('a rejected refresh closes an expired session', async () => {
  const { service, current } = setup((path) => path === '/api/current_user'
    ? response(200, { success: true, data: { user_id: 1, email: 'user@example.test' } })
    : response(401, { success: false }))
  await service.restore()
  await assert.rejects(loadParcels(service.request), { kind: 'auth' })
  assert.equal(service.getSnapshot().status, 'anonymous')
  assert.equal(current(), null)
})

test('does not retry in a loop when a request still returns 401 after refresh', async () => {
  let parcelCalls = 0
  let refreshCalls = 0
  const { service, current } = setup((path) => {
    if (path === '/api/current_user') return response(200, { success: true, data: { user_id: 1, email: 'user@example.test' } })
    if (path === '/api/refresh-token') { refreshCalls += 1; return response(200, { success: true, token: 'new-access', refresh_token: 'new-refresh' }) }
    if (path === '/api/map-data') { parcelCalls += 1; return response(401, { success: false }) }
    throw new Error(`Unexpected request: ${path}`)
  })

  await service.restore()
  await assert.rejects(loadParcels(service.request), { kind: 'auth' })
  assert.equal(parcelCalls, 2)
  assert.equal(refreshCalls, 1)
  assert.equal(service.getSnapshot().status, 'anonymous')
  assert.equal(current(), null)
})

test('shares one refresh across concurrent protected requests', async () => {
  let refreshCalls = 0
  const { service, current } = setup((path, options) => {
    if (path === '/api/current_user') return response(200, { success: true, data: { user_id: 1, email: 'user@example.test' } })
    if (path === '/api/refresh-token') {
      refreshCalls += 1
      return response(200, { success: true, token: 'new-access', refresh_token: 'new-refresh' })
    }
    if (path === '/api/first' || path === '/api/second') {
      return options.headers.get('Authorization') === 'Bearer new-access'
        ? response(200, { success: true, data: path })
        : response(401, { success: false })
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  await service.restore()
  const results = await Promise.all([service.request('/first'), service.request('/second')])
  assert.deepEqual(results.map((result) => result.data), ['/api/first', '/api/second'])
  assert.equal(refreshCalls, 1)
  assert.equal(current().accessToken, 'new-access')
  assert.equal(current().refreshToken, 'new-refresh')
})

test('KML export uses the same renewed session and returns the server file', async () => {
  let exports = 0
  const { service, current } = setup((path, options) => {
    if (path === '/api/current_user') return response(200, { success: true, data: { user_id: 1, email: 'user@example.test' } })
    if (path === '/api/refresh-token') return response(200, { success: true, token: 'new-access', refresh_token: 'new-refresh' })
    if (path === '/export/kml') {
      exports += 1
      return options.headers.Authorization === 'Bearer new-access'
        ? new Response('<kml/>', { status: 200, headers: { 'Content-Type': 'application/vnd.google-earth.kml+xml' } })
        : response(401, { success: false })
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  await service.restore()
  assert.equal(await (await service.downloadKml()).text(), '<kml/>')
  assert.equal(exports, 2)
  assert.equal(current().refreshToken, 'new-refresh')
})
