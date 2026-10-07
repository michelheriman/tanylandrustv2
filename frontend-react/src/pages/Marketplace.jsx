import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import Icon from '../components/Icon.jsx'
import ParcelMap from './ParcelMap.jsx'
import { filterMarketplaceRows, hasMarketplaceUuid, interestMessageBody, loadMarketplaceRows, productFromResponse, productLookupBody } from './marketplaceData.js'
import './Marketplace.css'

const text = {
  en: { title: 'Parcel Marketplace', pageTitle: 'Market Place', subtitle: 'Browse listings, buy, and sell produce directly.', loading: 'Loading marketplace parcels…', retry: 'Retry', search: 'Search parcels', filter: 'Filter:', name: 'A–Z', date: 'Date', empty: 'No parcels are currently available in the marketplace.', noMatch: 'No parcels match this search.', map: 'View on Map', interest: 'Mark Interest', report: 'Greport', back: 'Back to Marketplace', loadProduct: 'Loading parcel…', send: 'Place Bid', message: 'Your Message', sent: 'Your interest message was sent.', missing: 'Product not found.', loadingReport: 'Loading GeoReport…', absentReport: 'No GeoReport data is available for this parcel yet.', reportTitle: 'GeoReport', terrain: 'Terrain', climate: 'Climate', flood: 'Flood risk', proximity: 'Nearby services', elevation: 'Elevation', maxSlope: 'Maximum slope', avgSlope: 'Average slope', latitude: 'Latitude', longitude: 'Longitude', retryReport: 'Retry', fieldDataManager: 'Field Data Manager', vendorLabel: 'Vendor', priceLabel: 'Price', pricePerM2: 'Price per m²', locationLabel: 'Location', referenceLabel: 'Reference', requestFailed: 'The marketplace request failed.', uuidUnavailable: 'Parcel reference unavailable.' },
  fr: { title: 'Marché des parcelles', pageTitle: 'Marché des parcelles', subtitle: 'Parcourez les annonces et échangez directement.', loading: 'Chargement des parcelles…', retry: 'Réessayer', search: 'Rechercher une parcelle', filter: 'Filtre :', name: 'A–Z', date: 'Date', empty: 'Aucune parcelle n’est actuellement disponible sur le marché.', noMatch: 'Aucune parcelle ne correspond à cette recherche.', map: 'Voir sur la carte', interest: 'Manifester mon intérêt', report: 'GeoReport', back: 'Retour au marché', loadProduct: 'Chargement de la parcelle…', send: 'Envoyer mon intérêt', message: 'Votre message', sent: 'Votre message d’intérêt a été envoyé.', missing: 'Parcelle introuvable.', loadingReport: 'Chargement du GeoReport…', absentReport: 'Aucune donnée GeoReport n’est encore disponible pour cette parcelle.', reportTitle: 'GeoReport', terrain: 'Terrain', climate: 'Climat', flood: 'Risque d’inondation', proximity: 'Services proches', elevation: 'Altitude', maxSlope: 'Pente maximale', avgSlope: 'Pente moyenne', latitude: 'Latitude', longitude: 'Longitude', retryReport: 'Réessayer', fieldDataManager: 'Gestionnaire de données foncières', vendorLabel: 'Vendeur', priceLabel: 'Prix', pricePerM2: 'Prix au m²', locationLabel: 'Localisation', referenceLabel: 'Référence', requestFailed: 'La requête du marché a échoué.', uuidUnavailable: 'Référence de parcelle indisponible.' },
}

