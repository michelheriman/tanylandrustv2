import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { isLocalBackendConfigured } from '../api/backendMode.js'
import { useAuth } from '../auth/useAuth.js'
import { ADMIN_NAV_ITEMS, getAdminSignInHref } from './adminRoutes.js'
import { getAdminFailureKind, loadAdminIdentity } from './adminApi.js'
import { AdminConversationDetailPage, AdminConversationListPage, AdminConversationReportsPage } from './AdminConversationViews.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import { AdminParcelDetailPage, AdminParcelListPage } from './AdminParcelViews.jsx'
import { AdminUserDetailPage, AdminUserListPage } from './AdminUserViews.jsx'
import { getAdminPageModel } from './adminViewModel.js'
import './Admin.css'

function AdminGlyph({ section }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const shapes = {
    parcels: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.4 7.6 7.6 4.3 7.6-4.3M12 12v9"/></>,
    conversations: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></>,
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

function AdminAccessScreen({ pathname }) {
  return (
    <main className="admin-access" aria-labelledby="admin-access-title">
      <section className="admin-access-card">
        <div className="admin-access-intro">
          <a className="admin-access-brand" href="/" aria-label="Tany, home">tany <em>LandTrust</em></a>
          <div className="admin-login-emblem" aria-hidden="true">
            <AdminGlyph section="account"/>
            <span>Admin</span>
          </div>
        </div>
        <div className="admin-access-form">
          <p className="admin-eyebrow">Tany LandTrust</p>
          <h1 id="admin-access-title">Login</h1>
          <p className="admin-access-copy">Sign in with your Tany account. The server will verify your administrator access before opening this space.</p>
          <a className="admin-primary-link" href={getAdminSignInHref(pathname)}>Sign in</a>
          <a className="admin-secondary-link" href="/">Return to Tany</a>
        </div>
      </section>
    </main>
  )
}

function AccessDenied({ onLogout }) {
  return (
    <main className="admin-access" aria-labelledby="admin-denied-title">
      <section className="admin-access-card admin-access-card-state" role="alert">
        <div className="admin-access-intro">
          <a className="admin-access-brand" href="/" aria-label="Tany, home">tany <em>LandTrust</em></a>
          <div className="admin-login-emblem" aria-hidden="true"><AdminGlyph section="account"/><span>Admin</span></div>
        </div>
        <div className="admin-access-form">
          <p className="admin-eyebrow">Server-verified access</p>
          <h1 id="admin-denied-title">Access denied</h1>
          <p className="admin-access-copy">This account does not have active administrator access.</p>
          <button className="admin-primary-button" type="button" onClick={() => void onLogout()}>Change account</button>
          <a className="admin-secondary-link" href="/main">Return to Tany</a>
        </div>
      </section>
    </main>
  )
}

function VerificationStatus({ children, title = 'Checking access' }) {
  return (
    <main className="admin-verification" role="status" aria-live="polite">
      <section className="admin-verification-card">
        <AdminMark large/>
        <p className="admin-eyebrow">Administrator space</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}

function AdminSidebar({ activeSection, onLogout }) {
  return (
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/admin/dashboard">tany <em>LandTrust</em></a>
      <nav aria-label="Administrator navigation" className="admin-navigation">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = activeSection === item.section
          return (
            <a key={item.section} className={active ? 'admin-nav-link is-active' : 'admin-nav-link'} href={item.href} aria-current={active ? 'page' : undefined}>
              <AdminGlyph section={item.section}/><span>{item.label}</span>
            </a>
          )
        })}
      </nav>
      <div className="admin-sidebar-footer">
        <button className="admin-sidebar-action" type="button" disabled aria-label="Settings unavailable until the admin API is available">
          <AdminGlyph section="settings"/><span>Settings</span>
        </button>
        <button className="admin-sidebar-action" type="button" onClick={() => void onLogout()}>
          <AdminGlyph section="logout"/><span>Log out</span>
        </button>
      </div>
    </aside>
  )
}

function AdminEmptyState({ children }) {
  return <p className="admin-data-unavailable">{children}</p>
}

function AdminListToolbar({ includeDates }) {
  return (
    <div className="admin-list-toolbar" aria-label="List filters unavailable">
      <div className="admin-filter-row admin-search-row">
        <label className="sr-only" htmlFor="admin-search">Search</label>
        <input id="admin-search" type="search" placeholder="Search" disabled/>
        <button className="admin-filter-pill admin-search-button" type="button" disabled aria-label="Search unavailable"/>
      </div>
      <div className="admin-filter-row">
        <span className="admin-filter-label">Sorting:</span>
        <button className="admin-filter-pill" type="button" disabled>Status</button>
        <button className="admin-filter-pill" type="button" disabled>Date</button>
        <button className="admin-filter-pill" type="button" disabled>A–Z</button>
      </div>
      {includeDates && (
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter:</span>
          <label className="sr-only" htmlFor="admin-start-date">Start date</label>
          <input className="admin-date-filter" id="admin-start-date" type="date" disabled/>
          <label className="sr-only" htmlFor="admin-end-date">End date</label>
          <input className="admin-date-filter" id="admin-end-date" type="date" disabled/>
        </div>
      )}
    </div>
  )
}

