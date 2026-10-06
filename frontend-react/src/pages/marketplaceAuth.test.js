import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'

test('React Marketplace sends its current bearer token to /api/market for a valid session', async () => {
  const session = { accessToken: 'access-valid', refreshToken: 'refresh-valid', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write() {}, clear() {} },
    fetchImpl: async (path, options = {}) => {
      const token = new Headers(options.headers).get('Authorization')
      calls.push({ path, token })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 1, email: 'market-test@example.test' } })
      if (path === '/api/market') return Response.json({ success: true, data: [] })
      throw new Error(`Unexpected mock request: ${path}`)
    },
  })
  await auth.restore()
  assert.deepEqual((await auth.request('/market')).data, [])
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', '/api/market'])
  assert.equal(calls[1].token, 'Bearer access-valid')
})

test('React Marketplace refreshes once when /api/market returns 401 for an expired access token', async () => {
  let session = { accessToken: 'access-old', refreshToken: 'refresh-old', user: null }
  const calls = []
  const storage = {
    read: () => session,
    write: (value) => { session = value },
    clear: () => { session = null },
  }
  const fetchImpl = async (path, options = {}) => {
    const token = new Headers(options.headers).get('Authorization')
    calls.push({ path, token })
    if (path === '/api/current_user') return Response.json({ success: true, data: { id: 1, email: 'market-test@example.test' } })
    if (path === '/api/market' && token === 'Bearer access-old') return Response.json({ success: false }, { status: 401 })
    if (path === '/api/refresh-token') return Response.json({ success: true, token: 'access-new', refresh_token: 'refresh-new' })
    if (path === '/api/market' && token === 'Bearer access-new') return Response.json({ success: true, data: [] })
    throw new Error(`Unexpected mock request: ${path}`)
  }
  const auth = createAuthService({ storage, fetchImpl })
  await auth.restore()
  const result = await auth.request('/market')
  assert.deepEqual(result.data, [])
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', '/api/market', '/api/refresh-token', '/api/market'])
  assert.equal(calls[1].token, 'Bearer access-old')
  assert.equal(calls[3].token, 'Bearer access-new')
  assert.equal(session.refreshToken, 'refresh-new')
})
