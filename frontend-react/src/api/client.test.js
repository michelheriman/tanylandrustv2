import assert from 'node:assert/strict'
import test from 'node:test'
import { requestJson } from './client.js'

test('requestJson classifies network errors without exposing exception details', async () => {
  await assert.rejects(
    requestJson('/market', {}, async () => { throw new Error('secret transport detail') }),
    (error) => error.kind === 'network' && error.status === 0 && !error.message.includes('secret transport detail'),
  )
})

test('requestJson preserves HTTP statuses and never exposes backend error bodies', async () => {
  for (const status of [401, 403, 404, 500, 503]) {
    await assert.rejects(
      requestJson('/market', {}, async () => Response.json({ message: 'SECRET backend traceback' }, { status })),
      (error) => {
        assert.equal(error.status, status)
        assert.equal(error.kind, status === 401 ? 'auth' : status >= 500 ? 'server' : 'request')
        assert.equal(error.message.includes('SECRET backend traceback'), false)
        return true
      },
    )
  }
})

test('requestJson classifies malformed and empty successful responses as protocol errors', async () => {
  for (const response of [
    new Response('not-json', { status: 200 }),
    new Response(null, { status: 204 }),
  ]) {
    await assert.rejects(
      requestJson('/market', {}, async () => response),
      (error) => error.kind === 'protocol' && error.status === response.status,
    )
  }
})