function AdminList({ model }) {
  return (
    <section className="admin-page-panel admin-list-panel" aria-labelledby="admin-list-title">
      <h1 id="admin-list-title">{model.title}</h1>
      <AdminListToolbar includeDates={model.filters}/>
      <div className="admin-table-wrap">
        <table>
          <caption className="sr-only">{model.title}</caption>
          <thead><tr>{model.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody><tr className="admin-empty-row"><td colSpan={model.columns.length}><AdminEmptyState>{model.unavailableMessage}</AdminEmptyState></td></tr></tbody>
        </table>
      </div>
    </section>
  )
}

function AdminDetail({ model }) {
  return (
    <div className="admin-detail-stack">
      <a className="admin-inline-link" href={model.backHref}>← Back to list</a>
      <div className="admin-disabled-actions" aria-label="Actions unavailable until the admin API is available">
        {model.actions.map((action) => <button key={action} type="button" disabled>{action}</button>)}
      </div>
    </div>
  )
}

function AdminPageContent({ route, request, localBackend }) {
  const model = getAdminPageModel(route)

  if (model.kind === 'notFound') {
    return <section className="admin-page-panel admin-not-found"><h1>{model.title}</h1><a className="admin-inline-link" href="/admin/dashboard">Return to dashboard</a></section>
  }
  if (model.kind === 'dashboard') return <AdminDashboard model={model} request={request}/>
  if (route.section === 'parcels' && model.kind === 'list') return <AdminParcelListPage request={request}/>
  if (route.section === 'parcels' && model.kind === 'detail') return <AdminParcelDetailPage request={request} id={route.id} localBackend={localBackend}/>
  if (route.section === 'users' && model.kind === 'list') return <AdminUserListPage request={request}/>
  if (route.section === 'users' && model.kind === 'detail') return <AdminUserDetailPage request={request} id={route.id}/>
  if (route.section === 'conversations' && model.kind === 'list') return <AdminConversationListPage request={request}/>
  if (route.section === 'conversations' && model.kind === 'reports') return <AdminConversationReportsPage request={request}/>
  if (route.section === 'conversations' && model.kind === 'detail') return <AdminConversationDetailPage key={route.id} request={request} id={route.id}/>
  if (model.kind === 'list') return <AdminList model={model}/>
  return <AdminDetail model={model}/>
}

function AdminWorkspace({ route, onLogout, request, localBackend }) {
  return (
    <div className="admin-app">
      <div className="admin-shell">
        <AdminSidebar activeSection={route.section} onLogout={onLogout}/>
        <main className="admin-main">
          <header className="admin-topbar">
            <div className="admin-account-controls"><span className="admin-account-avatar"><AdminGlyph section="account"/></span><span className="admin-role-label">Admin</span></div>
          </header>
          <div className="admin-page-content"><AdminPageContent route={route} request={request} localBackend={localBackend}/></div>
        </main>
      </div>
    </div>
  )
}

export default function AdminApp({ route }) {
  const { status, request, logout, user } = useAuth()
  const localBackend = isLocalBackendConfigured()
  const [verification, setVerification] = useState({ state: 'idle', identity: null, error: null, user: null, attempt: -1 })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (status !== 'authenticated') return () => { active = false }

    const requestUser = user
    const requestAttempt = attempt
    loadAdminIdentity(request)
      .then((identity) => { if (active) setVerification({ state: 'verified', identity, error: null, user: requestUser, attempt: requestAttempt }) })
      .catch((error) => {
        if (active) setVerification({ state: getAdminFailureKind(error), identity: null, error, user: requestUser, attempt: requestAttempt })
      })

    return () => { active = false }
  }, [status, request, user, attempt])

  const currentVerification = verification.user === user && verification.attempt === attempt
    ? verification
    : { state: 'checking', identity: null, error: null }

  if (status === 'anonymous') return <AdminAccessScreen pathname={route.href}/>
  if (status === 'signingOut' || status === 'restoring') {
    return <VerificationStatus title="Checking your session">Loading…</VerificationStatus>
  }
  if (currentVerification.state === 'checking' || currentVerification.state === 'idle') {
    return <VerificationStatus>Checking administrator access…</VerificationStatus>
  }
  if (currentVerification.state === 'denied') return <AccessDenied onLogout={logout}/>
  if (currentVerification.state === 'unavailable') {
    const language = document.documentElement.lang
    return (
      <VerificationStatus title="Verification unavailable">
        <p role="alert">{apiErrorMessage(currentVerification.error, language) || 'Administrator access could not be verified.'}</p>
        <button className="admin-primary-button" type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </VerificationStatus>
    )
  }
  if (currentVerification.state === 'anonymous') return <AdminAccessScreen pathname={route.href}/>

  return <AdminWorkspace route={route} onLogout={logout} request={request} localBackend={localBackend}/>
}
