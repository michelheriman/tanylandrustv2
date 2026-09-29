const POLYGON_TYPES = new Set(['Polygon', 'MultiPolygon'])

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
  const rings = geometry?.rings
  if (!Array.isArray(rings) || !rings.length) throw new Error('Draw a parcel boundary on the map before saving.')
  if (!centroid || !Number.isFinite(centroid.x) || !Number.isFinite(centroid.y)) throw new Error('The parcel boundary has no usable center point.')
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

export function checkParcelLimit(accountResponse, currentCount) {
  const profile = accountResponse?.data?.[0]
  if (!profile?.account) throw new Error('The account plan could not be checked.')
  const limits = { free: 2, pro5: 5, pro10: 15 }
  const limit = limits[profile.account]
  return { allowed: limit == null || currentCount < limit, limit, plan: profile.account }
}
