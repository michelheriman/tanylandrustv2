import { formatAreaSquareMeters, formatExactPricingAmount } from '../pages/parcelPricing.js'

export function buildAdminParcelListQuery(filters) {
  const query = {
    page: filters.page,
    per_page: filters.perPage,
    sort: filters.sort,
    direction: filters.direction,
  }
  if (filters.search.trim()) query.q = filters.search.trim()
  if (filters.dateFrom) query.date_from = filters.dateFrom
  if (filters.dateTo) query.date_to = filters.dateTo
  if (filters.sellCategory) query.sell_category = filters.sellCategory
  if (filters.visibility) query.visibility = filters.visibility
  if (filters.contactedFrom) query.contacted_from = filters.contactedFrom
  if (filters.contactedTo) query.contacted_to = filters.contactedTo
  return query
}

export function readAdminParcelMetricFilters(search = '') {
  const params = new URLSearchParams(search)
  return {
    sellCategory: params.get('sell_category') === 'to_sell' ? 'to_sell' : '',
    visibility: ['visible', 'hidden'].includes(params.get('visibility')) ? params.get('visibility') : '',
    contactedFrom: params.get('contacted_from') || '',
    contactedTo: params.get('contacted_to') || '',
  }
}

export function parcelListViewState({ loading, error, result }) {
  if (loading) return { kind: 'loading' }
  if (error) return { kind: 'error', error }
  if (!result || !Array.isArray(result.data)) return { kind: 'error', error: null }
  if (result.data.length === 0) return { kind: 'empty', pagination: result.pagination }
  return { kind: 'ready', parcels: result.data, pagination: result.pagination }
}

export function parcelDetailViewState({ loading, error, parcel }) {
  if (loading) return { kind: 'loading' }
  if (error?.status === 404) return { kind: 'notFound' }
  if (error) return { kind: 'error', error }
  if (!parcel || typeof parcel !== 'object') return { kind: 'error', error: null }
  return { kind: 'ready', parcel }
}

export function applyAdminParcelVisibilityDecision(parcel, decision) {
  if (!parcel || typeof parcel !== 'object' || !decision ||
      typeof decision.is_hidden !== 'boolean' ||
      !['hide', 'restore'].includes(decision.action) ||
      !decision.decision_id || !decision.created_at) return parcel

  const historyEntry = {
    id: String(decision.decision_id),
    action: decision.action,
    admin_id: String(decision.admin_id),
    reason: decision.reason,
    created_at: decision.created_at,
  }
  const existingHistory = Array.isArray(parcel.visibility_history) ? parcel.visibility_history : []
  const history = [
    historyEntry,
    ...existingHistory.filter((entry) => String(entry?.id) !== historyEntry.id),
  ]

  return {
    ...parcel,
    visibility: {
      ...(parcel.visibility && typeof parcel.visibility === 'object' ? parcel.visibility : {}),
      is_hidden: decision.is_hidden,
      reason: decision.reason,
      changed_by_admin_id: historyEntry.admin_id,
      changed_at: decision.created_at,
    },
    visibility_history: history.slice(0, 100),
    visibility_history_truncated: parcel.visibility_history_truncated === true || history.length > 100,
  }
}

export function formatParcelDate(value, locale = 'en-GB') {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function formatParcelArea(areaHa, locale = 'en-US') {
  return formatAreaSquareMeters(areaHa, locale)
}

export function formatParcelMoney(value, currency, locale = 'en-US', exactDecimal = false) {
  if (value === null || value === undefined || value === '') return '—'
  if (exactDecimal) {
    const formatted = formatExactPricingAmount(value, currency, locale)
    return formatted === '—' ? formatted : currency ? `${formatted} ${currency}` : formatted
  }
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)
  return currency ? `${formatted} ${currency}` : formatted
}

export function getParcelOutline(geojson) {
  if (!geojson || typeof geojson !== 'object') return []
  const root = geojson.type === 'Feature' ? geojson.geometry : geojson
  if (!root || !Array.isArray(root.coordinates)) return []
  const polygons = root.type === 'Polygon'
    ? [root.coordinates]
    : root.type === 'MultiPolygon'
      ? root.coordinates
      : []
  return polygons
    .map((polygon) => polygon?.[0])
    .filter((ring) => Array.isArray(ring) && ring.length >= 4)
    .map((ring) => ring.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])))
    .filter((ring) => ring.length >= 4)
}

export function outlineToSvg(rings) {
  const points = rings.flat()
  if (!points.length) return []
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const scale = 88 / Math.max(spanX, spanY)
  const offsetX = (100 - spanX * scale) / 2
  const offsetY = (100 - spanY * scale) / 2
  return rings.map((ring) => ring.map(([x, y]) => (
    `${(offsetX + (x - minX) * scale).toFixed(2)},${(100 - offsetY - (y - minY) * scale).toFixed(2)}`
  )).join(' '))
}
