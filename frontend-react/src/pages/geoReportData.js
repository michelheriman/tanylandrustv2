export function geoReportLookupBody(uuid) { return { data: uuid } }

const activeGeoReportLoads = new WeakMap()

export function proximityPlaces(results, category) {
  if (!results || !Object.prototype.hasOwnProperty.call(results, category)) return null
  const entries = results[category]
  if (!Array.isArray(entries)) return { invalid: true }
  if (entries.length === 0) return null

  return entries.map((place) => {
    const distanceMeters = place?.distance_m === null || place?.distance_m === ''
      ? Number.NaN
      : Number(place?.distance_m)
    return {
      name: typeof place?.name === 'string' ? place.name : '',
      distanceKm: Number.isFinite(distanceMeters) ? distanceMeters / 1000 : null,
    }
  })
}

export function geoReportFromResponse(response, parcelUuid = null) {
  if (!Array.isArray(response?.data)) throw new Error('The GeoReport response did not contain a data list.')
  if (response.data.length === 0) {
    const parcel = parcelUuid ? ` parcel UUID "${parcelUuid}"` : ' requested parcel'
    const error = new Error(`The GeoReport API returned no record for${parcel}.`)
    error.kind = 'not_found'
    error.parcelUuid = parcelUuid
    throw error
  }
  const record = response.data[0]
  if (!record || (typeof record.geoinfos !== 'string' && (!record.geoinfos || typeof record.geoinfos !== 'object'))) {
    throw new Error('The GeoReport record is missing geoinfos.')
  }
  let report = record.geoinfos
  if (typeof report === 'string') {
    try { report = JSON.parse(report) }
    catch { throw new Error('The GeoReport geoinfos value is not valid JSON.') }
  }
  const latitude = Number(report?.flood?.coordinate?.latitude)
  const longitude = Number(report?.flood?.coordinate?.longitude)
  if (!report || typeof report !== 'object' || Array.isArray(report) ||
      !report.flood || typeof report.flood !== 'object' ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      !report.flood.forecast || typeof report.flood.forecast !== 'object' ||
      !report.flood.statistics || typeof report.flood.statistics !== 'object' ||
      !report.climates || typeof report.climates !== 'object' ||
      !report.proximity?.query || !report.proximity?.results || typeof report.proximity.results !== 'object' ||
      !Array.isArray(report.individual_slopes) || !Array.isArray(report.soil_value)) {
    throw new Error('The GeoReport geoinfos structure is incomplete or unsupported.')
  }
  return report
}

export function loadGeoReport(request, uuid) {
  if (typeof uuid !== 'string' || !uuid.trim()) throw new Error('A parcel UUID is required to load its GeoReport.')
  let requestsByUuid = activeGeoReportLoads.get(request)
  if (!requestsByUuid) {
    requestsByUuid = new Map()
    activeGeoReportLoads.set(request, requestsByUuid)
  }
  const activeRequest = requestsByUuid.get(uuid)
  if (activeRequest) return activeRequest

  const requestFlight = (async () => {
    const response = await request('/get_infos', {
      method: 'POST',
      body: JSON.stringify(geoReportLookupBody(uuid)),
    })
    return geoReportFromResponse(response, uuid)
  })()
  requestsByUuid.set(uuid, requestFlight)
  const clearFlight = () => {
    if (requestsByUuid.get(uuid) === requestFlight) requestsByUuid.delete(uuid)
    if (requestsByUuid.size === 0) activeGeoReportLoads.delete(request)
  }
  requestFlight.then(clearFlight, clearFlight)
  return requestFlight
}

export function geoReportErrorMessage(error, lang = 'en') {
  if (error?.kind === 'auth' || error?.status === 401) {
    return lang === 'fr'
      ? 'Votre session a expiré. Reconnectez-vous pour consulter ce GeoReport.'
      : 'Your session has expired. Sign in again to view this GeoReport.'
  }
  if (error?.status === 403) {
    return lang === 'fr' ? 'Un compte Pro est nécessaire pour consulter ce GeoReport.' : 'A Pro account is required to view this GeoReport.'
  }
  if (error?.kind === 'not_found') {
    return lang === 'fr'
      ? 'Aucun GeoReport disponible pour cette parcelle'
      : error.message
  }
  if (error?.status === 500) {
    return lang === 'fr'
      ? 'Le GeoReport est indisponible pour ce compte ou le serveur a rencontré une erreur. Les comptes gratuits sont refusés par le backend avec HTTP 500.'
      : 'GeoReport is unavailable for this account or the server encountered an error. The backend uses HTTP 500 to deny free accounts.'
  }
  if (error?.kind === 'network') {
    return lang === 'fr' ? 'Le serveur GeoReport est injoignable. Vérifiez la connexion puis réessayez.' : 'The GeoReport server is unreachable. Check your connection and retry.'
  }
  return error?.message || (lang === 'fr' ? 'Impossible de charger le GeoReport.' : 'Unable to load the GeoReport.')
}
