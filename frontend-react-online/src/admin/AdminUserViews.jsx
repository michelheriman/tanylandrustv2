import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { loadAdminUser, loadAdminUsers } from './adminApi.js'
import { adminText } from './adminTranslations.js'
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

function errorMessage(error, language = 'en') {
  return apiErrorMessage(error, language) || adminText(language, 'Could not load user data. Please try again.')
}

function AdminUserListView({ state, onRetry, onPageChange, onSort, sort, direction, search, onSearchChange, onSearch, dateFrom, dateTo, onDateChange, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <section className="admin-page-panel admin-list-panel" aria-labelledby="admin-user-list-title">
      <h1 id="admin-user-list-title">{t('Users')}</h1>
      {(dateFrom || dateTo) && <p className="admin-metric-filter-note">{t('Profiles still present with created_at in the selected UTC date range (inclusive).')}</p>}
      <div className="admin-list-toolbar admin-user-toolbar">
        <form className="admin-filter-row admin-search-row" role="search" onSubmit={onSearch}>
          <label className="sr-only" htmlFor="admin-user-search">{t('Search users')}</label>
          <input id="admin-user-search" type="search" placeholder={t('Search name, username, email, contact or ID')} value={search} onChange={(event) => onSearchChange(event.target.value)}/>
          <button className="admin-filter-pill admin-search-button" type="submit">{t('Search')}</button>
        </form>
        <div className="admin-filter-row" aria-label={t('Sort users')}>
          <span className="admin-filter-label">{t('Sorting:')}</span>
          <button className="admin-filter-pill" type="button" disabled aria-disabled="true" title={t('Status data is unavailable')}>{t('Status')}</button>
          <button className="admin-filter-pill" type="button" aria-pressed={sort === 'date'} onClick={() => onSort('date', 'desc')}>{t('Date')}{sort === 'date' ? (direction === 'asc' ? ' \u2191' : ' \u2193') : ''}</button>
          <button className="admin-filter-pill" type="button" aria-pressed={sort === 'name'} onClick={() => onSort('name', 'asc')}>{t('A-Z')}{sort === 'name' ? (direction === 'asc' ? ' \u2191' : ' \u2193') : ''}</button>
        </div>
        <div className="admin-filter-row">
          <span className="admin-filter-label">{t('Filter date:')}</span>
          <label className="sr-only" htmlFor="admin-user-date-from">{t('From date')}</label>
          <input className="admin-date-filter" id="admin-user-date-from" type="date" value={dateFrom} onChange={(event) => onDateChange('dateFrom', event.target.value)}/>
          <label className="sr-only" htmlFor="admin-user-date-to">{t('To date')}</label>
          <input className="admin-date-filter" id="admin-user-date-to" type="date" value={dateTo} onChange={(event) => onDateChange('dateTo', event.target.value)}/>
        </div>
      </div>

      {state.kind === 'loading' && <p className="admin-user-state" role="status">{t('Loading users...')}</p>}
      {state.kind === 'error' && (
        <div className="admin-user-state" role="alert">
          <p>{errorMessage(state.error, lang)}</p>
          <button className="admin-retry-button" type="button" onClick={onRetry}>{t('Retry')}</button>
        </div>
      )}
      {state.kind === 'empty' && <p className="admin-user-state" role="status">{t('No users found.')}</p>}
      {state.kind === 'ready' && (
        <>
          <div className="admin-table-wrap admin-user-table-wrap">
            <table>
              <caption className="sr-only">{t('Users')}</caption>
              <thead><tr><th scope="col">{t('User name')}</th><th scope="col">{t('Email')}</th><th scope="col">{t('Status')}</th><th scope="col">{t('Date')}</th><th scope="col">{t('Action')}</th></tr></thead>
              <tbody>{state.users.map((user) => (
                <tr key={user.id}>
                  <td>{displayAdminUserValue(user.username)}</td>
                  <td>{displayAdminUserValue(user.email)}</td>
                  <td><span className="admin-unavailable-value">{t('Unavailable')}</span></td>
                  <td>{formatAdminUserDate(user.created_at, lang === 'fr' ? 'fr-FR' : 'en-GB')}</td>
                  <td><a className="admin-consult-link" href={`/admin/users/${encodeURIComponent(String(user.id))}`}>{t('Consult')} <span aria-hidden="true">→</span></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="admin-parcel-pagination" aria-label={t('User pagination')}>
            <span>{state.pagination.total} {t('users')}</span>
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

export function AdminUserListPage({ request, lang = 'en' }) {
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
    onDateChange={changeDate} lang={lang}
  />
}

function unavailableField(label, value = ADMIN_USER_UNAVAILABLE) {
  return [label, value]
}

function AdminUserDetailView({ state, onRetry, onPageChange = () => {}, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  const value = (item) => item === ADMIN_USER_UNAVAILABLE ? t('Unavailable') : displayAdminUserValue(item)
  if (state.kind === 'loading') return <section className="admin-page-panel" role="status">{t('Loading user...')}</section>
  if (state.kind === 'error' || state.kind === 'notFound') {
    const missing = state.kind === 'notFound'
    return (
      <section className="admin-page-panel admin-user-detail-message" aria-labelledby="admin-user-detail-message-title">
        <a className="admin-inline-link" href="/admin/users">← {t('Back to users')}</a>
        <h1 id="admin-user-detail-message-title">{missing ? t('User not found') : t('User detail unavailable')}</h1>
        {!missing && <><p role="alert">{errorMessage(state.error, lang)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>{t('Retry')}</button></>}
      </section>
    )
  }

  const user = state.user
  const initial = getAdminUserInitial(user)
  const association = user.parcel_association
  const associationAvailable = association?.available === true
  const effectiveOffer = user.effective_offer
  const effectivePlan = effectiveOffer?.code === 'pro' ? 'Pro' : effectiveOffer?.code === 'free' ? 'Free' : t('Unavailable')
  const fields = [
    [t('Full name'), value(user.name)],
    [t('User name'), value(user.username)],
    [t('Email'), value(user.email)],
    [t('Contact'), value(user.mobile)],
    [t('Effective offer'), effectivePlan],
    [t('Parcel limit'), effectiveOffer ? String(effectiveOffer.parcel_limit) : t('Unavailable')],
    [t('Can delete own parcels'), effectiveOffer ? (effectiveOffer.can_delete_owned_parcels ? t('Yes') : t('No')) : t('Unavailable')],
    unavailableField(t('Status'), t('Unavailable')),
  ]

  return (
    <div className="admin-detail-stack">
      <a className="admin-inline-link" href="/admin/users">← {t('Back to users')}</a>
      <div className="admin-user-detail-grid">
        <section className="admin-detail-panel admin-user-summary" aria-labelledby="admin-user-summary-title">
          <span className="admin-user-profile-mark" aria-hidden="true">{initial}</span>
          <h1 id="admin-user-summary-title">{value(user.name)}</h1>
          <p className="admin-user-role-label">{t('User role')}</p>
          <p className="admin-user-recorded-status">{t('Unavailable')}</p>
          <hr/>
          <p className="admin-user-summary-line">{t('Registered on')} {formatAdminUserDate(user.created_at, lang === 'fr' ? 'fr-FR' : 'en-GB')}</p>
          <p className="admin-user-summary-line">{t('Last activity:')} {t('Unavailable')}</p>
          <hr/>
          <p className="admin-user-summary-line">{t('Parcels associated with the current email (provisional)')}: {associationAvailable ? association.total_associated : t('Association unavailable')}</p>
        </section>
        <div className="admin-user-detail-column">
          <section className="admin-detail-panel admin-user-information" aria-labelledby="admin-user-information-title">
            <h1 id="admin-user-information-title">{t('Personal information')}</h1>
            <dl className="admin-detail-fields">{fields.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}</dl>
          <p className="admin-user-plan-note">{t('Resolved from current subscriptions. This does not establish payment status.')}</p>
          </section>
          <section className="admin-detail-panel admin-detail-table-panel" aria-labelledby="admin-user-parcels-title">
            <h2 id="admin-user-parcels-title">{t('Parcels associated with the current email (provisional)')}</h2>
            <p className="admin-user-parcel-count">{t('Listings for sale:')} {associationAvailable ? association.for_sale_count : t('Association unavailable')}</p>
            {!associationAvailable && <p className="admin-user-state" role="status">{t('Association unavailable')}</p>}
            {associationAvailable && association.total_associated === 0 && (
              <p className="admin-user-state" role="status">{t('No parcels associated with the current email.')}</p>
            )}
            {associationAvailable && association.total_associated > 0 && association.data.length === 0 && (
              <p className="admin-user-state" role="status">{t('No parcels on this page.')}</p>
            )}
            {associationAvailable && association.data.length > 0 && (
              <>
                <div className="admin-table-wrap">
                  <table>
                    <caption className="sr-only">{t('Parcels associated with the current email (provisional)')}</caption>
                    <thead><tr><th scope="col">{t('Parcel')}</th><th scope="col">{t('Location')}</th><th scope="col">{t('Category')}</th><th scope="col">{t('Action')}</th></tr></thead>
                    <tbody>{association.data.map((parcel) => (
                      <tr key={parcel.id}>
                        <td>{value(parcel.parcel_name)}</td>
                        <td>{value(parcel.location_name)}</td>
                        <td>{value(parcel.sell_category)}</td>
                        <td><a className="admin-consult-link" href={`/admin/parcels/${encodeURIComponent(parcel.id)}`}>{t('Consult')} <span aria-hidden="true">→</span></a></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {association.pagination.pages > 1 && (
                  <div className="admin-parcel-pagination" aria-label={t('Associated parcel pagination')}>
                    <span>{association.pagination.total} {t('associated parcels')}</span>
                    <div>
                      <button type="button" onClick={() => onPageChange(association.pagination.page - 1)} disabled={association.pagination.page <= 1}>{t('Previous')}</button>
                      <span aria-live="polite">{t('Page')} {association.pagination.page} {t('of')} {association.pagination.pages}</span>
                      <button type="button" onClick={() => onPageChange(association.pagination.page + 1)} disabled={association.pagination.page >= association.pagination.pages}>{t('Next')}</button>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="admin-user-plan-note">{t('This current-email match does not prove historical parcel ownership.')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export function AdminUserDetailPage({ request, id, lang = 'en' }) {
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
    lang={lang}
  />
}

export { AdminUserDetailView, AdminUserListView }
