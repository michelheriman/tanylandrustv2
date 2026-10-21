import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { loadAccountOffer, loadAccountProfile } from './accountData.js'
import { ACCOUNT_LABELS } from './accountLabels.js'
import './AccountPage.css'

function formatUtcDate(value, lang) {
  if (!value) return null
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium', timeZone: 'UTC',
  }).format(new Date(value))
}

function AccountLoading({ labels }) {
  return <p className="account-page-state" role="status" aria-live="polite">{labels.loading}</p>
}

function AccountError({ labels, message, onRetry }) {
  return <div className="account-page-state account-page-error" role="alert">
    <p>{message || labels.error}</p>
    <button type="button" onClick={onRetry}>{labels.retry}</button>
  </div>
}

function ProfileDetails({ profile, labels }) {
  const rows = [
    [labels.name, profile.name],
    [labels.username, profile.username],
    [labels.email, profile.email],
  ]
  return <dl className="account-detail-list">
    {rows.map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd>{value || labels.unavailable}</dd>
    </div>)}
  </dl>
}

function OfferDetails({ offer, labels, lang, localBackend }) {
  if (!localBackend) return <div className="account-offer-content">
    <dl className="account-detail-list">
      <div><dt>{labels.supabaseRecorded}</dt><dd>{offer.recordedPlan}</dd></div>
      <div><dt>{labels.parcels}</dt><dd>{labels.unavailable}</dd></div>
      <div><dt>{labels.deletion}</dt><dd>{labels.unavailable}</dd></div>
      <div><dt>{labels.period}</dt><dd>{labels.unavailable}</dd></div>
    </dl>
    <p className="account-page-note">{labels.supabaseUnavailable}</p>
    <p className="account-page-note">{labels.paymentNote}</p>
  </div>

  const period = offer.period
  let provenanceNote = labels.noActiveGrant
  if (offer.provenance === 'test_grant') provenanceNote = labels.testGrant
  else if (offer.provenance === 'manual_grant') provenanceNote = labels.manualGrant
  else if (offer.provenance === 'legacy_migration') provenanceNote = labels.legacyGrant
  return <div className="account-offer-content">
    <dl className="account-detail-list">
      <div><dt>{labels.effectiveOffer}</dt><dd>{labels[offer.code]}</dd></div>
      <div><dt>{labels.parcels}</dt><dd>{offer.parcelCount} / {offer.parcelLimit}</dd></div>
      <div><dt>{labels.deletion}</dt><dd>{offer.canDeleteOwnedParcels ? labels.allowed : labels.notAllowed}</dd></div>
      {period && <div><dt>{labels.period}</dt><dd>
        {labels.starts}: {formatUtcDate(period.starts_at, lang)} · {labels.ends}: {period.ends_at ? formatUtcDate(period.ends_at, lang) : labels.noEnd}
      </dd></div>}
    </dl>
    <p className="account-page-note">{labels.parcelCountNote}</p>
    <p className="account-offer-provenance" role="note">{provenanceNote}</p>
    <p className="account-page-note">{labels.paymentNote}</p>
  </div>
}

export default function AccountPage({ page, lang, request, localBackend, onBack }) {
  const labels = ACCOUNT_LABELS[lang === 'fr' ? 'fr' : 'en']
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ key: null, status: 'loading', data: null, error: null })
  const loadKey = `${page}:${localBackend ? 'local' : 'supabase'}:${reload}`

  useEffect(() => {
    let live = true
    const loader = page === 'profile'
      ? loadAccountProfile(request)
      : loadAccountOffer(request, { localBackend })
    loader.then((data) => {
      if (live) setState({ key: loadKey, status: 'ready', data, error: null })
    }).catch((error) => {
      if (live) setState({ key: loadKey, status: 'error', data: null, error })
    })
    return () => { live = false }
  }, [page, request, localBackend, reload, loadKey])

  const viewState = state.key === loadKey ? state : { status: 'loading', data: null, error: null }
  const isProfile = page === 'profile'
  const title = isProfile ? labels.profileTitle : labels.offerTitle
  const errorText = apiErrorMessage(viewState.error, lang) || labels.error
  return <section className="main-section account-page" aria-labelledby="account-page-title">
    <a className="account-page-back" href="/main" onClick={onBack}>← {labels.back}</a>
    <div className="main-title-card">
      <h1 id="account-page-title">{title}</h1>
      <p>{isProfile ? labels.profileDescription : localBackend ? labels.offerDescription : labels.supabaseOfferDescription}</p>
    </div>
    <article className="account-page-card" aria-busy={viewState.status === 'loading'}>
      {viewState.status === 'loading' && <AccountLoading labels={labels}/>}
      {viewState.status === 'error' && <AccountError labels={labels} message={errorText} onRetry={() => setReload((value) => value + 1)}/>}
      {viewState.status === 'ready' && (isProfile
        ? <ProfileDetails profile={viewState.data} labels={labels}/>
        : <OfferDetails offer={viewState.data} labels={labels} lang={lang} localBackend={localBackend}/>
      )}
    </article>
  </section>
}