const filterText = {
  en: {
    advanced: 'Location, price and area filters', location: 'Location', locationHint: 'Text search in location_name; not a region or district filter.',
    price: 'Price', min: 'Min', max: 'Max', currency: 'Currency', chooseCurrency: 'Choose currency',
    area: 'Area (ha)', dataLimits: 'Price limits apply only to the selected currency. Missing or invalid price/currency values are excluded when a price limit is active; parcels without area_ha are excluded when an area limit is active.',
    reset: 'Reset filters', noMatch: 'No parcels match the current search and filters.', chooseCurrencyHint: 'Choose a currency to apply the price limits.',
  },
  fr: {
    advanced: 'Filtres de localisation, prix et surface', location: 'Localisation', locationHint: 'Recherche textuelle dans location_name ; ce filtre ne désigne pas une région ou un district.',
    price: 'Prix', min: 'Min.', max: 'Max.', currency: 'Devise', chooseCurrency: 'Choisir une devise',
    area: 'Surface (ha)', dataLimits: 'Les limites de prix s’appliquent uniquement à la devise choisie. Les annonces sans prix ou devise valides sont exclues si une limite de prix est active ; celles sans area_ha sont exclues si une limite de surface est active.',
    reset: 'Réinitialiser les filtres', noMatch: 'Aucune parcelle ne correspond à la recherche et aux filtres actuels.', chooseCurrencyHint: 'Choisissez une devise pour appliquer les limites de prix.',
  },
}

function MarketError({ error, onRetry, lang }) {
  const message = apiErrorMessage(error, lang) || (typeof error === 'string' ? error : text[lang].requestFailed)
  return <div className="market-react-error" role="alert"><p>{message}</p>{onRetry && <button type="button" onClick={onRetry}>{text[lang].retry}</button>}</div>
}

