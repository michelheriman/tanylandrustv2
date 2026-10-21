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

export function formatParcelDate(value, locale = 'en-GB') {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function formatParcelArea(areaHa, locale = 'en-US') {
  if (areaHa === null || areaHa === undefined || areaHa === '') return '—'
  const value = Number(areaHa)
  if (!Number.isFinite(value) || value < 0) return '—'
  const hectares = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)
  const squareMeters = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value * 10_000)
  return `${hectares} ha (${squareMeters} m²)`
}

export function formatParcelMoney(value, currency, locale = 'en-US') {
  if (value === null || value === undefined || value === '') return '—'
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
