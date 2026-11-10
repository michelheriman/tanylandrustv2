import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import {
  getAdminFailureKind,
  hideAdminParcel,
  createAdminConversationReport,
  loadAdminDashboardMetrics,
  loadAdminDashboardRegistrations,
  loadAdminConversation,
  loadAdminConversations,
  loadAdminConversationReports,
  loadAdminConversationReportList,
  loadAdminIdentity,
  loadAdminParcel,
  loadAdminParcels,
  loadAdminUser,
  loadAdminUsers,
  restoreAdminParcel,
} from './adminApi.js'
import { ADMIN_DASHBOARD_DEFINITIONS } from './adminDashboardData.js'

test('registration dashboard loader uses a bounded month query and validates card/chart agreement', async () => {
  const calls = []
  const payload = {
    definition: 'Profiles still present, grouped by created_at in UTC calendar months; not a lifetime count of all accounts ever created.',
    period: { start_month: '2026-01', end_month: '2026-03' },
    current_month: '2026-03',
    current_month_count: 4,
    monthly: [
      { month: '2026-01', count: 0 },
      { month: '2026-02', count: 2 },
      { month: '2026-03', count: 4 },
    ],
  }
  const data = await loadAdminDashboardRegistrations(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: payload }
  }, 3)

  assert.deepEqual(calls, [{
    path: '/admin/dashboard/registrations?months=3',
    options: { method: 'GET' },
  }])
  assert.equal(data.current_month_count, data.monthly.at(-1).count)
  await assert.rejects(
    loadAdminDashboardRegistrations(async () => ({
      data: { ...payload, current_month_count: 5 },
    }), 3),
    (error) => error.kind === 'protocol',
  )
  await assert.rejects(loadAdminDashboardRegistrations(async () => {}, 25), (error) => error.kind === 'protocol')
})

function createMockStorage() {
  let value = null
  return {
    read: () => value,
    write: (next) => { value = next },
    clear: () => { value = null },
  }
}

function createApiHarness(adminResponses) {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url, 'http://localhost').pathname
    const headers = new Headers(options.headers)
    calls.push({ path, method: options.method ?? 'GET', authorization: headers.get('Authorization'), body: options.body })

    if (path === '/api/login') {
      return Response.json({
        success: true,
        token: 'access-before-check',
        refresh_token: 'refresh-before-check',
        user: { id: 21, email: 'test-admin@example.test', name: 'Test Admin', username: 'test-admin' },
      })
    }
    if (path === '/api/refresh-token') {
      return Response.json({ success: true, token: 'access-after-refresh', refresh_token: 'refresh-after-refresh' })
    }
    if (path === '/api/admin/me') {
      const response = adminResponses.shift()
      if (!response) throw new Error('Unexpected admin API call')
      return response
    }
    throw new Error(`Unexpected API route: ${path}`)
  }

  const auth = createAuthService({ storage: createMockStorage(), fetchImpl })
  return { auth, calls }
}

test('200 admin identity uses only /api/admin/me and keeps only the required own-profile fields', async () => {
  const { auth, calls } = createApiHarness([
    Response.json({
      success: true,
      data: {
        profile: { id: 3, uuid: 'profile-uuid', name: 'Local Admin', username: 'admin', email: 'private@example.test' },
        admin: { role: 'admin' },
      },
    }),
  ])
  await auth.login('test-admin@example.test', 'test-password')

  const identity = await loadAdminIdentity(auth.request)

  assert.deepEqual(calls.map(({ path }) => path), ['/api/login', '/api/admin/me'])
  assert.equal(calls[1].method, 'GET')
  assert.equal(calls[1].authorization, 'Bearer access-before-check')
  assert.deepEqual(identity, { profile: { id: 3, name: 'Local Admin', username: 'admin' }, admin: { role: 'admin' } })
  assert.equal(Object.hasOwn(identity.profile, 'email'), false)
})

