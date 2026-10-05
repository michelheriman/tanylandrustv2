import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../auth/useAuth.js'
import Icon from '../components/Icon.jsx'
import { iconMarkup } from '../components/iconPaths.js'
import { readLanguage, writeLanguage } from '../languageStorage.js'
import { geoReportErrorMessage, loadGeoReport, proximityPlaces } from './geoReportData.js'
import './GeoReport.css'

const months = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
}
const fullMonths = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
}
const soilNames = {
  en: { bdod: 'Bulk Density', cec: 'CEC', cfvo: 'Coarse Fragments', clay: 'Clay', nitrogen: 'Nitrogen', ocd: 'Organic Carbon Density', phh2o: 'pH (water)', sand: 'Sand', silt: 'Silt', soc: 'Organic Carbon Stock', wv0010: 'Water Volume 10kPa', wv0033: 'Water Volume 33kPa', wv1500: 'Water Volume 1500kPa' },
  fr: { bdod: 'Densité apparente', cec: 'CEC', cfvo: 'Éléments grossiers', clay: 'Argile', nitrogen: 'Azote', ocd: 'Densité carbone organique', phh2o: 'pH (eau)', sand: 'Sable', silt: 'Limon', soc: 'Stock carbone organique', wv0010: 'Volume eau 10kPa', wv0033: 'Volume eau 33kPa', wv1500: 'Volume eau 1500kPa' },
}
const labels = {
  en: { eyebrow: 'Terrain Analysis Report', back: 'Back to Marketplace', print: 'Print PDF', assessed: 'Assessed', coordinates: 'Coordinates', terrain: 'Terrain Overview', elevation: 'Elevation', maxSlope: 'Max Slope', avgSlope: 'Avg Slope', samples: 'Slope Samples', degrees: 'degrees', measurements: 'measurements', slopeProfile: 'Individual Slope Profile', average: 'Average', location: 'Location Map', source: 'SOURCE', peak: 'Forecast Peak Discharge', sevenDay: '7-day forecast', radius: 'Search radius', climate: 'Climate', temperature: 'Temperature Profile', meanTemp: 'Mean annual temp.', coldest: 'Coldest month', hottest: 'Hottest month', range: 'Data range', rainy: 'Rainy Season', onset: 'Onset', end: 'End', wettest: 'Wettest month', yearlyRain: 'Avg yearly rain', monthly: 'Monthly season indicator', proximity: 'Proximity — services within radius', hospital: 'Hospital', market: 'Market', transport: 'Transport', none: 'None found', soil: 'Soil Properties', flood: 'Flood Risk Assessment', risk: 'Risk level', history: 'History', years: 'years analyzed', thresholds: 'Return Period Thresholds', currentPeak: 'Current peak:', noThresholds: 'No threshold data provided.', dataSource: 'Data source', loading: 'Loading GeoReport…', retry: 'Retry', noReport: 'No GeoReport data is available for this parcel yet.', parcel: 'Parcel', unknown: 'Not provided', errorTitle: 'GeoReport could not be loaded' },
  fr: { eyebrow: 'Rapport d’analyse du terrain', back: 'Retour au marché', print: 'Imprimer PDF', assessed: 'Évalué le', coordinates: 'Coordonnées', terrain: 'Aperçu du terrain', elevation: 'Altitude', maxSlope: 'Pente max.', avgSlope: 'Pente moyenne', samples: 'Mesures de pente', degrees: 'degrés', measurements: 'mesures', slopeProfile: 'Profil de pente individuel', average: 'Moyenne', location: 'Carte de localisation', source: 'SOURCE', peak: 'Débit de pointe prévu', sevenDay: 'Prévision sur 7 jours', radius: 'Rayon de recherche', climate: 'Climat', temperature: 'Profil de température', meanTemp: 'Température annuelle moyenne', coldest: 'Mois le plus froid', hottest: 'Mois le plus chaud', range: 'Période des données', rainy: 'Saison des pluies', onset: 'Début', end: 'Fin', wettest: 'Mois le plus pluvieux', yearlyRain: 'Pluie annuelle moyenne', monthly: 'Indicateur saisonnier mensuel', proximity: 'Proximité — services dans le rayon', hospital: 'Hôpital', market: 'Marché', transport: 'Transport', none: 'Aucun trouvé', soil: 'Propriétés du sol', flood: 'Évaluation du risque d’inondation', risk: 'Niveau de risque', history: 'Historique', years: 'années analysées', thresholds: 'Seuils de période de retour', currentPeak: 'Pic actuel :', noThresholds: 'Aucune donnée de seuil fournie.', dataSource: 'Source des données', loading: 'Chargement du GeoReport…', retry: 'Réessayer', noReport: 'Aucune donnée GeoReport n’est encore disponible pour cette parcelle.', parcel: 'Parcelle', unknown: 'Non renseigné', errorTitle: 'Impossible de charger le GeoReport' },
}

