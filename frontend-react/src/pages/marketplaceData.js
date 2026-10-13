import { parseParcelGeometry } from './parcelMapData.js'
export { geoReportErrorMessage, geoReportFromResponse, geoReportLookupBody, loadGeoReport } from './geoReportData.js'

export function normalizeMarketplaceRows(data) {
  if (!Array.isArray(data)) throw new Error('The marketplace returned an unexpected parcel list.')
  return data.map((row) => {
    if (!row || typeof row !== 'object' || !(row.id != null || row.uuid) || !parseParcelGeometry(row.geojson)) {
      throw new Error('The marketplace returned a parcel with invalid geometry or identity.')
    }
    return { ...row, id: row.id ?? row.uuid }
  })
}

export function hasMarketplaceUuid(row) {
  return typeof row?.uuid === 'string' && row.uuid.trim() !== ''
}

const marketplaceLoadFlights = new WeakMap()

export function loadMarketplaceRows(request) {
  const activeFlight = marketplaceLoadFlights.get(request)
  if (activeFlight) return activeFlight

  const flight = Promise.resolve()
    .then(() => request('/market'))
    .then((response) => normalizeMarketplaceRows(response.data))

  marketplaceLoadFlights.set(request, flight)
  const clearFlight = () => {
    if (marketplaceLoadFlights.get(request) === flight) marketplaceLoadFlights.delete(request)
  }
  void flight.then(clearFlight, clearFlight)
  return flight
}

function marketplaceNumber(value) {
  if (value == null || typeof value === 'boolean' || (typeof value === 'string' && value.trim() === '')) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function marketplaceBound(value) {
  if (value == null || String(value).trim() === '') return { active: false, value: null, valid: true }
  const number = marketplaceNumber(value)
  return { active: true, value: number, valid: number !== null }
}

export function filterMarketplaceRows(rows, filters = {}) {
  if (!Array.isArray(rows)) return []

  const query = String(filters.query ?? '').trim().toLocaleLowerCase()
  const location = String(filters.location ?? '').trim().toLocaleLowerCase()
  const minPrice = marketplaceBound(filters.minPrice)
  const maxPrice = marketplaceBound(filters.maxPrice)
  const minArea = marketplaceBound(filters.minArea)
  const maxArea = marketplaceBound(filters.maxArea)
  const priceActive = minPrice.active || maxPrice.active
  const areaActive = minArea.active || maxArea.active

  if (!minPrice.valid || !maxPrice.valid || !minArea.valid || !maxArea.valid) return []
  if ((minPrice.active && maxPrice.active && minPrice.value > maxPrice.value)
    || (minArea.active && maxArea.active && minArea.value > maxArea.value)) return []

  const selectedCurrency = String(filters.currency ?? '').trim().toLocaleUpperCase()

  return rows.filter((row) => {
    if (query && !['parcel_name', 'owner', 'location_name', 'description', 'price', 'price_m2', 'uuid']
      .some((key) => String(row?.[key] ?? '').toLocaleLowerCase().includes(query))) return false

    if (location && !String(row?.location_name ?? '').toLocaleLowerCase().includes(location)) return false

    if (priceActive) {
      const price = marketplaceNumber(row?.price)
      const rowCurrency = String(row?.currency ?? '').trim().toLocaleUpperCase()
      if (!selectedCurrency || !rowCurrency || rowCurrency !== selectedCurrency || price === null) return false
      if (minPrice.active && price < minPrice.value) return false
      if (maxPrice.active && price > maxPrice.value) return false
    }

    if (areaActive) {
      const area = marketplaceNumber(row?.area_ha)
      if (area === null) return false
      if (minArea.active && area < minArea.value) return false
      if (maxArea.active && area > maxArea.value) return false
    }

    return true
  })
}

export function productFromResponse(response) {
  if (!Array.isArray(response?.data)) throw new Error('The product response did not contain a data list.')
  return response.data[0] ?? null
}

export function productLookupBody(uuid) {
  if (typeof uuid !== 'string' || uuid.trim() === '') throw new Error('A parcel UUID is required to look up its product.')
  return { data: uuid }
}

export function interestMessageBody(product, user, content) {
  return {
    sender_id: user.email,
    receiver_id: product.owner_uuid,
    content,
    uuid_post: product.uuid,
    objet: `${user.email} | ${product.parcel_name} | ${product.owner_uuid}`,
  }
}
