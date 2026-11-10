export function setArcGISLocale(intl, lang) {
  if (typeof intl?.setLocale !== 'function') return
  intl.setLocale(lang === 'fr' ? 'fr' : 'en')
}

export function sanitizeArcGISError(_error, lang) {
  return new Error(lang === 'fr'
    ? 'Impossible de charger la carte. Veuillez réessayer.'
    : 'Unable to load the map. Please try again.')
}