function finite(value) { return value !== null && value !== '' && Number.isFinite(Number(value)) }
function number(value, digits = 1) { return finite(value) ? Number(value).toFixed(digits) : '—' }
function displayDate(value) {
  if (typeof value !== 'string') return '—'
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  return value
}
function isRainyMonth(index, season) {
  const onset = Number(season?.onset?.mean_month) - 1
  const end = Number(season?.end?.mean_month) - 1
  if (!Number.isInteger(onset) || !Number.isInteger(end) || onset < 0 || onset > 11 || end < 0 || end > 11) return false
  return onset <= end ? index >= onset && index <= end : index >= onset || index <= end
}
function popupNode(title, detail) {
  const node = document.createElement('div')
  const heading = document.createElement('strong')
  heading.textContent = title
  node.appendChild(heading)
  if (detail) {
    const line = document.createElement('br')
    const text = document.createTextNode(detail)
    node.append(line, text)
  }
  return node
}

function GeoReportMap({ report, lang }) {
  const host = useRef(null)
  useEffect(() => {
    if (!host.current) return undefined
    const { latitude, longitude } = report.flood.coordinate
    const map = L.map(host.current, { scrollWheelZoom: false }).setView([latitude, longitude], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map)
    L.circleMarker([latitude, longitude], { radius: 8, color: '#fff', weight: 3, fillColor: '#2d6a4f', fillOpacity: 1 })
      .addTo(map).bindPopup(popupNode(lang === 'fr' ? 'Parcelle' : 'Parcel', `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`))
    const radius = Number(report.proximity.query.radius_m)
    if (Number.isFinite(radius) && radius > 0) {
      L.circle([latitude, longitude], { color: '#2d6a4f', fillColor: '#52b788', fillOpacity: 0.08, weight: 1.5, radius }).addTo(map)
    }
    const icons = { hospital: 'hospital', market: 'store', transport: 'bus' }
    Object.entries(report.proximity.results).forEach(([category, entries]) => {
      if (!Array.isArray(entries)) return
      entries.forEach((entry) => {
        const lat = Number(entry?.lat)
        const lon = Number(entry?.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
        L.marker([lat, lon], { icon: L.divIcon({ className: 'georeport-proximity-marker', html: iconMarkup(icons[category] || 'pin', 20), iconSize: [24, 24], iconAnchor: [12, 12] }) })
          .addTo(map).bindPopup(popupNode(entry?.name || category))
      })
    })
    return () => map.remove()
  }, [report, lang])
  return <div className="georeport-map" ref={host} role="application" aria-label={lang === 'fr' ? 'Carte de localisation du GeoReport' : 'GeoReport location map'} />
}

function ValueRow({ label, value }) {
  return <div className="georeport-value-row"><span>{label}</span><strong>{value ?? '—'}</strong></div>
}

export default function GeoReport({ parcelUuid }) {
  const { request } = useAuth()
  const [lang, setLang] = useState(readLanguage)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const t = labels[lang]

  useEffect(() => {
    let live = true
    loadGeoReport(request, parcelUuid)
      .then((value) => {
        if (!live) return
        setReport(value)
      })
      .catch((failure) => { if (live) setError(failure) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [request, parcelUuid, retryVersion])

  useEffect(() => {
    document.title = `${t.eyebrow} | Tany LandTrust`
    document.documentElement.lang = lang
  }, [lang, t.eyebrow])

  const climate = report?.climates
  const flood = report?.flood
  const proximity = report?.proximity
  const coord = flood?.coordinate
  const slopeMaximum = report ? Math.max(0, ...report.individual_slopes.filter(finite).map(Number)) : 0
  const soilMaximum = report ? Math.max(0, ...report.soil_value.filter((item) => finite(item?.values)).map((item) => Number(item.values))) : 0
  const dateRange = useMemo(() => climate?.data_range ? `${displayDate(climate.data_range.start)} → ${displayDate(climate.data_range.end)}` : '—', [climate])
  const setLanguage = (next) => {
    setLang(next)
    writeLanguage(next)
  }
  const retry = () => {
    setLoading(true)
    setError(null)
    setReport(null)
    setRetryVersion((value) => value + 1)
  }
  const backHref = '/main#crops'

  return <main className="georeport-page">
    <div className="georeport-wrap">
      <header className="georeport-header">
        <div>
          <p className="georeport-eyebrow">{t.eyebrow}</p>
          <h1>Geo<span>Report</span></h1>
          {report && <p className="georeport-meta"><span>{t.coordinates}: {coord.latitude.toFixed(4)}, {coord.longitude.toFixed(4)}</span><span>{t.assessed}: {flood.assessed_on || '—'}</span></p>}
        </div>
        <div className="georeport-controls">
          <div className="georeport-language" aria-label="Language">
            {['en', 'fr'].map((language) => <button key={language} type="button" lang={language} aria-pressed={lang === language} onClick={() => setLanguage(language)}>{language.toUpperCase()}</button>)}
          </div>
          <button className="georeport-print" type="button" onClick={() => window.print()}>{t.print}</button>
        </div>
      </header>
      <nav className="georeport-top-actions" aria-label={lang === 'fr' ? 'Actions du rapport' : 'Report actions'}>
        <a href={backHref}><Icon name="arrow-left" size={15}/>{t.back}</a>
        <span>{t.parcel} UUID: <code>{parcelUuid}</code></span>
      </nav>

      {loading && <section className="georeport-state" role="status" aria-live="polite"><span className="georeport-spinner" />{t.loading}</section>}
      {!loading && error && <section className="georeport-state georeport-state-error" role="alert"><h2>{error.kind === 'not_found' ? t.noReport : t.errorTitle}</h2><p>{geoReportErrorMessage(error, lang)}</p><div className="georeport-state-actions"><button type="button" onClick={retry}>{t.retry}</button><a href={backHref}>{t.back}</a></div></section>}
      {!loading && !error && report && <>
        <section className="georeport-section" aria-labelledby="gr-terrain">
          <SectionTitle id="gr-terrain">{t.terrain}</SectionTitle>
          <div className="georeport-stat-grid">
            <StatCard tone="blue" label={t.elevation} value={number(report.elevation, 0)} unit="m a.s.l." />
            <StatCard tone="amber" label={t.maxSlope} value={`${number(report.max_slope, 2)}°`} unit={t.degrees} />
            <StatCard label={t.avgSlope} value={`${number(report.avg_slope, 2)}°`} unit={t.degrees} />
            <StatCard label={t.samples} value={report.individual_slopes.length} unit={t.measurements} />
          </div>
          <div className="georeport-chart-card">
            <SectionTitle>{t.slopeProfile}</SectionTitle>
            <div className="georeport-slope-chart" role="img" aria-label={t.slopeProfile}>
              {report.individual_slopes.map((value, index) => {
                const height = slopeMaximum > 0 && finite(value) ? Math.max(4, (Number(value) / slopeMaximum) * 100) : 4
                return <div className="georeport-slope-column" key={`${index}-${value}`}><div className={`georeport-slope-bar${Number(value) === slopeMaximum ? ' is-max' : ''}`} style={{ height: `${height}%` }} title={finite(value) ? `${number(value, 2)}°` : t.unknown} /><span>{index + 1}</span></div>
              })}
            </div>
            <div className="georeport-average-line"><span>{t.average}: {number(report.avg_slope, 2)}°</span></div>
          </div>
        </section>

        <section className="georeport-section" aria-labelledby="gr-location">
          <SectionTitle id="gr-location">{t.location}</SectionTitle>
          <div className="georeport-location-grid">
            <GeoReportMap report={report} lang={lang} />
            <aside className="georeport-map-info">
              <SectionTitle>{t.coordinates}</SectionTitle>
              <ValueRow label="LAT" value={`${number(coord.latitude, 4)}°`} />
              <ValueRow label="LON" value={`${number(coord.longitude, 4)}°`} />
              <ValueRow label={t.elevation.toUpperCase()} value={`${number(report.elevation, 0)} m`} />
              <ValueRow label={t.source} value={flood.data_source || t.unknown} />
              <div className="georeport-map-callout"><small>{t.peak}</small><strong>{number(flood.forecast?.peak_discharge_m3s, 2)} m³/s</strong><span>{t.sevenDay}</span></div>
              <div className="georeport-map-callout"><small>{t.radius}</small><strong>{finite(proximity.query.radius_m) ? `${(Number(proximity.query.radius_m) / 1000).toFixed(1)} km` : t.unknown}</strong></div>
            </aside>
          </div>
        </section>

        <section className="georeport-section" aria-labelledby="gr-climate">
          <SectionTitle id="gr-climate">{t.climate}</SectionTitle>
          <div className="georeport-stat-grid">
            <StatCard tone="purple" label={t.meanTemp} value={climate?.temperature?.overall_mean_c == null ? '—' : `${number(climate.temperature.overall_mean_c)}°`} unit="Celsius" />
            <StatCard tone="blue" label={t.yearlyRain} value={number(climate?.precipitation?.avg_yearly_total_mm, 0)} unit="mm/year" />
            <StatCard label={t.coldest} value={monthName(climate?.temperature?.coldest_month_num, lang)} unit={`${number(climate?.temperature?.coldest_month_avg_min_c)}°C avg min`} />
            <StatCard tone="amber" label={t.hottest} value={monthName(climate?.temperature?.hottest_month_num, lang)} unit={`${number(climate?.temperature?.hottest_month_avg_max_c)}°C avg max`} />
          </div>
          <div className="georeport-climate-grid">
            <article className="georeport-panel"><h3>{t.temperature}</h3><ValueRow label={t.meanTemp} value={`${number(climate?.temperature?.overall_mean_c, 2)}°C`} /><ValueRow label={t.coldest} value={`${monthName(climate?.temperature?.coldest_month_num, lang)} (${number(climate?.temperature?.coldest_month_avg_min_c)}°C)`} /><ValueRow label={t.hottest} value={`${monthName(climate?.temperature?.hottest_month_num, lang)} (${number(climate?.temperature?.hottest_month_avg_max_c)}°C)`} /><ValueRow label={t.range} value={dateRange} /></article>
            <article className="georeport-panel"><h3>{t.rainy}</h3><ValueRow label={t.onset} value={seasonValue(climate?.rainy_season?.onset, lang)} /><ValueRow label={t.end} value={seasonValue(climate?.rainy_season?.end, lang)} /><ValueRow label={t.wettest} value={`${monthName(climate?.precipitation?.wettest_month_num, lang)} (${number(climate?.precipitation?.wettest_month_avg_mm, 0)} mm)`} /><ValueRow label={t.yearlyRain} value={`${number(climate?.precipitation?.avg_yearly_total_mm)} mm`} /><div className="georeport-season-wrap"><small>{t.monthly}</small><div className="georeport-season-bar">{months[lang].map((month, index) => <div key={month} className={`georeport-month${isRainyMonth(index, climate?.rainy_season) ? ' is-wet' : ''}`}><span>{month}</span></div>)}</div></div></article>
          </div>
        </section>

        <section className="georeport-section" aria-labelledby="gr-proximity">
          <SectionTitle id="gr-proximity">{t.proximity}</SectionTitle>
          <div className="georeport-proximity-grid">{[['hospital', t.hospital, 'hospital'], ['market', t.market, 'store'], ['transport', t.transport, 'bus']].map(([key, title, icon]) => {
            const places = proximityPlaces(proximity.results, key)
            return <article className="georeport-proximity-card" key={key}><span className="georeport-proximity-icon"><Icon name={icon} size={19}/></span><h3>{title}</h3>{Array.isArray(places) ? <ul className="georeport-proximity-list">{places.map((place, index) => <li key={`${key}-${index}`}><strong>{place.name || t.unknown}</strong><small>{place.distanceKm === null ? t.unknown : `${number(place.distanceKm, 2)} km`}</small></li>)}</ul> : places === null ? <div className="georeport-no-data">{t.none}</div> : <div className="georeport-no-data">{t.unknown}</div>}</article>
          })}</div>
        </section>

        <section className="georeport-section" aria-labelledby="gr-soil">
          <SectionTitle id="gr-soil">{t.soil}</SectionTitle>
          <div className="georeport-soil-grid">{report.soil_value.map((soil, index) => {
            const amount = Number(soil?.values)
            const width = soilMaximum > 0 && Number.isFinite(amount) ? Math.max(0, Math.min(100, (amount / soilMaximum) * 100)) : 0
            return <article className="georeport-soil-card" key={`${soil?.name || 'soil'}-${index}`}><h3>{soilNames[lang][soil?.name] || soil?.name || t.unknown}</h3><strong>{finite(soil?.values) ? soil.values : t.unknown}</strong><small>{soil?.unit_measure || ''}</small><div className="georeport-soil-track"><span style={{ width: `${width}%` }} /></div></article>
          })}</div>
        </section>

        <section className="georeport-section" aria-labelledby="gr-flood">
          <SectionTitle id="gr-flood">{t.flood}</SectionTitle>
          <div className="georeport-flood-grid">
            <article className="georeport-risk-card"><span className={`georeport-risk-badge${riskIsElevated(flood.flood_risk) ? ' is-risk' : ''}`}>{riskLabel(flood.flood_risk, t.unknown)}</span><h3>{riskDescription(flood.flood_risk, t.unknown)}</h3><p>{t.history}: {flood.statistics?.history_from ? `${String(flood.statistics.history_from).slice(0, 4)}–${new Date().getFullYear() - 1} | ${flood.statistics.years_analyzed ?? t.unknown} ${t.years}` : t.unknown}</p></article>
            <article className="georeport-panel"><h3>{t.thresholds}</h3>{Object.entries(flood.statistics?.thresholds_m3s || {}).length ? Object.entries(flood.statistics.thresholds_m3s).sort(([a], [b]) => Number(a) - Number(b)).map(([period, threshold]) => <ValueRow key={period} label={`${period}-year`} value={`${number(threshold, 2)} m³/s`} />) : <p className="georeport-no-thresholds">{t.noThresholds}</p>}<div className="georeport-forecast"><strong>{t.currentPeak}</strong> {number(flood.forecast?.peak_discharge_m3s, 2)} m³/s</div></article>
          </div>
        </section>

        <footer className="georeport-source"><span>{t.dataSource}: {flood.data_source || 'GloFAS v4 via Open-Meteo'} · ISRIC World Soil Information</span><span>{new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span></footer>
      </>}
    </div>
  </main>
}

function SectionTitle({ id, children }) { return <h2 className="georeport-section-title" id={id}>{children}</h2> }
function StatCard({ label, value, unit, tone = '' }) { return <article className={`georeport-stat-card${tone ? ` tone-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong><small>{unit}</small></article> }
function monthName(value, lang) { const index = Number(value) - 1; return Number.isInteger(index) && index >= 0 && index < 12 ? fullMonths[lang][index] : '—' }
function seasonValue(value, lang) { return value?.mean_month ? `${monthName(value.mean_month, lang)} ±${value.std_dev_days ?? '—'}d` : '—' }
function riskLabel(value, unknown) { return typeof value === 'string' ? value : value?.level || unknown }
function riskDescription(value, unknown) { return typeof value === 'object' && value?.description ? value.description : riskLabel(value, unknown) }
function riskIsElevated(value) { return /high|extreme|severe|significant/i.test(typeof value === 'string' ? value : value?.level || '') }