function ProductInterest({ uuid, lang, onBack }) {
  const { request, user } = useAuth()
  const labels = text[lang]
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let live = true
    request('/getprodd', { method: 'POST', body: JSON.stringify(productLookupBody(uuid)) })
      .then((response) => { if (live) setProduct(productFromResponse(response)) })
      .catch((failure) => { if (live) setError(failure) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [request, uuid])

  async function sendInterest(event) {
    event.preventDefault()
    if (!product || saving || !user?.email) return
    setSaving(true); setError(null)
    try {
      await request('/messages_w', { method: 'POST', body: JSON.stringify(interestMessageBody(product, user, message)) })
      setSent(true)
    } catch (failure) { setError(failure) }
    finally { setSaving(false) }
  }

  return <section className="market-react-detail" aria-labelledby="market-product-title">
    <button className="market-react-back" type="button" onClick={onBack}><Icon name="arrow-left" size={15}/>{labels.back}</button>
    {loading && <p role="status">{labels.loadProduct}</p>}
    {!loading && error && <MarketError error={error} onRetry={() => { setProduct(null); setLoading(true); setError(null); request('/getprodd', { method: 'POST', body: JSON.stringify(productLookupBody(uuid)) }).then((response) => setProduct(productFromResponse(response))).catch((failure) => setError(failure)).finally(() => setLoading(false)) }} lang={lang} />}
    {!loading && !error && !product && <p role="status">{labels.missing}</p>}
    {product && <>
      <h2 id="market-product-title">{product.parcel_name || '—'}</h2>
      <p>{product.description || '—'}</p>
      <dl className="market-react-facts"><div><dt>{labels.vendorLabel}</dt><dd>{product.owner || '—'}</dd></div><div><dt>{labels.priceLabel}</dt><dd>{product.price ?? '—'} {product.currency || ''}</dd></div><div><dt>{labels.pricePerM2}</dt><dd>{product.price_m2 ?? '—'} {product.currency || ''}</dd></div><div><dt>{labels.locationLabel}</dt><dd>{product.location_name || '—'}</dd></div></dl>
      {sent ? <p className="market-react-success" role="status">{labels.sent}</p> : <form className="market-react-interest-form" onSubmit={(event) => void sendInterest(event)}>
        <label htmlFor="market-interest-message">{labels.message}</label>
        <textarea id="market-interest-message" required value={message} onChange={(event) => setMessage(event.target.value)} rows="4" />
        {error && <MarketError error={error} lang={lang} />}
        <button type="submit" disabled={saving || !user?.email}>{saving ? '…' : labels.send}</button>
      </form>}
    </>}
  </section>
}

export default function Marketplace({ lang = 'en' }) {
  const { request } = useAuth()
  const labels = text[lang]
  const filterLabels = filterText[lang]
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [priceCurrency, setPriceCurrency] = useState('')
  const [minArea, setMinArea] = useState('')
  const [maxArea, setMaxArea] = useState('')
  const [sort, setSort] = useState('name')
  const [descending, setDescending] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const [view, setView] = useState(null)
  const [targetUuid, setTargetUuid] = useState(null)
  const [mapError, setMapError] = useState(null)

  useEffect(() => {
    let live = true
    loadMarketplaceRows(request).then((rows) => { if (live) setParcels(rows) })
      .catch((failure) => { if (live) setError(failure) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [request, retryKey])

  const visible = useMemo(() => filterMarketplaceRows(parcels, {
    query: search, location: locationFilter, minPrice, maxPrice, currency: priceCurrency, minArea, maxArea,
  }).slice().sort((a, b) => sort === 'date'
        ? (Date.parse(b.updated_at ?? b.updatedAt ?? b.created_at ?? b.createdAt ?? '') || 0) - (Date.parse(a.updated_at ?? a.updatedAt ?? a.created_at ?? a.createdAt ?? '') || 0)
        : String(a.parcel_name ?? '').localeCompare(String(b.parcel_name ?? ''), undefined, { sensitivity: 'base' }) * (descending ? -1 : 1)),
  [parcels, search, locationFilter, minPrice, maxPrice, priceCurrency, minArea, maxArea, sort, descending])

  const selectedParcel = parcels.find((row) => String(row.id) === String(selectedId)) || null
  function openAction(nextView, row) {
    if (!hasMarketplaceUuid(row)) return
    setTargetUuid(row.uuid)
    setView(nextView)
  }
  function selectParcel(row) { setSelectedId(row.id); setFocusVersion((value) => value + 1) }
  const hasDates = parcels.some((row) => ['updated_at', 'updatedAt', 'created_at', 'createdAt'].some((key) => row[key]))
  const currencies = useMemo(() => [...new Set(parcels.map((row) => String(row.currency ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), [parcels])
  const priceLimitsActive = minPrice !== '' || maxPrice !== ''
  const anyFilterActive = Boolean(search.trim() || locationFilter.trim() || priceLimitsActive || minArea !== '' || maxArea !== '')
  function resetFilters() {
    setSearch('')
    setLocationFilter('')
    setMinPrice('')
    setMaxPrice('')
    setPriceCurrency('')
    setMinArea('')
    setMaxArea('')
  }
  const formatPrice = (value) => Number.isFinite(Number(value)) && value !== '' && value != null
    ? new Intl.NumberFormat('en-US').format(Number(value))
    : '—'

  return <section className="main-section main-market-section" aria-labelledby="market-react-title">
    {view === 'interest' ? <div className="market-react-detail-pane"><ProductInterest key={`${view}-${targetUuid}`} uuid={targetUuid} lang={lang} onBack={() => setView(null)} /></div> : <>
      <header className="market-react-page-heading"><h1>{labels.pageTitle}</h1><p>{labels.subtitle}</p></header>
      <div className="market-react-workspace">
        <header className="market-react-manager-header">{labels.fieldDataManager}</header>
        <aside className="market-react-sidebar" aria-label={labels.title}>
          <div className="market-react-sidebar-head"><h1 id="market-react-title">{lang === 'fr' ? 'Parcelles' : 'Parcel add'}</h1></div>
          <label className="market-react-search"><span className="sr-only">{labels.search}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} /></label>
          <div className="market-react-filters"><span>{labels.filter}</span><button type="button" aria-pressed={sort === 'date'} disabled={!hasDates} onClick={() => setSort((value) => value === 'date' ? 'name' : 'date')}>{labels.date} <Icon name={sort === 'date' ? 'arrow-down' : 'arrow-up'} size={12}/></button><button type="button" aria-pressed={sort === 'name'} onClick={() => { setSort('name'); setDescending((value) => !value) }}>{labels.name} <Icon name={descending ? 'arrow-down' : 'arrow-up'} size={12}/></button><span className="market-react-count">{loading ? '…' : parcels.length}</span></div>
          <details className="market-react-filter-panel">
            <summary>{filterLabels.advanced}</summary>
            <div className="market-react-filter-fields">
              <label className="market-react-filter-location">
                <span>{filterLabels.location}</span>
                <input type="search" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} />
                <small>{filterLabels.locationHint}</small>
              </label>
              <fieldset className="market-react-filter-group">
                <legend>{filterLabels.price}</legend>
                <label><span>{filterLabels.min}</span><input type="number" min="0" step="any" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
                <label><span>{filterLabels.max}</span><input type="number" min="0" step="any" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
                <label className="market-react-filter-currency"><span>{filterLabels.currency}</span><select value={priceCurrency} onChange={(event) => setPriceCurrency(event.target.value)} disabled={!currencies.length}>
                  <option value="">{filterLabels.chooseCurrency}</option>
                  {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select></label>
              </fieldset>
              <fieldset className="market-react-filter-group">
                <legend>{filterLabels.area}</legend>
                <label><span>{filterLabels.min}</span><input type="number" min="0" step="any" value={minArea} onChange={(event) => setMinArea(event.target.value)} /></label>
                <label><span>{filterLabels.max}</span><input type="number" min="0" step="any" value={maxArea} onChange={(event) => setMaxArea(event.target.value)} /></label>
              </fieldset>
              <p className="market-react-filter-limits">{filterLabels.dataLimits}</p>
              {priceLimitsActive && !priceCurrency && <p className="market-react-filter-currency-hint" role="status">{filterLabels.chooseCurrencyHint}</p>}
              <button className="market-react-filter-reset" type="button" onClick={resetFilters}>{filterLabels.reset}</button>
            </div>
          </details>
          <div className="market-react-list" aria-live="polite" aria-busy={loading}>
            {loading && <p role="status">{labels.loading}</p>}
            {error && <MarketError error={error} onRetry={() => { setLoading(true); setError(null); setRetryKey((key) => key + 1) }} lang={lang} />}
            {!loading && !error && visible.length === 0 && <p>{anyFilterActive ? filterLabels.noMatch : labels.empty}</p>}
            {!loading && !error && visible.map((row) => <article className={`market-react-card${String(row.id) === String(selectedId) ? ' is-selected' : ''}`} key={row.uuid || row.id}>
              <div className="market-react-card-heading"><button className="market-react-card-select" type="button" onClick={() => selectParcel(row)}><strong>{row.parcel_name || '—'}</strong></button><span>{labels.pricePerM2}: {formatPrice(row.price_m2)}</span></div>
              <div className="market-react-card-info"><p><b>{labels.locationLabel}:</b> {row.location_name || '—'}</p><p><b>{labels.referenceLabel}:</b> {row.uuid || '—'}</p><p className="market-react-description">{row.description || '—'}</p></div>
              <div className="market-react-card-actions">
                <button className="market-react-map-button" type="button" onClick={() => selectParcel(row)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>{labels.map}</button>
                <button type="button" disabled={!hasMarketplaceUuid(row)} title={!hasMarketplaceUuid(row) ? labels.uuidUnavailable : undefined} onClick={() => openAction('interest', row)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 5.1-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z"/></svg>{labels.interest}</button>
                {hasMarketplaceUuid(row)
                  ? <a className="market-react-report-link" href={`/georeport/${encodeURIComponent(row.uuid)}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 16h6"/></svg>{labels.report}</a>
                  : <button className="market-react-report-link" type="button" disabled title={labels.uuidUnavailable}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 16h6"/></svg>{labels.report}</button>}
              </div>
            </article>)}
          </div>
        </aside>
        <div className="market-react-map"><ParcelMap parcels={parcels} selectedParcel={selectedParcel} focusVersion={focusVersion} onSelectParcel={(id) => { const row = parcels.find((parcel) => String(parcel.id) === String(id) || String(parcel.uuid) === String(id)); if (row) selectParcel(row) }} onGeometryComplete={() => {}} resetDrawingKey={0} lang={lang} onError={setMapError} />{mapError && <p className="market-react-map-error" role="alert">{mapError.message}</p>}</div>
      </div>
    </>}
  </section>
}