test('401 from admin verification follows the shared refresh flow and retries once', async () => {
  const { auth, calls } = createApiHarness([
    Response.json({ success: false }, { status: 401 }),
    Response.json({ success: true, data: { profile: { id: 3 }, admin: { role: 'admin' } } }),
  ])
  await auth.login('test-admin@example.test', 'test-password')

  await loadAdminIdentity(auth.request)

  assert.deepEqual(calls.map(({ path }) => path), ['/api/login', '/api/admin/me', '/api/refresh-token', '/api/admin/me'])
  assert.equal(calls[1].authorization, 'Bearer access-before-check')
  assert.equal(calls[2].method, 'POST')
  assert.deepEqual(JSON.parse(calls[2].body), { refresh_token: 'refresh-before-check' })
  assert.equal(calls[3].authorization, 'Bearer access-after-refresh')
})

test('401 after refresh rejection returns to the signed-out access state', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    const path = new URL(url, 'http://localhost').pathname
    calls.push(path)
    if (path === '/api/login') return Response.json({ success: true, token: 'expired', refresh_token: 'expired-refresh', user: { id: 8, email: 'ordinary@example.test' } })
    if (path === '/api/admin/me' || path === '/api/refresh-token') return Response.json({ success: false }, { status: 401 })
    throw new Error(`Unexpected API route: ${path}`)
  }
  const auth = createAuthService({ storage: createMockStorage(), fetchImpl })
  await auth.login('ordinary@example.test', 'test-password')

  await assert.rejects(loadAdminIdentity(auth.request), (error) => {
    assert.equal(error.status, 401)
    assert.equal(getAdminFailureKind(error), 'anonymous')
    return true
  })
  assert.deepEqual(calls, ['/api/login', '/api/admin/me', '/api/refresh-token'])
  assert.equal(auth.getSnapshot().status, 'anonymous')
})

test('403 from admin verification is an explicit denial and is not retried', async () => {
  const { auth, calls } = createApiHarness([Response.json({ success: false }, { status: 403 })])
  await auth.login('ordinary@example.test', 'test-password')

  await assert.rejects(loadAdminIdentity(auth.request), (error) => {
    assert.equal(error.status, 403)
    assert.equal(getAdminFailureKind(error), 'denied')
    return true
  })
  assert.deepEqual(calls.map(({ path }) => path), ['/api/login', '/api/admin/me'])
})

test('an incomplete successful response fails closed', async () => {
  const { auth } = createApiHarness([Response.json({ success: true, data: { profile: { id: 3 }, admin: { role: 'moderator' } } })])
  await auth.login('test-admin@example.test', 'test-password')
  await assert.rejects(loadAdminIdentity(auth.request), (error) => error.kind === 'protocol')
})

test('parcel list uses the admin API with only supported filter parameters', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: [], pagination: { page: 2, per_page: 5, total: 0, pages: 1 } }
  }

  const result = await loadAdminParcels(request, {
    page: 2, per_page: 5, q: 'synthetic land', sort: 'name', direction: 'asc',
    date_from: '2026-09-01', date_to: '2026-09-30', ignored: 'must not be sent',
  })

  assert.deepEqual(calls, [{
    path: '/admin/parcels?page=2&per_page=5&q=synthetic+land&sort=name&direction=asc&date_from=2026-09-01&date_to=2026-09-30',
    options: { method: 'GET' },
  }])
  assert.deepEqual(result, { data: [], pagination: { page: 2, per_page: 5, total: 0, pages: 1 } })
})

test('parcel detail uses an encoded bigint route and preserves API 404 errors', async () => {
  const calls = []
  const request = async (path, options) => { calls.push({ path, options }); return { success: true, data: { id: '9007199254741003' } } }

  const result = await loadAdminParcel(request, '9007199254741003')

  assert.deepEqual(calls, [{ path: '/admin/parcels/9007199254741003', options: { method: 'GET' } }])
  assert.equal(result.id, '9007199254741003')
  await assert.rejects(loadAdminParcel(async () => { throw Object.assign(new Error('not found'), { status: 404 }) }, '82'), (error) => error.status === 404)
})

