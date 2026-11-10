import { useEffect, useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { isLocalBackendConfigured } from '../api/backendMode.js'
import { useAuth } from '../auth/useAuth.js'
import { ADMIN_NAV_ITEMS, getAdminSignInHref } from './adminRoutes.js'
import { getAdminFailureKind, loadAdminIdentity } from './adminApi.js'
import { createAdminReadRequest } from './adminReadRequest.js'
import { getAdminNavigationTarget, shouldHandleAdminLinkClick } from './adminNavigation.js'
import { AdminConversationDetailPage, AdminConversationListPage, AdminConversationReportsPage } from './AdminConversationViews.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import { AdminParcelDetailPage, AdminParcelListPage } from './AdminParcelViews.jsx'
import { AdminUserDetailPage, AdminUserListPage } from './AdminUserViews.jsx'
import { AdminAssistanceDetailPage, AdminAssistanceListPage } from './AdminAssistanceViews.jsx'
import { getAdminPageModel } from './adminViewModel.js'
import { readLanguage, writeLanguage } from '../languageStorage.js'
import { adminText } from './adminTranslations.js'
import './Admin.css'

function AdminGlyph({ section }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const shapes = {
    parcels: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.4 7.6 7.6 4.3 7.6-4.3M12 12v9"/></>,
    conversations: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></>,
    assistance: <><path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 4.2 3.3 7.5 7.5 7.5h1.5l3.5 2v-3.5A7.5 7.5 0 0 0 12 3Z"/><path d="M9 10h6M9 13h4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h1M15 14l2 2 4-4"/></>,
    dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="4" rx="1"/><rect x="13.5" y="9.5" width="7" height="11" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1 1.7-1.8 3.1-2-.5a7 7 0 0 1-1.6.9l-.5 2h-3.6l-.5-2a7 7 0 0 1-1.6-.9l-2 .5-1.8-3.1 1-1.7a7 7 0 0 1 0-1.9l-1-1.7 1.8-3.1 2 .5a7 7 0 0 1 1.6-.9l.5-2h3.6l.5 2a7 7 0 0 1 1.6.9l2-.5 1.8 3.1-1 1.7a7 7 0 0 1-.1 1.9Z" transform="translate(-1 -1) scale(.92)"/></>,
    account: <><circle cx="12" cy="8" r="3"/><path d="M5 20v-1.5A5.5 5.5 0 0 1 10.5 13h3A5.5 5.5 0 0 1 19 18.5V20"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>{shapes[section] ?? shapes.account}</svg>
}

function AdminMark({ large = false }) {
  return <span className={large ? 'admin-brand-mark admin-brand-mark-large' : 'admin-brand-mark'} aria-hidden="true">T</span>
}

function AdminAccessScreen({ pathname, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <main className="admin-access" aria-labelledby="admin-access-title">
      <section className="admin-access-card">
        <div className="admin-access-intro">
          <a className="admin-access-brand" href="/" aria-label={lang === 'fr' ? 'Tany, accueil' : 'Tany, home'}>tany <em>LandTrust</em></a>
          <div className="admin-login-emblem" aria-hidden="true">
            <AdminGlyph section="account"/>
            <span>{t('Admin')}</span>
          </div>
        </div>
        <div className="admin-access-form">
          <p className="admin-eyebrow">{t('Tany LandTrust')}</p>
          <h1 id="admin-access-title">{t('Login')}</h1>
          <p className="admin-access-copy">{t('Sign in with your Tany account. The server will verify your administrator access before opening this space.')}</p>
          <a className="admin-primary-link" href={getAdminSignInHref(pathname)}>{t('Sign in')}</a>
          <a className="admin-secondary-link" href="/">{t('Return to Tany')}</a>
        </div>
      </section>
    </main>
  )
}

function AccessDenied({ onLogout, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <main className="admin-access" aria-labelledby="admin-denied-title">
      <section className="admin-access-card admin-access-card-state" role="alert">
        <div className="admin-access-intro">
          <a className="admin-access-brand" href="/" aria-label={lang === 'fr' ? 'Tany, accueil' : 'Tany, home'}>tany <em>LandTrust</em></a>
          <div className="admin-login-emblem" aria-hidden="true"><AdminGlyph section="account"/><span>{t('Admin')}</span></div>
        </div>
        <div className="admin-access-form">
          <p className="admin-eyebrow">{t('Server-verified access')}</p>
          <h1 id="admin-denied-title">{t('Access denied')}</h1>
          <p className="admin-access-copy">{t('This account does not have active administrator access.')}</p>
          <button className="admin-primary-button" type="button" onClick={() => void onLogout()}>{t('Change account')}</button>
          <a className="admin-secondary-link" href="/main">{t('Return to Tany')}</a>
        </div>
      </section>
    </main>
  )
}

function VerificationStatus({ children, title = 'Checking access', lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <main className="admin-verification" role="status" aria-live="polite">
      <section className="admin-verification-card">
        <AdminMark large/>
        <p className="admin-eyebrow">{t('Administrator space')}</p>
        <h1>{t(title)}</h1>
        {children}
      </section>
    </main>
  )
}

function AdminWorkspaceStatus({ state, error, onRetry, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  if (state === 'unavailable') {
    const language = document.documentElement.lang
    return (
      <section className="admin-page-panel admin-workspace-status" role="alert" aria-labelledby="admin-workspace-status-title">
        <h1 id="admin-workspace-status-title">{t('Verification unavailable')}</h1>
        <p>{apiErrorMessage(error, language) || t('Administrator access could not be verified.')}</p>
        <button className="admin-primary-button" type="button" onClick={onRetry}>{t('Retry')}</button>
      </section>
    )
  }

  const title = state === 'restoring' ? 'Checking your session' : 'Checking administrator access...'
  return (
    <section className="admin-page-panel admin-workspace-status" role="status" aria-live="polite" aria-labelledby="admin-workspace-status-title">
      <h1 id="admin-workspace-status-title">{t(title)}</h1>
      <div className="admin-workspace-skeleton" aria-hidden="true"><span/><span/><span/></div>
    </section>
  )
}

function AdminSidebar({ activeSection, onLogout, localBackend, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/admin/dashboard">tany <em>LandTrust</em></a>
      <nav aria-label={lang === 'fr' ? 'Navigation administrateur' : 'Administrator navigation'} className={`admin-navigation${localBackend ? ' has-local-assistance' : ''}`}>
        {ADMIN_NAV_ITEMS.filter((item) => !item.localOnly || localBackend).map((item) => {
          const active = activeSection === item.section
          return (
            <a key={item.section} className={active ? 'admin-nav-link is-active' : 'admin-nav-link'} href={item.href} aria-current={active ? 'page' : undefined}>
              <AdminGlyph section={item.section}/><span>{adminText(lang, item.label)}</span>
            </a>
          )
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <button className="admin-sidebar-action" type="button" disabled aria-label={t('Settings unavailable until the admin API is available')}>
          <AdminGlyph section="settings"/><span>{t('Settings')}</span>
        </button>
        <button className="admin-sidebar-action" type="button" onClick={() => void onLogout()}>
          <AdminGlyph section="logout"/><span>{t('Log out')}</span>
        </button>
      </div>
    </aside>
  )
}

function AdminEmptyState({ children }) {
  return <p className="admin-data-unavailable">{children}</p>
}

function AdminListToolbar({ includeDates, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  return (
    <div className="admin-list-toolbar" aria-label={lang === 'fr' ? 'Filtres de liste indisponibles' : 'List filters unavailable'}>
      <div className="admin-filter-row admin-search-row">
        <label className="sr-only" htmlFor="admin-search">{t('Search')}</label>
        <input id="admin-search" type="search" placeholder={t('Search')} disabled/>
        <button className="admin-filter-pill admin-search-button" type="button" disabled aria-label={lang === 'fr' ? 'Recherche indisponible' : 'Search unavailable'}/>
      </div>
      <div className="admin-filter-row">
        <span className="admin-filter-label">{t('Sorting:')}</span>
        <button className="admin-filter-pill" type="button" disabled>{t('Status')}</button>
        <button className="admin-filter-pill" type="button" disabled>{t('Date')}</button>
        <button className="admin-filter-pill" type="button" disabled>{t('A–Z')}</button>
      </div>
      {includeDates && (
        <div className="admin-filter-row">
          <span className="admin-filter-label">{t('Filter:')}</span>
          <label className="sr-only" htmlFor="admin-start-date">{t('Start date')}</label>
          <input className="admin-date-filter" id="admin-start-date" type="date" disabled/>
          <label className="sr-only" htmlFor="admin-end-date">{t('End date')}</label>
          <input className="admin-date-filter" id="admin-end-date" type="date" disabled/>
        </div>
      )}
    </div>
  )
}

function AdminList({ model, lang = 'en' }) {
  return (
    <section className="admin-page-panel admin-list-panel" aria-labelledby="admin-list-title">
      <h1 id="admin-list-title">{adminText(lang, model.title)}</h1>
      <AdminListToolbar includeDates={model.filters} lang={lang}/>
      <div className="admin-table-wrap">
        <table>
          <caption className="sr-only">{adminText(lang, model.title)}</caption>
          <thead><tr>{model.columns.map((column) => <th key={column} scope="col">{adminText(lang, column)}</th>)}</tr></thead>
          <tbody><tr className="admin-empty-row"><td colSpan={model.columns.length}><AdminEmptyState>{adminText(lang, model.unavailableMessage)}</AdminEmptyState></td></tr></tbody>
        </table>
      </div>
    </section>
  )
}

function AdminDetail({ model, lang = 'en' }) {
  return (
    <div className="admin-detail-stack">
      <a className="admin-inline-link" href={model.backHref}>← {adminText(lang, 'Back to list')}</a>
      <div className="admin-disabled-actions" aria-label={adminText(lang, 'Actions unavailable until the admin API is available')}>
        {model.actions.map((action) => <button key={action} type="button" disabled>{adminText(lang, action)}</button>)}
      </div>
    </div>
  )
}

function AdminPageContent({ route, request, currentAdminProfileId, lang = 'en' }) {
  if (route.section === 'assistance') {
    if (route.view === 'list') return <AdminAssistanceListPage request={request} lang={lang}/>
    if (route.view === 'detail') return <AdminAssistanceDetailPage request={request} id={route.id} currentAdminProfileId={currentAdminProfileId} lang={lang}/>
  }
  const model = getAdminPageModel(route)

  if (model.kind === 'notFound') {
    return <section className="admin-page-panel admin-not-found"><h1>{adminText(lang, model.title)}</h1><a className="admin-inline-link" href="/admin/dashboard">{adminText(lang, 'Return to dashboard')}</a></section>
  }
  if (model.kind === 'dashboard') return <AdminDashboard model={model} request={request} lang={lang}/>
  if (route.section === 'parcels' && model.kind === 'list') return <AdminParcelListPage request={request} lang={lang}/>
  if (route.section === 'parcels' && model.kind === 'detail') return <AdminParcelDetailPage request={request} id={route.id} lang={lang}/>
  if (route.section === 'users' && model.kind === 'list') return <AdminUserListPage request={request} lang={lang}/>
  if (route.section === 'users' && model.kind === 'detail') return <AdminUserDetailPage request={request} id={route.id} lang={lang}/>
  if (route.section === 'conversations' && model.kind === 'list') return <AdminConversationListPage request={request} lang={lang}/>
  if (route.section === 'conversations' && model.kind === 'reports') return <AdminConversationReportsPage request={request} lang={lang}/>
  if (route.section === 'conversations' && model.kind === 'detail') return <AdminConversationDetailPage key={route.id} request={request} id={route.id} lang={lang}/>
  if (model.kind === 'list') return <AdminList model={model} lang={lang}/>
  return <AdminDetail model={model} lang={lang}/>
}

export function AdminLanguagePicker({ lang, onChange }) {
  const detailsRef = useRef(null)
  return <details className="admin-language-menu" ref={detailsRef}>
    <summary aria-label={lang === 'fr' ? 'Changer de langue, français sélectionné' : 'Change language, English selected'}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
      <span>{lang.toUpperCase()}</span><i aria-hidden="true"/>
    </summary>
    <div className="admin-language-options" role="group" aria-label={lang === 'fr' ? 'Choisir la langue' : 'Choose language'}>
      {['en', 'fr'].map((language) => <button key={language} type="button" lang={language} aria-pressed={lang === language} onClick={() => { onChange(language); if (detailsRef.current) detailsRef.current.open = false }}>{language.toUpperCase()}</button>)}
    </div>
  </details>
}

function AdminWorkspace({ route, onLogout, request, localBackend, currentAdminProfileId, sessionRevision, authStatus, verificationState, verificationError, onRetryVerification, onNavigate, lang, onLanguageChange }) {
  function handleAdminNavigation(event) {
    if (!shouldHandleAdminLinkClick(event)) return
    const anchor = event.target?.closest?.('a[href]')
    if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return
    const target = getAdminNavigationTarget(anchor.href, window.location.origin)
    if (!target) return

    event.preventDefault()
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (target.href === currentHref) return
    window.history.pushState({}, '', target.href)
    onNavigate(target.route)
  }

  const canShowAdminPage = verificationState === 'verified'
  const shouldMountAdminPage = authStatus === 'authenticated' && verificationState !== 'denied'
  return (
    <div className="admin-app" onClick={handleAdminNavigation}>
      <div className="admin-shell">
        <AdminSidebar activeSection={route.section} onLogout={onLogout} localBackend={localBackend} lang={lang}/>
        <main className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-controls"><AdminLanguagePicker lang={lang} onChange={onLanguageChange}/><div className="admin-account-controls"><span className="admin-account-avatar"><AdminGlyph section="account"/></span><span className="admin-role-label">{adminText(lang, 'Admin')}</span></div></div>
          </header>
          <div className="admin-page-content">
            {shouldMountAdminPage && (
              <div hidden={!canShowAdminPage} aria-hidden={!canShowAdminPage}>
                <AdminPageContent key={`${route.navigationHref || route.href}:${sessionRevision}`} route={route} request={request} currentAdminProfileId={currentAdminProfileId} lang={lang}/>
              </div>
            )}
            {!canShowAdminPage && <AdminWorkspaceStatus
              state={authStatus === 'restoring' ? 'restoring' : verificationState}
              error={verificationError}
              onRetry={onRetryVerification}
              lang={lang}
            />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function AdminApp({ route }) {
  const { status, request, logout, user, adminBootstrap } = useAuth()
  const localBackend = isLocalBackendConfigured()
  const [lang, setLang] = useState(readLanguage)
  const adminRequest = useMemo(() => createAdminReadRequest(request, user?.id ?? null), [request, user?.id])
  const [verification, setVerification] = useState({ state: 'idle', identity: null, error: null, user: null, attempt: -1 })
  const [attempt, setAttempt] = useState(0)
  const [activeRoute, setActiveRoute] = useState(() => ({
    ...route,
    navigationHref: `${window.location.pathname}${window.location.search}${window.location.hash}`,
  }))
  const [sessionRevision, setSessionRevision] = useState(0)
  const sessionRef = useRef({ status, user, adminRequest })

  useEffect(() => {
    writeLanguage(lang)
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const previous = sessionRef.current
    if (previous.status !== status || previous.user !== user) {
      previous.adminRequest.clearInflight()
      setVerification({ state: 'idle', identity: null, error: null, user: null, attempt: -1 })
      setSessionRevision((revision) => revision + 1)
    }
    sessionRef.current = { status, user, adminRequest }
  }, [status, user, adminRequest])

  useEffect(() => {
    const syncRoute = () => {
      const target = getAdminNavigationTarget(window.location.href, window.location.origin)
      if (target) setActiveRoute(target.route)
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  useEffect(() => {
    let active = true
    if (status !== 'authenticated') return () => { active = false }

    const requestUser = user
    const requestAttempt = attempt
    if (adminBootstrap?.userId === requestUser?.id) return () => { active = false }

    loadAdminIdentity(adminRequest)
      .then((identity) => { if (active) setVerification({ state: 'verified', identity, error: null, user: requestUser, attempt: requestAttempt }) })
      .catch((error) => {
        if (active) setVerification({ state: getAdminFailureKind(error), identity: null, error, user: requestUser, attempt: requestAttempt })
      })

    return () => { active = false }
  }, [status, adminRequest, user, attempt, adminBootstrap])

  const currentVerification = status === 'authenticated' && adminBootstrap?.userId === user?.id
    ? { state: adminBootstrap.state, identity: adminBootstrap.identity, error: null }
    : verification.user === user && verification.attempt === attempt
      ? verification
      : { state: 'checking', identity: null, error: null }

  if (status === 'anonymous') return <AdminAccessScreen pathname={route.href} lang={lang}/>
  if (status === 'signingOut') {
    return <VerificationStatus title="Checking your session" lang={lang}>{adminText(lang, 'Loading...')}</VerificationStatus>
  }
  if (currentVerification.state === 'denied') return <AccessDenied onLogout={logout} lang={lang}/>
  if (currentVerification.state === 'anonymous') return <AdminAccessScreen pathname={route.href} lang={lang}/>

  return <AdminWorkspace
    route={activeRoute}
    onNavigate={setActiveRoute}
    onLogout={logout}
    request={adminRequest}
    localBackend={localBackend}
    currentAdminProfileId={currentVerification.identity?.profile?.id}
    sessionRevision={sessionRevision}
    authStatus={status}
    verificationState={currentVerification.state}
    verificationError={currentVerification.error}
    onRetryVerification={() => setAttempt((value) => value + 1)}
    lang={lang}
    onLanguageChange={setLang}
  />
}
