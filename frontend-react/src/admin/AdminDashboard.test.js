import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ApiError } from '../api/client.js'
import { resolveAdminRoute } from './adminRoutes.js'
import { getAdminPageModel } from './adminViewModel.js'
import { ADMIN_DASHBOARD_DEFINITIONS } from './adminDashboardData.js'

let vite
let AdminDashboardView

before(async () => {
  vite = await createServer({ configFile: './vite.config.js', appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  ;({ AdminDashboardView } = await vite.ssrLoadModule('/src/admin/AdminDashboard.jsx'))
})

after(async () => { await vite?.close() })

const model = getAdminPageModel(resolveAdminRoute('/admin/dashboard'))
const metrics = {
  as_of: '2026-10-19T12:00:00+00:00',
  for_sale: { count: 12, period: { kind: 'current_snapshot' }, definition: ADMIN_DASHBOARD_DEFINITIONS.for_sale },
  contacted_parcels: {
    count: 0,
    period: { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' },
    definition: ADMIN_DASHBOARD_DEFINITIONS.contacted_parcels,
  },
  awaiting_first_response: { count: 3, period: { kind: 'current_snapshot' }, definition: ADMIN_DASHBOARD_DEFINITIONS.awaiting_first_response },
  registrations: {
    count: 4,
    period: { start: '2026-10-01T00:00:00+00:00', end: '2026-11-01T00:00:00+00:00', month: '2026-10' },
    definition: ADMIN_DASHBOARD_DEFINITIONS.registrations,
  },
  recent_reports: {
    count: 2,
    period: { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' },
    definition: ADMIN_DASHBOARD_DEFINITIONS.recent_reports,
  },
}

test('dashboard orders five verified operational metrics and opens the matching filtered lists', () => {
  const markup = renderToStaticMarkup(React.createElement(AdminDashboardView, {
    model, state: { kind: 'ready', data: metrics }, onRetry() {},
  }))
  assert.ok(markup.indexOf('Annonces à vendre maintenant') < markup.indexOf('Annonces contactées'))
  assert.ok(markup.indexOf('Annonces contactées') < markup.indexOf('Conversations sans première réponse'))
  assert.ok(markup.indexOf('Conversations sans première réponse') < markup.indexOf('Inscriptions ce mois'))
  assert.ok(markup.indexOf('Inscriptions ce mois') < markup.indexOf('Constats internes récents'))
  assert.match(markup, />12<\/strong>/)
  assert.match(markup, />3<\/strong>/)
  assert.match(markup, />4<\/strong>/)
  assert.match(markup, />2<\/strong>/)
  assert.match(markup, /Aucune ligne correspondant à cette définition/)
  assert.match(markup, /Last 30 days UTC/)
  assert.match(markup, /UTC calendar month/)
  assert.match(markup, /not a processing or unresolved count/)
  assert.match(markup, /href="\/admin\/parcels\?sell_category=to_sell&amp;visibility=visible"/)
  assert.match(markup, /href="\/admin\/conversations\?awaiting_first_response=true"/)
  assert.match(markup, /href="\/admin\/users\?date_from=2026-10-01&amp;date_to=2026-10-31"/)
  assert.match(markup, /href="\/admin\/conversation-reports\?created_from=/)
  assert.match(markup, /href="\/admin\/parcels\?contacted_from=/)
  assert.doesNotMatch(markup, /Monthly revenue|Avg\. daily active users|1,200,000|Daily active users/)
})

test('dashboard distinguishes loading, error, and a genuine zero without invented values', () => {
  const loading = renderToStaticMarkup(React.createElement(AdminDashboardView, { model, state: { kind: 'loading' }, onRetry() {} }))
  const error = renderToStaticMarkup(React.createElement(AdminDashboardView, {
    model, state: { kind: 'error', error: new ApiError('network', 'private diagnostic') }, onRetry() {},
  }))
  const zeroData = { ...metrics, for_sale: { ...metrics.for_sale, count: 0 } }
  const zero = renderToStaticMarkup(React.createElement(AdminDashboardView, {
    model, state: { kind: 'ready', data: zeroData }, onRetry() {},
  }))

  assert.equal((loading.match(/role="status"/g) || []).length, 5)
  assert.match(error, /role="alert"/)
  assert.match(error, /Données indisponibles/)
  assert.doesNotMatch(error, /private diagnostic/)
  assert.match(zero, /Annonces à vendre maintenant[\s\S]*?>0<\/strong>[\s\S]*?Aucune ligne correspondant/)
  assert.match(zero, /href="\/admin\/parcels\?sell_category=to_sell&amp;visibility=visible"/)
})
