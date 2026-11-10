import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdminReadRequest } from './adminReadRequest.js'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('identical admin GETs share only the in-flight request', async () => {
  const gate = deferred()
  const calls = []
  const request = createAdminReadRequest((path, options) => {
    calls.push({ path, options })
    return gate.promise
  })

  const first = request('/admin/me', { method: 'GET' })
  const second = request('/admin/me', { method: 'GET' })
  await Promise.resolve()
  assert.equal(calls.length, 1)
  gate.resolve({ success: true })
  assert.deepEqual(await Promise.all([first, second]), [{ success: true }, { success: true }])

  await request('/admin/me', { method: 'GET' })
  assert.equal(calls.length, 2, 'a settled response is fetched again')
})

test('admin reads for different paths stay independent and mutations are never coalesced', async () => {
  const calls = []
  const request = createAdminReadRequest(async (path, options) => {
    calls.push({ path, options })
    return { path }
  })

  await Promise.all([
    request('/admin/parcels', { method: 'GET' }),
    request('/admin/users', { method: 'GET' }),
  ])
  await Promise.all([
    request('/admin/parcels/5/delete', { method: 'POST' }),
    request('/admin/parcels/5/delete', { method: 'POST' }),
  ])

  assert.deepEqual(calls.map(({ path, options }) => [path, options.method]), [
    ['/admin/parcels', 'GET'], ['/admin/users', 'GET'],
    ['/admin/parcels/5/delete', 'POST'], ['/admin/parcels/5/delete', 'POST'],
  ])
})

test('session changes can discard pending admin reads without retaining privilege data', async () => {
  const gate = deferred()
  let calls = 0
  const request = createAdminReadRequest(() => { calls += 1; return gate.promise })
  const oldSessionRead = request('/admin/me')
  await Promise.resolve()
  request.clearInflight()
  const newSessionRead = request('/admin/me')
  await Promise.resolve()

  assert.equal(calls, 2)
  assert.equal(createAdminReadRequest(() => {}, 7).sessionScope, 7)
  gate.resolve({ success: true })
  await Promise.all([oldSessionRead, newSessionRead])
})
