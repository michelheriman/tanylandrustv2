export function buildAdminConversationListQuery({ page, perPage, awaitingFirstResponse }) {
  const query = { page, per_page: perPage }
  if (awaitingFirstResponse) query.awaiting_first_response = 'true'
  return query
}

export function readAdminConversationListFilter(search = '') {
  const params = new URLSearchParams(search)
  return params.get('awaiting_first_response') === 'true'
}

export function readAdminConversationReportPeriod(search = '') {
  const params = new URLSearchParams(search)
  const start = params.get('created_from')
  const end = params.get('created_to')
  if (!start || !end || !hasTimezone(start) || !hasTimezone(end)) return null
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) ||
      startMs >= endMs || endMs - startMs > 31 * 24 * 60 * 60 * 1000) return null
  return { created_from: start, created_to: end }
}

function hasTimezone(value) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
}

export function adminConversationReportListViewState({ loading, error, result }) {
  if (loading) return { kind: 'loading' }
  if (error) return { kind: 'error', error }
  if (!result || !Array.isArray(result.data)) return { kind: 'error', error: null }
  return result.data.length === 0
    ? { kind: 'empty', pagination: result.pagination, period: result.period }
    : { kind: 'ready', reports: result.data, pagination: result.pagination, period: result.period }
}