test('manual visibility accepts the online flat RPC and local nested response contracts', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push({ path, options })
    const action = path.endsWith('/hide') ? 'hide' : 'restore'
    const decision = {
      parcel_id: action === 'hide' ? 81 : '81',
      is_hidden: action === 'hide', action, reason: 'reviewed',
      admin_id: action === 'hide' ? 9 : '9',
      decision_id: action === 'hide' ? 1 : '2',
      created_at: '2026-10-19T12:30:00+00:00',
    }
    return action === 'hide'
      ? { success: true, ...decision, visibility_state_id: 4 }
      : { success: true, data: decision }
  }

  assert.deepEqual(await hideAdminParcel(request, '81', '  reviewed  '), {
    parcel_id: '81', is_hidden: true, action: 'hide', reason: 'reviewed',
    admin_id: '9', decision_id: '1', created_at: '2026-10-19T12:30:00+00:00',
  })
  assert.deepEqual(await restoreAdminParcel(request, '81', 'reviewed'), {
    parcel_id: '81', is_hidden: false, action: 'restore', reason: 'reviewed',
    admin_id: '9', decision_id: '2', created_at: '2026-10-19T12:30:00+00:00',
  })
  assert.deepEqual(calls, [
    { path: '/admin/parcels/81/visibility/hide', options: { method: 'POST', body: '{"reason":"reviewed"}' } },
    { path: '/admin/parcels/81/visibility/restore', options: { method: 'POST', body: '{"reason":"reviewed"}' } },
  ])
  await assert.rejects(hideAdminParcel(request, '81', '   '), (error) => error.kind === 'protocol')
  await assert.rejects(restoreAdminParcel(request, '81', 'x'.repeat(1001)), (error) => error.kind === 'protocol')
})

test('parcel API rejects malformed success payloads without accepting fabricated pagination', async () => {
  await assert.rejects(
    loadAdminParcels(async () => ({ success: true, data: [], pagination: { page: 1, per_page: 20, total: -1, pages: 1 } })),
    (error) => error.kind === 'protocol',
  )
  await assert.rejects(loadAdminParcel(async () => ({ success: true, data: [] }), '1'), (error) => error.kind === 'protocol')
})

test('user list sends only supported filters through the admin route', async () => {
  const calls = []
  const request = async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: [], pagination: { page: 1, per_page: 20, total: 0, pages: 1 } }
  }
  const result = await loadAdminUsers(request, {
    page: 1, per_page: 20, q: 'test user', sort: 'date', direction: 'desc',
    date_from: '2026-09-01', ignored: 'not forwarded',
  })

  assert.deepEqual(calls, [{
    path: '/admin/users?page=1&per_page=20&q=test+user&sort=date&direction=desc&date_from=2026-09-01',
    options: { method: 'GET' },
  }])
  assert.deepEqual(result.data, [])
})

test('user detail uses profile bigint path and preserves a missing-profile response', async () => {
  const calls = []
  const user = {
    id: '9007199254741003', name: 'Synthetic User',
    effective_offer: { code: 'free', parcel_limit: 2, can_delete_owned_parcels: false },
    parcel_association: {
      available: true, total_associated: 0, for_sale_count: 0, data: [],
      pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
    },
  }
  const result = await loadAdminUser(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: user }
  }, '9007199254741003')

  assert.deepEqual(calls, [{ path: '/admin/users/9007199254741003?page=1&per_page=20', options: { method: 'GET' } }])
  assert.equal(result.name, 'Synthetic User')
  await assert.rejects(loadAdminUser(async () => { throw Object.assign(new Error('not found'), { status: 404 }) }, '82'), (error) => error.status === 404)
})

test('user detail requests bounded parcel pagination and rejects unsafe association payloads', async () => {
  const calls = []
  const detail = {
    id: '3',
    effective_offer: { code: 'free', parcel_limit: 2, can_delete_owned_parcels: false },
    parcel_association: {
      available: true, total_associated: 4, for_sale_count: 2,
      data: [{ id: '9007199254741003', parcel_name: 'Parcel', location_name: null, sell_category: 'to_sell', created_at: null }],
      pagination: { page: 2, per_page: 1, total: 4, pages: 4 },
    },
  }
  const result = await loadAdminUser(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: detail }
  }, '3', { page: 2, per_page: 1 })
  assert.deepEqual(calls, [{ path: '/admin/users/3?page=2&per_page=1', options: { method: 'GET' } }])
  assert.equal(result.parcel_association.data[0].id, '9007199254741003')

  await assert.rejects(loadAdminUser(async () => ({
    success: true,
    data: { id: '3', parcel_association: { available: false, total_associated: 1, for_sale_count: 1, data: [], pagination: null } },
  }), '3'), (error) => error.kind === 'protocol')
  await assert.rejects(loadAdminUser(async () => ({
    success: true,
    data: { ...detail, effective_offer: { code: 'pro', parcel_limit: 2, can_delete_owned_parcels: true } },
  }), '3'), (error) => error.kind === 'protocol')
})

