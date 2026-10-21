import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { loadAdminUser, loadAdminUsers } from './adminApi.js'
import {
  ADMIN_USER_UNAVAILABLE,
  adminUserDetailViewState,
  adminUserListViewState,
  buildAdminUserListQuery,
  displayAdminUserValue,
  formatAdminUserDate,
  getAdminUserInitial,
  readAdminUserDateFilters,
} from './adminUserData.js'

const PAGE_SIZE = 20

function errorMessage(error) {
  const language = globalThis.document?.documentElement?.lang || 'en'
  return apiErrorMessage(error, language) || 'User data could not be loaded. Please try again.'
}

function AdminUserListView({ state, onRetry, onPageChange, onSort, sort, direction, search, onSearchChange, onSearch, dateFrom, dateTo, onDateChange }) {
  return (
    <section className="admin-page-panel admin-list-panel" aria-labelledby="admin-user-list-title">
      <h1 id="admin-user-list-title">Users</h1>
      {(dateFrom || dateTo) && <p className="admin-metric-filter-note">Profiles still present with created_at in the selected UTC date range (inclusive).</p>}
      <div className="admin-list-toolbar admin-user-toolbar">
        <form className="admin-filter-row admin-search-row" role="search" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="admin-user-search">Search users</label>
          <input id="admin-user-search" type="search" placeholder="Search name, username, email, contact or ID" value={search} onChange={(event) => onSearchChange(event.target.value)}/>
          <button className="admin-filter-pill admin-search-button" type="submit">Search</button>
        </form>
        <div className="admin-filter-row" aria-label="Sort users">
          <span className="admin-filter-label">Sorting:</span>
          <button className="admin-filter-pill" type="button" disabled aria-disabled="true" title="Status data is unavailable">Status</button>
          <button className="admin-filter-pill" type="button" aria-pressed={sort === 'date'} onClick={() => onSort('date', 'desc')}>Date{sort === 'date' ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}</button>
          <button className="admin-filter-pill" type="button" aria-pressed={sort === 'name'} onClick={() => onSort('name', 'asc')}>A–Z{sort === 'name' ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}</button>
        </div>
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter date:</span>
          <label className="sr-only" htmlFor="admin-user-date-from">From date</label>
          <input className="admin-date-filter" id="admin-user-date-from" type="date" value={dateFrom} onChange={(event) => onDateChange('dateFrom', event.target.value)}/>
          <label className="sr-only" htmlFor="admin-user-date-to">To date</label>
          <input className="admin-date-filter" id="admin-user-date-to" type="date" value={dateTo} onChange={(event) => onDateChange('dateTo', event.target.value)}/>
        </div>
      </div>

      {state.kind === 'loading' && <p className="admin-user-state" role="status">Loading users…</p>}
      {state.kind === 'error' && (
        <div className="admin-user-state" role="alert">
          <p>{errorMessage(state.error)}</p>
          <button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button>
        </div>
      )}
      {state.kind === 'empty' && <p className="admin-user-state" role="status">No users found.</p>}
      {state.kind === 'ready' && (
        <>
          <div className="admin-table-wrap admin-user-table-wrap">
            <table>
              <caption className="sr-only">Users</caption>
              <thead><tr><th scope="col">User name</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col">Action</th></tr></thead>
              <tbody>{state.users.map((user) => (
                <tr key={user.id}>
                  <td>{displayAdminUserValue(user.username)}</td>
                  <td>{displayAdminUserValue(user.email)}</td>
                  <td><span className="admin-unavailable-value">{ADMIN_USER_UNAVAILABLE}</span></td>
                  <td>{formatAdminUserDate(user.created_at)}</td>
                  <td><a className="admin-consult-link" href={`/admin/users/${encodeURIComponent(String(user.id))}`}>Consult <span aria-hidden="true">→</span></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="admin-parcel-pagination" aria-label="User pagination">
            <span>{state.pagination.total} users</span>
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

export function AdminUserListPage({ request }) {
  const [initialDateFilters] = useState(() => readAdminUserDateFilters(globalThis.location?.search || ''))
  const [page, setPage] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [direction, setDirection] = useState('desc')
  const [dateFrom, setDateFrom] = useState(initialDateFilters.dateFrom)
  const [dateTo, setDateTo] = useState(initialDateFilters.dateTo)
  const [retry, setRetry] = useState(0)
  const [resource, setResource] = useState(null)
  const queryKey = JSON.stringify([page, search, sort, direction, dateFrom, dateTo, retry])

  useEffect(() => {
    let current = true
    const query = buildAdminUserListQuery({ page, perPage: PAGE_SIZE, search, sort, direction, dateFrom, dateTo })
    loadAdminUsers(request, query)
      .then((result) => { if (current) setResource({ queryKey, result, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, result: null, error }) })
    return () => { current = false }
  }, [request, queryKey, page, search, sort, direction, dateFrom, dateTo])

  const currentResource = resource?.queryKey === queryKey ? resource : null
  const state = adminUserListViewState({ loading: !currentResource, error: currentResource?.error, result: currentResource?.result })

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

  return <AdminUserListView
    state={state} onRetry={() => setRetry((value) => value + 1)} onPageChange={setPage}
    onSort={chooseSort} sort={sort} direction={direction} search={searchDraft}
    onSearchChange={setSearchDraft} onSearch={submitSearch} dateFrom={dateFrom} dateTo={dateTo}
    onDateChange={changeDate}
  />
}

function unavailableField(label, value = ADMIN_USER_UNAVAILABLE) {
  return [label, value]
}

function AdminUserDetailView({ state, onRetry, onPageChange = () => {} }) {
  if (state.kind === 'loading') return <section className="admin-page-panel" role="status">Loading user…</section>
  if (state.kind === 'error' || state.kind === 'notFound') {
    const missing = state.kind === 'notFound'
    return (
      <section className="admin-page-panel admin-user-detail-message" aria-labelledby="admin-user-detail-message-title">
        <a className="admin-inline-link" href="/admin/users">← Back to users</a>
        <h1 id="admin-user-detail-message-title">{missing ? 'User not found' : 'User detail unavailable'}</h1>
        {!missing && <><p role="alert">{errorMessage(state.error)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button></>}
      </section>
    )
  }

  const user = state.user
  const initial = getAdminUserInitial(user)
  const association = user.parcel_association
  const associationAvailable = association?.available === true
  const effectiveOffer = user.effective_offer
  const effectivePlan = effectiveOffer?.code === 'pro' ? 'Pro' : effectiveOffer?.code === 'free' ? 'Free' : ADMIN_USER_UNAVAILABLE
  const fields = [
    ['Full name', displayAdminUserValue(user.name)],
    ['User name', displayAdminUserValue(user.username)],
    ['Email', displayAdminUserValue(user.email)],
    ['Contact', displayAdminUserValue(user.mobile)],
    ['Effective offer', effectivePlan],
    ['Parcel limit', effectiveOffer ? String(effectiveOffer.parcel_limit) : ADMIN_USER_UNAVAILABLE],
    ['Can delete own parcels', effectiveOffer ? (effectiveOffer.can_delete_owned_parcels ? 'Yes' : 'No') : ADMIN_USER_UNAVAILABLE],
    unavailableField('Status'),
  ]

  return (
    <div className="admin-detail-stack">
      <a className="admin-inline-link" href="/admin/users">← Back to users</a>
      <div className="admin-user-detail-grid">
        <section className="admin-detail-panel admin-user-summary" aria-labelledby="admin-user-summary-title">
          <span className="admin-user-profile-mark" aria-hidden="true">{initial}</span>
          <h1 id="admin-user-summary-title">{displayAdminUserValue(user.name)}</h1>
          <p className="admin-user-role-label">User</p>
          <p className="admin-user-recorded-status">{ADMIN_USER_UNAVAILABLE}</p>
          <hr/>
          <p className="admin-user-summary-line">Registered on {formatAdminUserDate(user.created_at)}</p>
          <p className="admin-user-summary-line">Last activity: {ADMIN_USER_UNAVAILABLE}</p>
          <hr/>
          <p className="admin-user-summary-line">Parcelles associées à l’email actuel (provisoire) : {associationAvailable ? association.total_associated : 'Association indisponible'}</p>
        </section>
        <div className="admin-user-detail-column">
          <section className="admin-detail-panel admin-user-information" aria-labelledby="admin-user-information-title">
            <h1 id="admin-user-information-title">Personal information</h1>
            <dl className="admin-detail-fields">{fields.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}</dl>
            <p className="admin-user-plan-note">Resolved from current subscriptions. This does not establish payment status.</p>
          </section>
          <section className="admin-detail-panel admin-detail-table-panel" aria-labelledby="admin-user-parcels-title">
            <h2 id="admin-user-parcels-title">Parcelles associées à l’email actuel (provisoire)</h2>
            <p className="admin-user-parcel-count">Annonces à vendre : {associationAvailable ? association.for_sale_count : 'Association indisponible'}</p>
            {!associationAvailable && <p className="admin-user-state" role="status">Association indisponible</p>}
            {associationAvailable && association.total_associated === 0 && (
              <p className="admin-user-state" role="status">Aucune parcelle associée à l’email actuel.</p>
            )}
            {associationAvailable && association.total_associated > 0 && association.data.length === 0 && (
              <p className="admin-user-state" role="status">Aucune parcelle sur cette page.</p>
            )}
            {associationAvailable && association.data.length > 0 && (
              <>
                <div className="admin-table-wrap">
                  <table>
                    <caption className="sr-only">Parcelles associées à l’email actuel, correspondance provisoire</caption>
                    <thead><tr><th scope="col">Parcelle</th><th scope="col">Lieu</th><th scope="col">Catégorie</th><th scope="col">Action</th></tr></thead>
                    <tbody>{association.data.map((parcel) => (
                      <tr key={parcel.id}>
                        <td>{displayAdminUserValue(parcel.parcel_name)}</td>
                        <td>{displayAdminUserValue(parcel.location_name)}</td>
                        <td>{displayAdminUserValue(parcel.sell_category)}</td>
                        <td><a className="admin-consult-link" href={`/admin/parcels/${encodeURIComponent(parcel.id)}`}>Consulter <span aria-hidden="true">→</span></a></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {association.pagination.pages > 1 && (
                  <div className="admin-parcel-pagination" aria-label="Pagination des parcelles associées">
                    <span>{association.pagination.total} parcelles associées</span>
                    <div>
                      <button type="button" onClick={() => onPageChange(association.pagination.page - 1)} disabled={association.pagination.page <= 1}>Précédent</button>
                      <span aria-live="polite">Page {association.pagination.page} sur {association.pagination.pages}</span>
                      <button type="button" onClick={() => onPageChange(association.pagination.page + 1)} disabled={association.pagination.page >= association.pagination.pages}>Suivant</button>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="admin-user-plan-note">Cette correspondance utilise l’email actuel et ne prouve pas la propriété historique des parcelles.</p>
          </section>
          <div className="admin-disabled-actions" aria-label="User actions unavailable until the admin API is available">
            <button type="button" disabled>Suspend</button>
            <button type="button" disabled>Ban</button>
            <button type="button" disabled>Change subscription</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminUserDetailPage({ request, id }) {
  const [retry, setRetry] = useState(0)
  const [pageState, setPageState] = useState({ id, page: 1 })
  const [resource, setResource] = useState(null)
  const page = pageState.id === id ? pageState.page : 1
  const queryKey = `${id}:${page}:${retry}`

  useEffect(() => {
    let current = true
    loadAdminUser(request, id, { page, per_page: PAGE_SIZE })
      .then((user) => { if (current) setResource({ queryKey, user, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, user: null, error }) })
    return () => { current = false }
  }, [request, id, page, queryKey])

  const currentResource = resource?.queryKey === queryKey ? resource : null
  const state = adminUserDetailViewState({ loading: !currentResource, error: currentResource?.error, user: currentResource?.user })
  return <AdminUserDetailView
    state={state}
    onRetry={() => setRetry((value) => value + 1)}
    onPageChange={(nextPage) => setPageState({ id, page: nextPage })}
  />
}

export { AdminUserDetailView, AdminUserListView }
