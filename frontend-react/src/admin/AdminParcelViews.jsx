import { useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { isLocalBackendConfigured } from '../api/backendMode.js'
import { deleteAdminParcel, parcelDeletionErrorMessage } from '../api/parcelDeletion.js'
import { parseParcelGeometry } from '../pages/parcelMapData.js'
import AdminParcelMap from './AdminParcelMap.jsx'
import { hideAdminParcel, loadAdminParcel, loadAdminParcels, restoreAdminParcel } from './adminApi.js'
import {
  buildAdminParcelListQuery,
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
  { key: 'name', label: 'A–Z', firstDirection: 'asc' },
]

function errorMessage(error) {
  const language = globalThis.document?.documentElement?.lang || 'en'
  return apiErrorMessage(error, language) || 'Parcel data could not be loaded. Please try again.'
}

function AdminParcelListView({ state, onRetry, onPageChange, onSort, sort, direction, search, onSearchChange, onSearch, dateFrom, dateTo, onDateChange, metricFilters = { sellCategory: '', visibility: '', contactedFrom: '', contactedTo: '' } }) {
  return (
    <section className="admin-page-panel admin-list-panel" aria-labelledby="admin-parcel-list-title">
      <h1 id="admin-parcel-list-title">Parcel</h1>
      {(metricFilters.sellCategory || metricFilters.contactedFrom) && <p className="admin-metric-filter-note">
        {metricFilters.sellCategory === 'to_sell' && <>Filtered · sell_category = to_sell. <a href="/admin/parcels">Clear filter</a></>}
        {metricFilters.contactedFrom && <>Filtered · distinct parcels with a linked message in Marketplace conversations from {metricFilters.contactedFrom} to {metricFilters.contactedTo} (UTC, end exclusive). <a href="/admin/parcels">Clear filter</a></>}
      </p>}
      {metricFilters.visibility === 'visible' && <p className="admin-metric-filter-note">Filtered to currently visible Marketplace parcels. <a href="/admin/parcels">Clear filter</a></p>}
      {metricFilters.visibility === 'hidden' && <p className="admin-metric-filter-note">Filtered to manually hidden parcels. <a href="/admin/parcels">Clear filter</a></p>}
      <div className="admin-list-toolbar admin-parcel-toolbar">
        <form className="admin-filter-row admin-search-row" role="search" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="admin-parcel-search">Search parcels</label>
          <input id="admin-parcel-search" type="search" placeholder="Search parcel, owner, location or ID" value={search} onChange={(event) => onSearchChange(event.target.value)}/>
          <button className="admin-filter-pill admin-search-button" type="submit">Search</button>
        </form>
        <div className="admin-filter-row" aria-label="Sort parcels">
          <span className="admin-filter-label">Sorting:</span>
          {SORTS.map((item) => (
            <button
              className="admin-filter-pill"
              type="button"
              key={item.key}
              aria-pressed={sort === item.key}
              onClick={() => onSort(item.key, item.firstDirection)}
            >
              {item.label}{sort === item.key ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
            </button>
          ))}
        </div>
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter date:</span>
          <label className="sr-only" htmlFor="admin-parcel-date-from">From date</label>
          <input className="admin-date-filter" id="admin-parcel-date-from" type="date" value={dateFrom} onChange={(event) => onDateChange('dateFrom', event.target.value)}/>
          <label className="sr-only" htmlFor="admin-parcel-date-to">To date</label>
          <input className="admin-date-filter" id="admin-parcel-date-to" type="date" value={dateTo} onChange={(event) => onDateChange('dateTo', event.target.value)}/>
        </div>
      </div>

      {state.kind === 'loading' && <p className="admin-parcel-state" role="status">Loading parcels…</p>}
      {state.kind === 'error' && (
        <div className="admin-parcel-state" role="alert">
          <p>{errorMessage(state.error)}</p>
          <button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button>
        </div>
      )}
      {state.kind === 'empty' && <p className="admin-parcel-state" role="status">No parcels found.</p>}
      {state.kind === 'ready' && (
        <>
          <div className="admin-table-wrap admin-parcel-table-wrap">
            <table>
              <caption className="sr-only">Parcels</caption>
              <thead><tr>
                <th scope="col">Parcel name</th><th scope="col">User</th><th scope="col">Surface</th>
                <th scope="col">Price</th><th scope="col">Date</th><th scope="col">Visibility</th><th scope="col">Action</th>
              </tr></thead>
              <tbody>{state.parcels.map((parcel) => (
                <tr key={parcel.id}>
                  <td>{parcel.parcel_name || '—'}</td>
                  <td>{parcel.owner || '—'}</td>
                  <td>{formatParcelArea(parcel.area_ha)}</td>
                  <td>{formatParcelMoney(parcel.price, parcel.currency)}</td>
                  <td>{formatParcelDate(parcel.created_at)}</td>
                  <td><span className={parcel.is_hidden ? 'admin-visibility-badge is-hidden' : 'admin-visibility-badge'}>{parcel.is_hidden ? 'Hidden' : 'Visible'}</span></td>
                  <td><a className="admin-consult-link" href={`/admin/parcels/${encodeURIComponent(String(parcel.id))}`}>Consult <span aria-hidden="true">→</span></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="admin-parcel-pagination" aria-label="Parcel pagination">
            <span>{state.pagination.total} parcels</span>
            <div>
              <button type="button" onClick={() => onPageChange(state.pagination.page - 1)} disabled={state.pagination.page <= 1}>Previous</button>
              <span aria-live="polite">Page {state.pagination.page} of {state.pagination.pages}</span>
              <button type="button" onClick={() => onPageChange(state.pagination.page + 1)} disabled={state.pagination.page >= state.pagination.pages}>Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function AdminParcelListPage({ request }) {
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
  />
}

function ParcelOutline({ geojson }) {
  const geometry = parseParcelGeometry(geojson)
  const rings = geometry ? getParcelOutline(geometry) : []
  const polygons = outlineToSvg(rings)
  if (!polygons.length) return <p className="admin-outline-unavailable">Plot outline unavailable.</p>
  return (
    <svg className="admin-parcel-outline" viewBox="0 0 100 100" role="img" aria-label="Parcel outline">
      {polygons.map((points, index) => <polygon key={index} points={points} fill="rgb(215 181 85 / 25%)" stroke="#f0d57c" strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>)}
    </svg>
  )
}

function display(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function AdminParcelDetailView({
  state, id, onRetry, visibilityReason = '', onReasonChange = () => {},
  onVisibilityAction = () => {}, visibilityPending = false,
  visibilityError = null, visibilityNotice = null,
  localBackend = isLocalBackendConfigured(), deleteOpen = false, onDeleteOpen = () => {},
  onDeleteCancel = () => {}, deleteReason = '', onDeleteReasonChange = () => {},
  onDeleteConfirm = () => {}, deletePending = false, deleteError = null,
  deleteComplete = false,
}) {
  if (deleteComplete) return (
    <section className="admin-page-panel admin-parcel-detail-message" role="status">
      <h1>Parcel deleted</h1>
      <p>The parcel was removed from active records. Its full record and deletion details remain in the protected archive.</p>
      <a className="admin-inline-link" href="/admin/parcels">Return to parcels</a>
    </section>
  )
  if (state.kind === 'loading') return <section className="admin-page-panel" role="status">Loading parcel…</section>
  if (state.kind === 'error' || state.kind === 'notFound') {
    const missing = state.kind === 'notFound'
    return (
      <section className="admin-page-panel admin-parcel-detail-message" aria-labelledby="admin-parcel-detail-message-title">
        <a className="admin-inline-link" href="/admin/parcels">← Back to list</a>
        <h1 id="admin-parcel-detail-message-title">{missing ? 'Parcel not found' : 'Parcel detail unavailable'}</h1>
        {!missing && <><p role="alert">{errorMessage(state.error)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button></>}
      </section>
    )
  }

  const parcel = state.parcel
  const area = formatParcelArea(parcel.area_ha)
  const fields = [
    ['Plot name', display(parcel.parcel_name)],
    ['Owner', display(parcel.owner)],
    ['Location', display(parcel.location_name)],
    ['Description', display(parcel.description)],
    ['Area', area],
    ['Total price', formatParcelMoney(parcel.price, parcel.currency)],
    ['Price per m²', formatParcelMoney(parcel.price_m2, parcel.currency)],
    ['Currency', display(parcel.currency)],
    ['Sale category', display(parcel.sell_category)],
    ['Creation date', formatParcelDate(parcel.created_at)],
    ['Latitude / Longitude', parcel.latitude == null || parcel.longitude == null ? '—' : `${parcel.latitude} / ${parcel.longitude}`],
    ['Plot outline', <ParcelOutline key="outline" geojson={parcel.geojson}/>],
    ['Status', display(parcel.status_category)],
    ['Manual Marketplace visibility', parcel.visibility?.is_hidden ? 'Hidden by admin' : 'No manual hide'],
  ]

  return (
    <div className="admin-detail-stack">
      <a className="admin-inline-link" href="/admin/parcels">← Back to list</a>
      {localBackend && <section className="admin-detail-panel admin-parcel-delete-panel" aria-labelledby="admin-parcel-delete-title">
        <h2 id="admin-parcel-delete-title">Delete parcel</h2>
        <p>This permanently removes the parcel from active lists and public routes. Its complete record and the responsible admin are retained in the protected deletion archive.</p>
        {deleteError && !deleteOpen && <p className="admin-parcel-delete-error" role="alert">{parcelDeletionErrorMessage(deleteError, 'en', 'admin')}</p>}
        {!deleteOpen
          ? <button className="admin-parcel-delete-button" type="button" disabled={deletePending} onClick={onDeleteOpen}>Delete parcel</button>
          : <div className="admin-parcel-delete-confirm" role="group" aria-labelledby="admin-parcel-delete-confirm-title">
            <h3 id="admin-parcel-delete-confirm-title">Confirm permanent removal</h3>
            <p>Confirm only if this parcel should no longer exist in active records. The archived copy cannot be restored through this screen.</p>
            <label htmlFor="admin-parcel-delete-reason">Reason (required, up to 1000 characters)</label>
            <textarea id="admin-parcel-delete-reason" required maxLength={1000} rows={3} value={deleteReason} disabled={deletePending} onChange={(event) => onDeleteReasonChange(event.target.value)}/>
            {deleteError && <p className="admin-parcel-delete-error" role="alert">{parcelDeletionErrorMessage(deleteError, 'en', 'admin')}</p>}
            <div className="admin-parcel-delete-actions">
              <button type="button" disabled={deletePending} onClick={onDeleteCancel}>Cancel</button>
              <button className="admin-parcel-delete-button" type="button" disabled={deletePending || !deleteReason.trim() || deleteReason.trim().length > 1000} onClick={onDeleteConfirm}>{deletePending ? 'Deleting…' : 'Confirm deletion'}</button>
            </div>
          </div>}
      </section>}
      <div className="admin-parcel-detail-grid">
        <section className="admin-detail-panel admin-parcel-preview" aria-labelledby="admin-parcel-preview-title">
          <div className="admin-parcel-map-frame"><AdminParcelMap geojson={parcel.geojson}/></div>
          <h2 id="admin-parcel-preview-title">{display(parcel.parcel_name)}</h2>
          <p className="admin-parcel-preview-owner">{display(parcel.owner)}</p>
          <p className="admin-parcel-id">ID {id}</p>
        </section>
        <section className="admin-detail-panel admin-detail-information" aria-labelledby="admin-parcel-information-title">
          <h1 id="admin-parcel-information-title">Personal information</h1>
          <dl className="admin-detail-fields">{fields.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}</dl>
        </section>
      </div>
      <section className="admin-detail-panel admin-visibility-panel" aria-labelledby="admin-visibility-title">
        <h2 id="admin-visibility-title">Marketplace visibility</h2>
        <p className={parcel.visibility?.is_hidden ? 'admin-visibility-current is-hidden' : 'admin-visibility-current'} role="status">
          {parcel.visibility?.is_hidden ? 'This listing is manually hidden from the Marketplace.' : 'This parcel has no active manual hide.'}
        </p>
        {parcel.visibility?.reason && <p className="admin-visibility-reason">Last decision: {parcel.visibility.reason}</p>}
        <p className="admin-visibility-help">Only parcels with sale category “to_sell” appear in the Marketplace. Restoring visibility does not change that category.</p>
        <label className="admin-visibility-reason-input">
          Reason for this decision (required)
          <textarea maxLength={1000} required value={visibilityReason} onChange={(event) => onReasonChange(event.target.value)} disabled={visibilityPending} rows={3}/>
        </label>
        {visibilityError && <p className="admin-visibility-error" role="alert">{errorMessage(visibilityError)}</p>}
        {visibilityNotice && <p className="admin-visibility-success" role="status">{visibilityNotice}</p>}
        <button
          className={parcel.visibility?.is_hidden ? 'admin-visibility-action is-restore' : 'admin-visibility-action'}
          type="button"
          disabled={visibilityPending || !visibilityReason.trim() || visibilityReason.trim().length > 1000}
          onClick={() => onVisibilityAction(parcel.visibility?.is_hidden ? 'restore' : 'hide')}
        >
          {visibilityPending ? 'Saving decisionâ€¦' : parcel.visibility?.is_hidden ? 'Restore visibility' : 'Hide from Marketplace'}
        </button>
        <h3>Decision history</h3>
        {Array.isArray(parcel.visibility_history) && parcel.visibility_history.length > 0 ? (
          <ol className="admin-visibility-history">
            {parcel.visibility_history.map((decision) => <li key={decision.id}>
              <strong>{decision.action === 'hide' ? 'Hidden' : 'Restored'}</strong>
              <span>{decision.reason}</span>
              <small>Admin ID {decision.admin_id} Â· {formatParcelDate(decision.created_at)}</small>
            </li>)}
          </ol>
        ) : <p className="admin-visibility-help">No manual visibility decisions recorded.</p>}
        {parcel.visibility_history_truncated && <p className="admin-visibility-help">Showing the latest 100 decisions.</p>}
      </section>

    </div>
  )
}

export function AdminParcelDetailPage({ request, id, localBackend = isLocalBackendConfigured() }) {
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
      if (action === 'hide') await hideAdminParcel(request, id, visibilityReason)
      else await restoreAdminParcel(request, id, visibilityReason)
      setVisibilityReason('')
      setVisibilityNotice(action === 'hide'
        ? 'The listing is hidden from the Marketplace.'
        : 'The manual hide was removed. The sale category was not changed.')
      setRetry((value) => value + 1)
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
    localBackend={localBackend}
    deleteOpen={deleteOpen}
    onDeleteOpen={() => { setDeleteOpen(true); setDeleteError(null) }}
    onDeleteCancel={() => { if (!deletePending && !deleteFlightRef.current) { setDeleteOpen(false); setDeleteReason(''); setDeleteError(null) } }}
    deleteReason={deleteReason}
    onDeleteReasonChange={setDeleteReason}
    onDeleteConfirm={confirmDelete}
    deletePending={deletePending}
    deleteError={deleteError}
    deleteComplete={deleteComplete}
  />
}

export { AdminParcelDetailView, AdminParcelListView }