test('conversation list requests bounded pages and validates linked-history metadata', async () => {
  const calls = []
  const result = await loadAdminConversations(async (path, options) => {
    calls.push({ path, options })
    return {
      success: true,
      data: [{
        conversation_id: '9007199254741003', parcel_id: '42', parcel_name: 'Synthetic parcel',
        created_at: '2026-10-15T00:00:00Z',
        participants: [{ profile_id: '31', name: 'Synthetic buyer', username: 'buyer' }],
        last_message: { id: '9007199254741005', created_at: '2026-10-15T09:00:00Z', content: 'Linked text' },
      }],
      pagination: { page: 2, per_page: 1, total: 4, pages: 4 },
      unlinked_history_excluded: true,
    }
  }, { page: 2, per_page: 1, ignored: 'not sent' })

  assert.deepEqual(calls, [{ path: '/admin/conversations?page=2&per_page=1', options: { method: 'GET' } }])
  assert.equal(result.data[0].conversation_id, '9007199254741003')
  assert.equal(result.unlinkedHistoryExcluded, true)
  await assert.rejects(loadAdminConversations(async () => ({
    success: true, data: [], pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
  })), (error) => error.kind === 'protocol')
})

test('conversation detail uses the stable ID and preserves 404 and linked-message shape', async () => {
  const calls = []
  const detail = {
    conversation: { conversation_id: '73', parcel_id: null, parcel_name: null, created_at: null },
    participants: [{ profile_id: '31', name: 'Synthetic buyer', username: 'buyer' }],
    messages: [{
      id: '9007199254741007', created_at: '2026-10-15T09:00:00Z',
      sender_profile_id: '31', receiver_profile_id: '32', content: 'Linked message',
    }],
  }
  const result = await loadAdminConversation(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: detail, unlinked_history_excluded: true }
  }, '73')

  assert.deepEqual(calls, [{ path: '/admin/conversations/73', options: { method: 'GET' } }])
  assert.deepEqual(result, { ...detail, unlinkedHistoryExcluded: true })
  await assert.rejects(
    loadAdminConversation(async () => { throw Object.assign(new Error('not found'), { status: 404 }) }, '73'),
    (error) => error.status === 404,
  )
  await assert.rejects(loadAdminConversation(async () => ({
    success: true, unlinked_history_excluded: true,
    data: { ...detail, messages: [{ ...detail.messages[0], sender_profile_id: 31 }] },
  }), '73'), (error) => error.kind === 'protocol')
})

test('internal conversation reports use only the admin report API and validate bounded notes', async () => {
  const calls = []
  const report = { id: '17', finding: 'Internal review note', created_at: '2026-10-16T09:00:00Z' }
  const reports = await loadAdminConversationReports(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: [report] }
  }, '73')
  assert.deepEqual(calls, [{ path: '/admin/conversations/73/reports', options: { method: 'GET' } }])
  assert.deepEqual(reports, [report])

  const created = await createAdminConversationReport(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: report }
  }, '73', '  Internal review note  ')
  assert.deepEqual(created, report)
  assert.deepEqual(calls[1], {
    path: '/admin/conversations/73/reports',
    options: { method: 'POST', body: JSON.stringify({ finding: 'Internal review note' }) },
  })
  await assert.rejects(createAdminConversationReport(async () => {}, '73', '  '), (error) => error.kind === 'protocol')
  await assert.rejects(createAdminConversationReport(async () => {}, '73', 'x'.repeat(2001)), (error) => error.kind === 'protocol')
  await assert.rejects(loadAdminConversationReports(async () => ({ data: [{ ...report, finding: '' }] }), '73'), (error) => error.kind === 'protocol')
})

