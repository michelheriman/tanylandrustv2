import { parseParcelGeometry } from './parcelMapData.js'
import { hectaresToSquareMeters } from './parcelPricing.js'
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





function marketplaceDecimal(value) {
  if (value == null || typeof value === 'boolean') return null
  const text = String(value).trim()
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text)
  if (!match || (!match[2] && !match[3])) return null
  const exponent = Number(match[4] ?? 0)
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) return null

  const whole = match[2] || '0'
  const fraction = match[3] || ''
  const rawDigits = `${whole}${fraction}`
  let digits = rawDigits.replace(/^0+/, '')
  if (!digits) return { sign: 0, whole: '0', fraction: '' }

  let decimalPoint = whole.length + exponent - (rawDigits.length - digits.length)
  let integerPart
  let fractionalPart
  if (decimalPoint <= 0) {
    integerPart = '0'
    fractionalPart = `${'0'.repeat(-decimalPoint)}${digits}`
  } else if (decimalPoint >= digits.length) {
    integerPart = `${digits}${'0'.repeat(decimalPoint - digits.length)}`
    fractionalPart = ''
  } else {
    integerPart = digits.slice(0, decimalPoint)
    fractionalPart = digits.slice(decimalPoint)
  }
  integerPart = integerPart.replace(/^0+(?=\d)/, '')
  fractionalPart = fractionalPart.replace(/0+$/, '')
  const sign = match[1] === '-' ? -1 : 1
  return { sign, whole: integerPart, fraction: fractionalPart }
}

function compareMarketplaceDecimals(leftValue, rightValue) {
  const left = marketplaceDecimal(leftValue)
  const right = marketplaceDecimal(rightValue)
  if (!left || !right) return null
  if (left.sign !== right.sign) return left.sign < right.sign ? -1 : 1
  if (left.sign === 0) return 0

  let magnitude = 0
  if (left.whole.length !== right.whole.length) {
    magnitude = left.whole.length < right.whole.length ? -1 : 1
  } else if (left.whole !== right.whole) {
    magnitude = left.whole < right.whole ? -1 : 1
  } else {
    const fractionLength = Math.max(left.fraction.length, right.fraction.length)
    const leftFraction = left.fraction.padEnd(fractionLength, '0')
    const rightFraction = right.fraction.padEnd(fractionLength, '0')
    if (leftFraction !== rightFraction) magnitude = leftFraction < rightFraction ? -1 : 1
  }
  return left.sign < 0 ? -magnitude : magnitude
}

function marketplacePriceBound(value) {
  if (value == null || String(value).trim() === '') return { active: false, value: null, valid: true }
  const decimal = marketplaceDecimal(value)
  return { active: true, value: decimal, valid: decimal !== null }
}

export function filterMarketplaceRows(rows, filters = {}) {
  if (!Array.isArray(rows)) return []

  const query = String(filters.query ?? '').trim().toLocaleLowerCase()
  const location = String(filters.location ?? '').trim().toLocaleLowerCase()
  const minPrice = marketplacePriceBound(filters.minPrice)
  const maxPrice = marketplacePriceBound(filters.maxPrice)
  const minArea = marketplacePriceBound(filters.minArea)
  const maxArea = marketplacePriceBound(filters.maxArea)
  const priceActive = minPrice.active || maxPrice.active
  const areaActive = minArea.active || maxArea.active

  if (!minPrice.valid || !maxPrice.valid || !minArea.valid || !maxArea.valid) return []
  if ((minPrice.active && maxPrice.active
    && compareMarketplaceDecimals(minPrice.value, maxPrice.value) > 0)
    || (minArea.active && maxArea.active
      && compareMarketplaceDecimals(filters.minArea, filters.maxArea) > 0)) return []

  const selectedCurrency = String(filters.currency ?? '').trim().toLocaleUpperCase()
  return rows.filter((row) => {
    if (query && !['parcel_name', 'owner', 'location_name', 'description', 'price', 'price_m2', 'declared_area_ha', 'declared_price_m2', 'uuid']
      .some((key) => String(row?.[key] ?? '').toLocaleLowerCase().includes(query))) return false

    if (location && !String(row?.location_name ?? '').toLocaleLowerCase().includes(location)) return false

    if (priceActive) {
      // `price` is resolved by the backend serializer and is the same value
      // rendered in the listing card and detail panel (including history).
      const rowCurrency = String(row?.currency ?? '').trim().toLocaleUpperCase()
      if (!selectedCurrency || !rowCurrency || rowCurrency !== selectedCurrency
        || marketplaceDecimal(row?.price) === null) return false
      if (minPrice.active && compareMarketplaceDecimals(row.price, filters.minPrice) < 0) return false
      if (maxPrice.active && compareMarketplaceDecimals(row.price, filters.maxPrice) > 0) return false
    }

    if (areaActive) {
      const area = hectaresToSquareMeters(row?.declared_area_ha)
      if (area === null) return false
      if (minArea.active && compareMarketplaceDecimals(area, filters.minArea) < 0) return false
      if (maxArea.active && compareMarketplaceDecimals(area, filters.maxArea) > 0) return false
    }

    return true
  })
}

export function productFromResponse(response) {
  if (!Array.isArray(response?.data)) throw new Error('The product response did not contain a data list.')
  return response.data[0] ?? null
}

function positiveBigintText(value) {
  let text
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) return null
    text = String(value)
  } else if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    text = value
  } else {
    return null
  }

  try {
    const parsed = BigInt(text)
    return parsed <= 9223372036854775807n ? text : null
  } catch {
    return null
  }
}

export function productLookupBody(uuid, parcelId) {
  const stableId = positiveBigintText(parcelId)
  const hasUuid = typeof uuid === 'string' && uuid.trim() !== ''
  if (!hasUuid && !stableId) throw new Error('A stable parcel identity is required to look up its product.')
  return {
    ...(hasUuid ? { data: uuid } : {}),
    ...(stableId ? { parcel_id: stableId } : {}),
  }
}

export function interestMessageBody(product, user, content, { localBackend = false } = {}) {
  const stableId = positiveBigintText(product?.id)
  if (localBackend) {
    if (!stableId) throw new Error('A stable parcel ID is required to contact this listing.')
    return { parcel_id: stableId, content }
  }
  const body = {
    sender_id: user.email,
    receiver_id: product.owner_uuid,
    content,
    uuid_post: product.uuid,
    objet: `${user.email} | ${product.parcel_name} | ${product.owner_uuid}`,
  }
  if (stableId) body.parcel_id = stableId
  return body
}
