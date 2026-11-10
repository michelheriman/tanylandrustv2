import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_ASSISTANCE_PATH,
  loadAdminAssistance,
  loadAdminAssistanceDetail,
  reassignAdminAssistance,
  replyAdminAssistance,
  resolveAdminAssistance,
  takeAdminAssistance,
} from './adminAssistanceData.js'

const stamp = '2026-10-27T10:00:00+00:00'
const person = { profile_id: '31', name: 'Admin', username: 'admin' }
const preview = {
  conversation_id: '73', subject: 'Account access', status: 'open',
  customer: { profile_id: '12', name: 'Client', username: 'client', email: 'client@example.test' },
  assigned_admin: null, created_at: stamp, updated_at: stamp, resolved_at: null,
  last_message: { content: 'Need help', created_at: stamp },
}
const detail = {
  ...preview, current_admin_profile_id: '31',
  messages: [{ id: '1', author_profile_id: '12', author_role: 'customer', author: preview.customer, content: 'Need help', created_at: stamp }],
  assignment_history: [{ id: '1', previous_admin: null, new_admin: person, changed_by: person, change_kind: 'take', changed_at: stamp }],
  active_admins: [person],
}

test('loads the shared queue with bounded state filters and checks its response contract', async () => {
  let call
  const result = await loadAdminAssistance(async (path, options) => {
    call = { path, options }
    return { success: true, data: [preview], pagination: { page: 1, per_page: 20, total: 1, pages: 1 }, status: 'open' }
  })
  assert.equal(call.path, `${ADMIN_ASSISTANCE_PATH}?status=open&page=1&per_page=20`)
  assert.equal(call.options.method, 'GET')
  assert.deepEqual(result.data, [preview])
  await assert.rejects(loadAdminAssistance(async () => ({ success: true, data: [{}], pagination: {}, status: 'open' })), /liste Assistance invalide/)
})

test('loads a detail containing customer/admin messages and assignment audit', async () => {
  let path
  const result = await loadAdminAssistanceDetail(async (requestPath) => {
    path = requestPath
    return { success: true, data: detail }
  }, '73')
  assert.equal(path, `${ADMIN_ASSISTANCE_PATH}/73`)
  assert.deepEqual(result, detail)
  await assert.rejects(loadAdminAssistanceDetail(async () => ({ success: true, data: { ...detail, assignment_history: [{ ...detail.assignment_history[0], changed_by: null }] } }), '73'), /détail Assistance invalide/)
})

test('actions send only the fields the client is allowed to choose', async () => {
  const calls = []
  const request = async (path, options) => {
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ path, method: options.method, body })
    if (path.endsWith('/reply')) return { success: true, data: { conversation_id: '73', message: { id: '4', author_profile_id: '31', author_role: 'admin', content: 'Answer' } } }
    if (path.endsWith('/resolve')) return { success: true, data: { conversation_id: '73', status: 'resolved' } }
    return { success: true, data: { conversation_id: '73', assigned_admin_profile_id: '42' } }
  }
  await takeAdminAssistance(request, '73')
  await reassignAdminAssistance(request, '73', '42')
  await replyAdminAssistance(request, '73', ' Answer ')
  await resolveAdminAssistance(request, '73')
  assert.deepEqual(calls.map(({ body }) => body), [{}, { assignee_profile_id: '42' }, { content: 'Answer' }, {}])
  assert.deepEqual(calls.map(({ path }) => path), [
    `${ADMIN_ASSISTANCE_PATH}/73/take`, `${ADMIN_ASSISTANCE_PATH}/73/reassign`,
    `${ADMIN_ASSISTANCE_PATH}/73/reply`, `${ADMIN_ASSISTANCE_PATH}/73/resolve`,
  ])
  assert.equal(calls[1].method, 'POST')
})

test('rejects the old flat Flask reply payload instead of treating it as a sent message', async () => {
  await assert.rejects(
    replyAdminAssistance(async (path, options) => {
      assert.equal(path, `${ADMIN_ASSISTANCE_PATH}/73/reply`)
      assert.equal(options.method, 'POST')
      assert.deepEqual(JSON.parse(options.body), { content: 'Answer' })
      return {
        success: true,
        data: {
          id: '4', conversation_id: '73', author_profile_id: '31', author_role: 'admin',
          author: person, content: 'Answer', created_at: stamp,
        },
      }
    }, '73', 'Answer'),
    /message Assistance invalide/,
  )
})
