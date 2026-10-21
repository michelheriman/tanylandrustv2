const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION = 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community'

function parseGeoJson(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isPosition(position) {
  return Array.isArray(position) && position.length >= 2 &&
    Number.isFinite(position[0]) && Number.isFinite(position[1]) &&
    Math.abs(position[0]) <= 180 && Math.abs(position[1]) <= 90
}

function isClosedRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition)) return false
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return false
  return new Set(ring.slice(0, -1).map(([longitude, latitude]) => `${longitude},${latitude}`)).size >= 3
}

function isPolygonCoordinates(coordinates) {
  return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isClosedRing)
}

export function parseAdminParcelMapGeometry(value) {
  const parsed = parseGeoJson(value)
  const geometry = parsed?.type === 'Feature' ? parsed.geometry : parsed
  if (geometry?.type === 'Polygon' && isPolygonCoordinates(geometry.coordinates)) return geometry
  if (geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 && geometry.coordinates.every(isPolygonCoordinates)) return geometry
  return null
}

export function mountAdminParcelMap(L, host, geometry) {
  const map = L.map(host, {
    zoomControl: true,
    scrollWheelZoom: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
  })
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
  const boundary = L.geoJSON({ type: 'Feature', properties: {}, geometry }, {
    style: { color: '#f0d57c', weight: 3, fillColor: '#d7b555', fillOpacity: 0.2 },
    interactive: false,
  }).addTo(map)
  const bounds = boundary.getBounds()
  if (!bounds?.isValid?.()) {
    map.remove()
    return null
  }
  map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17 })
  return { map, bounds }
}
