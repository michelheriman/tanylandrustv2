import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_DASHBOARD_DEFINITIONS,
  ADMIN_REGISTRATION_DEFINITION,
  isValidAdminDashboardMetrics,
  isValidAdminRegistrationDashboard,
} from './adminDashboardData.js'

function payload(monthly) {
  const current = monthly.at(-1)
  return {
    definition: ADMIN_REGISTRATION_DEFINITION,
    period: { start_month: monthly[0].month, end_month: current.month },
    current_month: current.month,
    current_month_count: current.count,
    monthly,
  }
}

test('registration dashboard accepts explicit zero months and a matching current card', () => {
  assert.equal(isValidAdminRegistrationDashboard(payload([
    { month: '2026-01', count: 0 },
    { month: '2026-02', count: 0 },
    { month: '2026-03', count: 7 },
  ])), true)
})

test('registration dashboard rejects missing months, a mismatched card, or an unbounded series', () => {
  const valid = payload([
    { month: '2026-01', count: 1 },
    { month: '2026-02', count: 2 },
  ])
  assert.equal(isValidAdminRegistrationDashboard({ ...valid, monthly: [valid.monthly[0], { ...valid.monthly[1], month: '2026-04' }] }), false)
  assert.equal(isValidAdminRegistrationDashboard({ ...valid, current_month_count: 3 }), false)
  assert.equal(isValidAdminRegistrationDashboard(payload(
    Array.from({ length: 25 }, (_, index) => ({ month: `2025-${String(index + 1).padStart(2, '0')}`, count: 0 })),
  )), false)
})

test('new dashboard metrics require all bounded periods, exact definitions, and nonnegative integer counts', () => {
  const valid = {
    as_of: '2026-10-19T12:00:00+00:00',
    for_sale: { count: 0, period: { kind: 'current_snapshot' }, definition: ADMIN_DASHBOARD_DEFINITIONS.for_sale },
    contacted_parcels: {
      count: 2, period: { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' },
      definition: ADMIN_DASHBOARD_DEFINITIONS.contacted_parcels,
    },
    awaiting_first_response: { count: 1, period: { kind: 'current_snapshot' }, definition: ADMIN_DASHBOARD_DEFINITIONS.awaiting_first_response },
    registrations: {
      count: 3, period: { start: '2026-10-01T00:00:00+00:00', end: '2026-11-01T00:00:00+00:00', month: '2026-10' },
      definition: ADMIN_DASHBOARD_DEFINITIONS.registrations,
    },
    recent_reports: {
      count: 4, period: { start: '2026-09-19T12:00:00+00:00', end: '2026-10-19T12:00:00+00:00' },
      definition: ADMIN_DASHBOARD_DEFINITIONS.recent_reports,
    },
  }
  assert.equal(isValidAdminDashboardMetrics(valid), true)
  assert.equal(isValidAdminDashboardMetrics({ ...valid, awaiting_first_response: undefined }), false)
  assert.equal(isValidAdminDashboardMetrics({ ...valid, recent_reports: { ...valid.recent_reports, definition: 'unprocessed reports' } }), false)
  assert.equal(isValidAdminDashboardMetrics({ ...valid, contacted_parcels: { ...valid.contacted_parcels, period: { start: '2026-10-01', end: '2026-10-02' } } }), false)
})
