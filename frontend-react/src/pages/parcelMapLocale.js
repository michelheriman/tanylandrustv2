export function setArcGISLocale(intl, lang) {
  if (typeof intl?.setLocale !== 'function') return
  intl.setLocale(lang === 'fr' ? 'fr' : 'en')
}