test('dashboard metrics loader requires five valid indicators from the protected API', async () => {
  const calls = []
  const data = {
    as_of: '2026-10-19T12:00:00+00:00',
    for_sale: { count: 0, period: { kind: 'current_snapshot' }, definition: ADMIN_DASHBOARD_DEFINITIONS.for_sale },
    contacted_parcels: { count: 0, period: { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' }, definition: ADMIN_DASHBOARD_DEFINITIONS.contacted_parcels },
    awaiting_first_response: { count: 0, period: { kind: 'current_snapshot' }, definition: ADMIN_DASHBOARD_DEFINITIONS.awaiting_first_response },
    registrations: { count: 0, period: { start: '2026-10-01T00:00:00+00:00', end: '2026-11-01T00:00:00+00:00', month: '2026-10' }, definition: ADMIN_DASHBOARD_DEFINITIONS.registrations },
    recent_reports: { count: 0, period: { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' }, definition: ADMIN_DASHBOARD_DEFINITIONS.recent_reports },
  }
  const result = await loadAdminDashboardMetrics(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data }
  })
  assert.deepEqual(calls, [{ path: '/admin/dashboard/metrics', options: { method: 'GET' } }])
  assert.equal(result.for_sale.count, 0)
  await assert.rejects(loadAdminDashboardMetrics(async () => ({ data: { ...data, recent_reports: undefined } })), (error) => error.kind === 'protocol')
})

test('parcel API sends category and contact-period filters as query parameters only', async () => {
  const calls = []
  await loadAdminParcels(async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: [], pagination: { page: 1, per_page: 20, total: 0, pages: 1 } }
  }, {
    page: 1, per_page: 20, sell_category: 'to_sell',
    contacted_from: '2026-09-19T12:00:00+00:00', contacted_to: '2026-10-19T12:00:00+00:00',
    ignored: 'no',
  })
  assert.match(calls[0].path, /sell_category=to_sell/)
  assert.match(calls[0].path, /contacted_from=2026-09-19T12%3A00%3A00%2B00%3A00/)
  assert.match(calls[0].path, /contacted_to=2026-10-19T12%3A00%3A00%2B00%3A00/)
  assert.doesNotMatch(calls[0].path, /ignored/)
})

test('conversation API forwards the first-response filter without changing default list behavior', async () => {
  const calls = []
  const responder = async (path, options) => {
    calls.push({ path, options })
    return { success: true, data: [], pagination: { page: 1, per_page: 20, total: 0, pages: 1 }, unlinked_history_excluded: true }
  }
  await loadAdminConversations(responder, { page: 1, per_page: 20, awaiting_first_response: 'true' })
  assert.equal(calls[0].path, '/admin/conversations?page=1&per_page=20&awaiting_first_response=true')
  await loadAdminConversations(responder, { page: 1, per_page: 20 })
  assert.equal(calls[1].path, '/admin/conversations?page=1&per_page=20')
})

test('recent internal findings list validates bounded period, pagination, and row targets', async () => {
  const calls = []
  const period = { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' }
  const result = await loadAdminConversationReportList(async (path, options) => {
    calls.push({ path, options })
    return {
      success: true, period,
      data: [{ id: '52', conversation_id: '73', finding: 'Synthetic internal note', created_at: period.end, parcel_id: null, parcel_name: null }],
      pagination: { page: 2, per_page: 1, total: 3, pages: 3 },
    }
  }, { created_from: period.start, created_to: period.end, page: 2, per_page: 1 })
  assert.deepEqual(calls, [{
    path: '/admin/conversation-reports?created_from=2026-09-19T12%3A00%3A00%2B00%3A00&created_to=2026-10-19T12%3A00%3A00%2B00%3A00&page=2&per_page=1',
    options: { method: 'GET' },
  }])
  assert.equal(result.pagination.total, 3)
  assert.equal(result.data[0].conversation_id, '73')
  await assert.rejects(loadAdminConversationReportList(async () => ({
    period, data: [], pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
  }), { created_from: '2026-09-19T12:00:00+00:00', created_to: '2026-10-20T12:00:00+00:00' }), (error) => error.kind === 'protocol')
})
