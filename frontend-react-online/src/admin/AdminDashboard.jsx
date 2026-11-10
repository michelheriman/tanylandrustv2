import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { loadAdminDashboardMetrics } from './adminApi.js'
import { adminText } from './adminTranslations.js'

const DASHBOARD_METRICS = [
  { key: 'for_sale', label: 'Listings for sale now' },
  { key: 'contacted_parcels', label: 'Contacted listings' },
  { key: 'awaiting_first_response', label: 'Conversations awaiting first reply' },
  { key: 'registrations', label: 'Registrations this month' },
  { key: 'recent_reports', label: 'Recent internal findings' },
]

function displayError(error, language = 'en') {
  return apiErrorMessage(error, language) || adminText(language, 'Dashboard metrics could not be loaded.')
}

function formatUtc(value, language) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return adminText(language === 'fr-FR' ? 'fr' : 'en', 'UTC period unavailable')
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(date) + ' UTC'
}

function metricPeriod(key, metric, data, language) {
  const lang = language.startsWith('fr') ? 'fr' : 'en'
  if (key === 'for_sale' || key === 'awaiting_first_response') {
    return `${adminText(lang, 'Current snapshot')} · ${formatUtc(data.as_of, language)}`
  }
  if (key === 'registrations') {
    return `${adminText(lang, 'UTC calendar month')} · ${metric.period.month}`
  }
  return `${adminText(lang, 'Last 30 days UTC')} · ${formatUtc(metric.period.start, language)} – ${formatUtc(metric.period.end, language)}`
}

function metricHref(key, metric) {
  const params = new URLSearchParams()
  if (key === 'for_sale') {
    params.set('sell_category', 'to_sell')
    params.set('visibility', 'visible')
    return `/admin/parcels?${params.toString()}`
  }
  if (key === 'contacted_parcels') {
    params.set('contacted_from', metric.period.start)
    params.set('contacted_to', metric.period.end)
    return `/admin/parcels?${params.toString()}`
  }
  if (key === 'awaiting_first_response') return '/admin/conversations?awaiting_first_response=true'
  if (key === 'registrations') {
    const endExclusive = new Date(metric.period.end)
    endExclusive.setUTCDate(endExclusive.getUTCDate() - 1)
    params.set('date_from', metric.period.start.slice(0, 10))
    params.set('date_to', endExclusive.toISOString().slice(0, 10))
    return `/admin/users?${params.toString()}`
  }
  if (key === 'recent_reports') {
    params.set('created_from', metric.period.start)
    params.set('created_to', metric.period.end)
    return `/admin/conversation-reports?${params.toString()}`
  }
  return null
}

export function AdminDashboardView({ model, state, onRetry, lang = 'en' }) {
  const dashboardState = state ?? { kind: 'loading' }
  const language = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const t = (text) => adminText(lang, text)
  return (
    <section className="admin-page-panel admin-dashboard-panel" aria-labelledby="admin-dashboard-title">
      <h1 id="admin-dashboard-title">{t(model.title)}</h1>
      <div className="admin-metric-grid">
        {DASHBOARD_METRICS.map(({ key, label }) => {
          const metric = dashboardState.kind === 'ready' ? dashboardState.data[key] : null
          const href = metric ? metricHref(key, metric) : null
          return (
            <article className="admin-metric-card" key={key}>
              <span className={`admin-metric-icon metric-icon-${key}`} aria-hidden="true"><AdminDashboardGlyph metric={key}/></span>
              <div className="admin-metric-copy">
                <span className="admin-metric-label">{t(label)}</span>
                {dashboardState.kind === 'loading' && <p className="admin-dashboard-state" role="status">{t('Loading...')}</p>}
                {dashboardState.kind === 'error' && <p className="admin-data-unavailable">{t('Data unavailable')}</p>}
                {dashboardState.kind === 'ready' && metric && (
                  <>
                    <strong className="admin-metric-value">{metric.count.toLocaleString(language)}</strong>
                    {metric.count === 0 && <span className="admin-metric-zero">{t('No records match this definition')}</span>}
                    <span className="admin-metric-period">{metricPeriod(key, metric, dashboardState.data, language)}</span>
                    <p className="admin-metric-definition">{t(metric.definition)}</p>
                    <a className="admin-metric-open" href={href}>{t('Open filtered list')} <span aria-hidden="true">→</span></a>
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {dashboardState.kind === 'error' && (
        <div className="admin-dashboard-error" role="alert">
          <p>{displayError(dashboardState.error, lang)}</p>
          <button className="admin-retry-button" type="button" onClick={onRetry}>{t('Retry')}</button>
        </div>
      )}
    </section>
  )
}

function AdminDashboardGlyph({ metric }) {
  const common = { 'aria-hidden': true, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 }
  if (metric === 'contacted_parcels' || metric === 'awaiting_first_response') {
    return <svg {...common}><path d="M4 5h16v12H9l-5 3V5Z"/><path d="M8 9h8M8 13h5"/></svg>
  }
  if (metric === 'registrations') {
    return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5A5.5 5.5 0 0 1 9 13h1M17 13v7M13.5 16.5h7"/></svg>
  }
  if (metric === 'recent_reports') {
    return <svg {...common}><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"/></svg>
  }
  return <svg {...common}><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-6h6v6"/></svg>
}

export default function AdminDashboard({ model, request, lang = 'en' }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ kind: 'loading', request: null, attempt: -1 })

  useEffect(() => {
    let active = true
    loadAdminDashboardMetrics(request)
      .then((data) => { if (active) setState({ kind: 'ready', data, request, attempt }) })
      .catch((error) => { if (active) setState({ kind: 'error', error, request, attempt }) })
    return () => { active = false }
  }, [request, attempt])

  const visibleState = state.request === request && state.attempt === attempt
    ? state
    : { kind: 'loading' }
  return <AdminDashboardView model={model} state={visibleState} onRetry={() => setAttempt((value) => value + 1)} lang={lang}/>
}
