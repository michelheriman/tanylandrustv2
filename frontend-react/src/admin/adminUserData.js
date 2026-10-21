export const ADMIN_USER_UNAVAILABLE = 'Donnée indisponible'

export function buildAdminUserListQuery(filters) {
  const query = {
    page: filters.page,
    per_page: filters.perPage,
    sort: filters.sort,
    direction: filters.direction,
  }
  if (filters.search.trim()) query.q = filters.search.trim()
  if (filters.dateFrom) query.date_from = filters.dateFrom
  if (filters.dateTo) query.date_to = filters.dateTo
  return query
}

export function readAdminUserDateFilters(search = '') {
  const params = new URLSearchParams(search)
  const dateFrom = params.get('date_from') || ''
  const dateTo = params.get('date_to') || ''
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  return {
    dateFrom: isDate(dateFrom) ? dateFrom : '',
    dateTo: isDate(dateTo) ? dateTo : '',
  }
}

export function adminUserListViewState({ loading, error, result }) {
  if (loading) return { kind: 'loading' }
  if (error) return { kind: 'error', error }
  if (!result || !Array.isArray(result.data)) return { kind: 'error', error: null }
  if (result.data.length === 0) return { kind: 'empty', pagination: result.pagination }
  return { kind: 'ready', users: result.data, pagination: result.pagination }
}

export function adminUserDetailViewState({ loading, error, user }) {
  if (loading) return { kind: 'loading' }
  if (error?.status === 404) return { kind: 'notFound' }
  if (error) return { kind: 'error', error }
  if (!user || typeof user !== 'object') return { kind: 'error', error: null }
  return { kind: 'ready', user }
}

export function formatAdminUserDate(value, locale = 'en-GB') {
  if (!value) return ADMIN_USER_UNAVAILABLE
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ADMIN_USER_UNAVAILABLE
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function displayAdminUserValue(value) {
  return value === null || value === undefined || value === ''
    ? ADMIN_USER_UNAVAILABLE
    : String(value)
}

export function getAdminUserInitial(user) {
  const source = typeof user?.name === 'string' && user.name.trim()
    ? user.name.trim()
    : typeof user?.username === 'string' ? user.username.trim() : ''
  return source ? Array.from(source)[0].toLocaleUpperCase() : ''
}
