import { useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { deleteAdminParcel, parcelDeletionErrorMessage } from '../api/parcelDeletion.js'
import { parseParcelGeometry } from '../pages/parcelMapData.js'
import AdminParcelMap from './AdminParcelMap.jsx'
import { hideAdminParcel, loadAdminParcel, loadAdminParcels, restoreAdminParcel } from './adminApi.js'
import { adminText } from './adminTranslations.js'
import {
  buildAdminParcelListQuery,
  applyAdminParcelVisibilityDecision,
  formatParcelArea,
  formatParcelDate,
  formatParcelMoney,
  getParcelOutline,
  outlineToSvg,
  parcelDetailViewState,
  parcelListViewState,
  readAdminParcelMetricFilters,
} from './adminParcelData.js'

const PAGE_SIZE = 20
const SORTS = [
  { key: 'status', label: 'Status', firstDirection: 'asc' },
  { key: 'date', label: 'Date', firstDirection: 'desc' },
  { key: 'name', label: 'A-Z', firstDirection: 'asc' },
]

function errorMessage(error, language = 'en') {
  return apiErrorMessage(error, language) || adminText(language, 'Could not load parcel data. Please try again.')
}

function AdminParcelListView({ state, onRetry, onPageChange, onSort, sort, direction, search, onSearchChange, onSearch, dateFrom, dateTo, onDateChange, metricFilters = { sellCategory: '', visibility: '', contactedFrom: '', contactedTo: '' }, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <section className="admin-page-panel admin-list-panel" aria-labelledby="admin-parcel-list-title">
      <h1 id="admin-parcel-list-title">{t('Parcel')}</h1>
      {(metricFilters.sellCategory || metricFilters.contactedFrom) && <p className="admin-metric-filter-note">
        {metricFilters.sellCategory === 'to_sell' && <>{t('Filtered to sell_category = to_sell.')} <a href="/admin/parcels">{t('Clear filter')}</a></>}
        {metricFilters.contactedFrom && <>{t('Distinct parcels with a linked Marketplace message from')} {metricFilters.contactedFrom} {t('to')} {metricFilters.contactedTo} {t('(UTC, end exclusive).')} <a href="/admin/parcels">{t('Clear filter')}</a></>}
      </p>}
      {metricFilters.visibility === 'visible' && <p className="admin-metric-filter-note">{t('Filtered to currently visible Marketplace parcels.')} <a href="/admin/parcels">{t('Clear filter')}</a></p>}
      {metricFilters.visibility === 'hidden' && <p className="admin-metric-filter-note">{t('Filtered to manually hidden parcels.')} <a href="/admin/parcels">{t('Clear filter')}</a></p>}
      <div className="admin-list-toolbar admin-parcel-toolbar">
        <form className="admin-filter-row admin-search-row" role="search" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="admin-parcel-search">{t('Search parcels')}</label>
          <input id="admin-parcel-search" type="search" placeholder={t('Search parcel, owner, location or ID')} value={search} onChange={(event) => onSearchChange(event.target.value)}/>
          <button className="admin-filter-pill admin-search-button" type="submit">{t('Search')}</button>
        </form>
        <div className="admin-filter-row" aria-label={t('Sort parcels')}>
          <span className="admin-filter-label">{t('Sorting:')}</span>
          {SORTS.map((item) => (
            <button
              className="admin-filter-pill"
              type="button"
              key={item.key}
              aria-pressed={sort === item.key}
              onClick={() => onSort(item.key, item.firstDirection)}
            >
              {t(item.label)}{sort === item.key ? (direction === 'asc' ? ' \u2191' : ' \u2193') : ''}
            </button>
          ))}
        </div>
        <div className="admin-filter-row">
          <span className="admin-filter-label">{t('Filter date:')}</span>
          <label className="sr-only" htmlFor="admin-parcel-date-from">{t('From date')}</label>
          <input className="admin-date-filter" id="admin-parcel-date-from" type="date" value={dateFrom} onChange={(event) => onDateChange('dateFrom', event.target.value)}/>
          <label className="sr-only" htmlFor="admin-parcel-date-to">{t('To date')}</label>
          <input className="admin-date-filter" id="admin-parcel-date-to" type="date" value={dateTo} onChange={(event) => onDateChange('dateTo', event.target.value)}/>
        </div>
      </div>

      {state.kind === 'loading' && <p className="admin-parcel-state" role="status">{t('Loading parcels...')}</p>}
      {state.kind === 'error' && (
        <div className="admin-parcel-state" role="alert">
          <p>{errorMessage(state.error, lang)}</p>
          <button className="admin-retry-button" type="button" onClick={onRetry}>{t('Retry')}</button>
        </div>
      )}
      {state.kind === 'empty' && <p className="admin-parcel-state" role="status">{t('No parcels found.')}</p>}
      {state.kind === 'ready' && (
        <>
          <div className="admin-table-wrap admin-parcel-table-wrap">
            <table>
              <caption className="sr-only">{t('Parcels')}</caption>
              <thead><tr>
                <th scope="col">{t('Parcel name')}</th><th scope="col">{t('User')}</th><th scope="col">{t('Declared surface')}</th>
                <th scope="col">{t('Calculated / historical price')}</th><th scope="col">{t('Date')}</th><th scope="col">{t('Visibility')}</th><th scope="col">{t('Action')}</th>
              </tr></thead>
              <tbody>{state.parcels.map((parcel) => (
                <tr key={parcel.id}>
                  <td>{parcel.parcel_name || '—'}</td>
                  <td>{parcel.owner || '—'}</td>
                  <td>{parcel.declared_area_ha == null ? t('Declared area not provided') : formatParcelArea(parcel.declared_area_ha)}</td>
                  <td>{`${formatParcelMoney(parcel.price, parcel.currency, lang === 'fr' ? 'fr-FR' : 'en-US', true)}${parcel.price_source === 'calculated' ? '' : ` (${t('historical; not recalculated')})`}`}</td>
                  <td>{formatParcelDate(parcel.created_at, lang === 'fr' ? 'fr-FR' : 'en-GB')}</td>
                  <td><span className={parcel.is_hidden ? 'admin-visibility-badge is-hidden' : 'admin-visibility-badge'}>{parcel.is_hidden ? t('Hidden') : t('Visible')}</span></td>
                  <td><a className="admin-consult-link" href={`/admin/parcels/${encodeURIComponent(String(parcel.id))}`}>{t('Consult')} <span aria-hidden="true">&#8594;</span></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="admin-parcel-pagination" aria-label={t('Parcel pagination')}>
            <span>{state.pagination.total} {t('parcels')}</span>
            <div>
              <button type="button" onClick={() => onPageChange(state.pagination.page - 1)} disabled={state.pagination.page <= 1}>{t('Previous')}</button>
              <span aria-live="polite">{t('Page')} {state.pagination.page} {t('of')} {state.pagination.pages}</span>
              <button type="button" onClick={() => onPageChange(state.pagination.page + 1)} disabled={state.pagination.page >= state.pagination.pages}>{t('Next')}</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function AdminParcelListPage({ request, lang = 'en' }) {
  const [metricFilters] = useState(() => readAdminParcelMetricFilters(globalThis.location?.search || ''))
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [direction, setDirection] = useState('desc')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [retry, setRetry] = useState(0)
  const [resource, setResource] = useState(null)
  const queryKey = JSON.stringify([page, search, sort, direction, dateFrom, dateTo, metricFilters, retry])

  useEffect(() => {
    let current = true
    const query = buildAdminParcelListQuery({ page, perPage: PAGE_SIZE, search, sort, direction, dateFrom, dateTo, ...metricFilters })
    loadAdminParcels(request, query)
      .then((result) => { if (current) setResource({ queryKey, result, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, result: null, error }) })
    return () => { current = false }
  }, [request, queryKey, page, search, sort, direction, dateFrom, dateTo, metricFilters])

  const currentResource = resource?.queryKey === queryKey ? resource : null
  const state = parcelListViewState({
    loading: !currentResource,
    error: currentResource?.error,
    result: currentResource?.result,
  })

  function chooseSort(nextSort, firstDirection) {
    if (sort === nextSort) setDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else { setSort(nextSort); setDirection(firstDirection) }
    setPage(1)
  }

  function changeDate(field, value) {
    if (field === 'dateFrom') setDateFrom(value)
    else setDateTo(value)
    setPage(1)
  }

  function submitSearch(event) {
    event.preventDefault()
    setSearch(searchDraft)
    setPage(1)
  }

  return <AdminParcelListView
    state={state}
    onRetry={() => setRetry((value) => value + 1)}
    onPageChange={setPage}
    onSort={chooseSort}
    sort={sort}
    direction={direction}
    search={searchDraft}
    onSearchChange={setSearchDraft}
    onSearch={submitSearch}
    dateFrom={dateFrom}
    dateTo={dateTo}
    onDateChange={changeDate}
    metricFilters={metricFilters}
    lang={lang}
  />
}

function ParcelOutline({ geojson, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  const geometry = parseParcelGeometry(geojson)
  const rings = geometry ? getParcelOutline(geometry) : []
  const polygons = outlineToSvg(rings)
  if (!polygons.length) return <p className="admin-outline-unavailable">{t('Plot outline unavailable.')}</p>
  return (
    <svg className="admin-parcel-outline" viewBox="0 0 100 100" role="img" aria-label={t('Plot outline')}>
      {polygons.map((points, index) => <polygon key={index} points={points} fill="rgb(215 181 85 / 25%)" stroke="#f0d57c" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>)}
    </svg>
  )
}

function display(value, fallback = '\u2014') {
  return value === null || value === undefined || value === '' ? fallback : String(value)
}

function AdminParcelDetailView({
  state, id, onRetry, visibilityReason = '', onReasonChange = () => {},
  onVisibilityAction = () => {}, visibilityPending = false,
  visibilityError = null, visibilityNotice = null,
  deleteOpen = false, onDeleteOpen = () => {},
  onDeleteCancel = () => {}, deleteReason = '', onDeleteReasonChange = () => {},
  onDeleteConfirm = () => {}, deletePending = false, deleteError = null,
  deleteComplete = false,
  lang = 'en',
}) {
  const t = (text) => adminText(lang, text)
  if (deleteComplete) return (
    <section className="admin-page-panel admin-parcel-detail-message" role="status">
      <h1>{t('Parcel deleted')}</h1>
        <p>{t('The parcel was removed from active records. Its full record and deletion details remain in the protected archive.')}</p>
      <a className="admin-inline-link" href="/admin/parcels">{t('Return to parcels')}</a>
    </section>
  )
  if (state.kind === 'loading') return <section className="admin-page-panel" role="status">{t('Loading parcel...')}</section>
  if (state.kind === 'error' || state.kind === 'notFound') {
    const missing = state.kind === 'notFound'
    return (
      <section className="admin-page-panel admin-parcel-detail-message" aria-labelledby="admin-parcel-detail-message-title">
        <a className="admin-inline-link" href="/admin/parcels">← {t('Back to list')}</a>
        <h1 id="admin-parcel-detail-message-title">{missing ? t('Parcel not found') : t('Parcel detail unavailable')}</h1>
        {!missing && <><p role="alert">{errorMessage(state.error, lang)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>{t('Retry')}</button></>}
      </section>
    )
  }

  const parcel = state.parcel
  const area = parcel.declared_area_ha == null
    ? t('Declared area not provided')
    : formatParcelArea(parcel.declared_area_ha)
  const fields = [
    [t('Plot name'), display(parcel.parcel_name)],
    [t('Owner'), display(parcel.owner)],
    [t('Location'), display(parcel.location_name)],
    [t('Description'), display(parcel.description)],
    [t('Declared surface'), area],
    [t('Geometry area'), formatParcelArea(parcel.area_ha)],
    [t(parcel.price_source === 'calculated' ? 'Calculated total price' : 'Historical price (not recalculated)'), formatParcelMoney(parcel.price, parcel.currency, lang === 'fr' ? 'fr-FR' : 'en-US', true)],
    [t(parcel.declared_price_m2 == null ? 'Historical price per m2' : 'Price per m2'), formatParcelMoney(parcel.declared_price_m2 ?? parcel.price_m2, parcel.currency, lang === 'fr' ? 'fr-FR' : 'en-US', true)],
    [t('Currency'), display(parcel.currency)],
    [t('Sale category'), display(parcel.sell_category)],
    [t('Creation date'), formatParcelDate(parcel.created_at, lang === 'fr' ? 'fr-FR' : 'en-GB')],
    [t('Latitude / Longitude'), parcel.latitude == null || parcel.longitude == null ? t('Unavailable') : `${parcel.latitude} / ${parcel.longitude}`],
    [t('Plot outline'), <ParcelOutline key="outline" geojson={parcel.geojson} lang={lang}/>],
    [t('Status'), display(parcel.status_category)],
    [t('Manual Marketplace visibility'), parcel.visibility?.is_hidden ? t('Hidden by admin') : t('No manual hide')],
  ]

  return (
    <div className="admin-detail-stack">
      <a className="admin-inline-link" href="/admin/parcels">&#8592; {t('Back to list')}</a>
      <section className="admin-detail-panel admin-parcel-delete-panel" aria-labelledby="admin-parcel-delete-title">
        <h2 id="admin-parcel-delete-title">{t('Delete parcel')}</h2>
        <p>{t('This permanently removes the parcel from active lists and public routes. Its complete record and the responsible admin are retained in the protected deletion archive.')}</p>
        {deleteError && !deleteOpen && <p className="admin-parcel-delete-error" role="alert">{parcelDeletionErrorMessage(deleteError, lang, 'admin')}</p>}
        {!deleteOpen
          ? <button className="admin-parcel-delete-button" type="button" disabled={deletePending} onClick={onDeleteOpen}>{t('Delete parcel')}</button>
          : <div className="admin-parcel-delete-confirm" role="group" aria-labelledby="admin-parcel-delete-confirm-title">
            <h3 id="admin-parcel-delete-confirm-title">{t('Confirm permanent removal')}</h3>
            <p>{t('Confirm only if this parcel should no longer exist in active records. The archived copy cannot be restored through this screen.')}</p>
            <label htmlFor="admin-parcel-delete-reason">{t('Reason (required, up to 1000 characters)')}</label>
            <textarea id="admin-parcel-delete-reason" required maxLength={1000} rows={3} value={deleteReason} disabled={deletePending} onChange={(event) => onDeleteReasonChange(event.target.value)}/>
            {deleteError && <p className="admin-parcel-delete-error" role="alert">{parcelDeletionErrorMessage(deleteError, lang, 'admin')}</p>}
            <div className="admin-parcel-delete-actions">
              <button type="button" disabled={deletePending} onClick={onDeleteCancel}>{t('Cancel')}</button>
              <button className="admin-parcel-delete-button" type="button" disabled={deletePending || !deleteReason.trim() || deleteReason.trim().length > 1000} onClick={onDeleteConfirm}>{t(deletePending ? 'Deleting…' : 'Confirm deletion')}</button>
            </div>
          </div>}
      </section>
      <div className="admin-parcel-detail-grid">
        <section className="admin-detail-panel admin-parcel-preview" aria-labelledby="admin-parcel-preview-title">
          <div className="admin-parcel-map-frame"><AdminParcelMap geojson={parcel.geojson} lang={lang}/></div>
          <h2 id="admin-parcel-preview-title">{display(parcel.parcel_name)}</h2>
          <p className="admin-parcel-preview-owner">{display(parcel.owner)}</p>
          <p className="admin-parcel-id">ID {id}</p>
        </section>
        <section className="admin-detail-panel admin-detail-information" aria-labelledby="admin-parcel-information-title">
          <h1 id="admin-parcel-information-title">{t('Personal information')}</h1>
          <dl className="admin-detail-fields">{fields.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}</dl>
        </section>
      </div>
      <section className="admin-detail-panel admin-visibility-panel" aria-labelledby="admin-visibility-title">
        <h2 id="admin-visibility-title">{t('Marketplace visibility')}</h2>
        <p className={parcel.visibility?.is_hidden ? 'admin-visibility-current is-hidden' : 'admin-visibility-current'} role="status">
          {t(parcel.visibility?.is_hidden ? 'This listing is manually hidden from the Marketplace.' : 'This parcel has no active manual hide.')}
        </p>
        {parcel.visibility?.reason && <p className="admin-visibility-reason">{t('Last decision:')} {parcel.visibility.reason}</p>}
        <p className="admin-visibility-help">{t('Only parcels with sale category to_sell appear in the Marketplace. Restoring visibility does not change that category.')}</p>
        <label className="admin-visibility-reason-input">
          {t('Reason for this decision (required)')}
          <textarea maxLength={1000} required value={visibilityReason} onChange={(event) => onReasonChange(event.target.value)} disabled={visibilityPending} rows={3}/>
        </label>
        {visibilityError && <p className="admin-visibility-error" role="alert">{errorMessage(visibilityError, lang)}</p>}
        {visibilityNotice && <p className="admin-visibility-success" role="status">{t(visibilityNotice)}</p>}
        <button
          className={parcel.visibility?.is_hidden ? 'admin-visibility-action is-restore' : 'admin-visibility-action'}
          type="button"
          disabled={visibilityPending || !visibilityReason.trim() || visibilityReason.trim().length > 1000}
          onClick={() => onVisibilityAction(parcel.visibility?.is_hidden ? 'restore' : 'hide')}
        >
          {t(visibilityPending ? 'Saving decision...' : parcel.visibility?.is_hidden ? 'Restore visibility' : 'Hide from Marketplace')}
        </button>
        <h3>{t('Decision history')}</h3>
        {Array.isArray(parcel.visibility_history) && parcel.visibility_history.length > 0 ? (
          <ol className="admin-visibility-history">
            {parcel.visibility_history.map((decision) => <li key={decision.id}>
              <strong>{t(decision.action === 'hide' ? 'Hidden' : 'Restored')}</strong>
              <span>{decision.reason}</span>
              <small>{t('Admin ID')} {decision.admin_id} · {formatParcelDate(decision.created_at, lang === 'fr' ? 'fr-FR' : 'en-GB')}</small>
            </li>)}
          </ol>
        ) : <p className="admin-visibility-help">{t('No manual visibility decisions recorded.')}</p>}
        {parcel.visibility_history_truncated && <p className="admin-visibility-help">{t('Showing the latest 100 decisions.')}</p>}
      </section>

    </div>
  )
}

export function AdminParcelDetailPage({ request, id, lang = 'en' }) {
  const [retry, setRetry] = useState(0)
  const [resource, setResource] = useState(null)
  const [visibilityReason, setVisibilityReason] = useState('')
  const [visibilityPending, setVisibilityPending] = useState(false)
  const [visibilityError, setVisibilityError] = useState(null)
  const [visibilityNotice, setVisibilityNotice] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteComplete, setDeleteComplete] = useState(false)
  const deleteFlightRef = useRef(false)
  const queryKey = `${id}:${retry}`

  useEffect(() => {
    let current = true
    loadAdminParcel(request, id)
      .then((parcel) => { if (current) setResource({ queryKey, parcel, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, parcel: null, error }) })
    return () => { current = false }
  }, [request, id, queryKey])

  const currentResource = resource?.queryKey === queryKey ? resource : null
  const state = parcelDetailViewState({
    loading: !currentResource,
    error: currentResource?.error,
    parcel: currentResource?.parcel,
  })
  async function submitVisibilityAction(action) {
    setVisibilityPending(true)
    setVisibilityError(null)
    setVisibilityNotice(null)
    try {
      const decision = action === 'hide'
        ? await hideAdminParcel(request, id, visibilityReason)
        : await restoreAdminParcel(request, id, visibilityReason)
      setResource((current) => {
        if (current?.queryKey !== queryKey || !current.parcel) return current
        return {
          ...current,
          parcel: applyAdminParcelVisibilityDecision(current.parcel, decision),
        }
      })
      setVisibilityReason('')
      setVisibilityNotice(action === 'hide'
        ? 'The listing is hidden from the Marketplace.'
        : 'The manual hide was removed. The sale category was not changed.')
    } catch (error) {
      setVisibilityError(error)
    } finally {
      setVisibilityPending(false)
    }
  }

  async function confirmDelete() {
    if (deletePending || deleteFlightRef.current || !deleteReason.trim() || deleteReason.trim().length > 1000) return
    deleteFlightRef.current = true
    setDeletePending(true)
    setDeleteError(null)
    try {
      await deleteAdminParcel(request, id, deleteReason, { confirmed: true })
      setDeleteComplete(true)
      setDeleteOpen(false)
      setDeleteReason('')
    } catch (error) {
      setDeleteError(error)
    } finally {
      deleteFlightRef.current = false
      setDeletePending(false)
    }
  }

  return <AdminParcelDetailView
    state={state}
    id={id}
    onRetry={() => setRetry((value) => value + 1)}
    visibilityReason={visibilityReason}
    onReasonChange={setVisibilityReason}
    onVisibilityAction={submitVisibilityAction}
    visibilityPending={visibilityPending}
    visibilityError={visibilityError}
    visibilityNotice={visibilityNotice}
    deleteOpen={deleteOpen}
    onDeleteOpen={() => { setDeleteOpen(true); setDeleteError(null) }}
    onDeleteCancel={() => { if (!deletePending && !deleteFlightRef.current) { setDeleteOpen(false); setDeleteReason(''); setDeleteError(null) } }}
    deleteReason={deleteReason}
    onDeleteReasonChange={setDeleteReason}
    onDeleteConfirm={confirmDelete}
    deletePending={deletePending}
    deleteError={deleteError}
    deleteComplete={deleteComplete}
    lang={lang}
  />
}

export { AdminParcelDetailView, AdminParcelListView }
