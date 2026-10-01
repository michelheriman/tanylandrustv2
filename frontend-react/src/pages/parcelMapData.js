const POLYGON_TYPES = new Set(['Polygon', 'MultiPolygon'])

function isWgs84Point(point) {
  return Array.isArray(point) && point.length >= 2 &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
}

function isClosedValidRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isWgs84Point)) return false
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (Math.abs(first[0] - last[0]) > 1e-8 || Math.abs(first[1] - last[1]) > 1e-8) return false
  const distinctVertices = new Set(ring.slice(0, -1).map(([x, y]) => `${x},${y}`))
  return distinctVertices.size >= 3
}

export function isValidParcelBoundary(draft) {
  const rings = draft?.geometry?.rings
  const centroid = draft?.centroid
  return Array.isArray(rings) && rings.length > 0 && rings.every(isClosedValidRing) &&
    isWgs84Point([centroid?.x, centroid?.y])
}

export function parseParcelGeometry(value) {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return null }
  }
  const geometry = parsed?.type === 'Feature' ? parsed.geometry : parsed
  if (!POLYGON_TYPES.has(geometry?.type) || !Array.isArray(geometry.coordinates)) return null
  if (geometry.type === 'Polygon' && !geometry.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4)) return null
  if (geometry.type === 'MultiPolygon' && !geometry.coordinates.every((polygon) => Array.isArray(polygon) && polygon.length && polygon.every((ring) => Array.isArray(ring) && ring.length >= 4))) return null
  return geometry
}

export function parcelsToFeatureCollection(parcels) {
  return {
    type: 'FeatureCollection',
    features: parcels.flatMap((row) => {
      const geometry = parseParcelGeometry(row.geojson)
      if (!geometry) return []
      const properties = { ...row }
      delete properties.geojson
      return [{ type: 'Feature', geometry, properties }]
    }),
  }
}

export function makeParcelPayload(form, geometry, userEmail, centroid, areaHa) {
  const boundary = { geometry, centroid }
  const rings = geometry?.rings
  if (!isValidParcelBoundary(boundary)) throw new Error('Draw a valid parcel boundary on the map before saving.')
  if (!userEmail) throw new Error('The signed-in user email is unavailable.')
  return {
    owner: form.owner.trim(),
    price_m2: form.price_m2 || '0',
    price: form.price,
    currency: form.currency,
    location_name: form.location_name.trim(),
    description: form.description.trim(),
    owner_uuid: userEmail,
    sell_category: form.sell_category,
    status_category: form.status_category,
    longitude: centroid.x,
    latitude: centroid.y,
    parcel_name: form.parcel_name.trim(),
    geojson: JSON.stringify({ type: 'Polygon', coordinates: rings }),
    area_ha: areaHa,
  }
}

export function createParcel(request, form, draft, userEmail) {
  const payload = makeParcelPayload(form, draft?.geometry, userEmail, draft?.centroid, draft?.areaHa)
  return request('/parcels_w', { method: 'POST', body: JSON.stringify(payload) })
}

export function findInvalidAddParcelControl(form) {
  return Array.from(form?.elements ?? []).find((control) => control.willValidate && !control.checkValidity()) ?? null
}

export function addParcelStepForField(fieldName) {
  return ['parcel_name', 'owner', 'location_name', 'description'].includes(fieldName) ? 1 : 2
}

export function checkParcelLimit(accountResponse, currentCount) {
  const profile = accountResponse?.data?.[0]
  if (!profile?.account) throw new Error('The account plan could not be checked.')
  const limits = { free: 2, pro5: 5, pro10: 15 }
  const limit = limits[profile.account]
  return { allowed: limit == null || currentCount < limit, limit, plan: profile.account }
}
