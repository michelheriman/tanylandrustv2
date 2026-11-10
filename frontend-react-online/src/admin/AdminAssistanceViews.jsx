import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import {
  loadAdminAssistance,
  loadAdminAssistanceDetail,
  reassignAdminAssistance,
  replyAdminAssistance,
  resolveAdminAssistance,
  takeAdminAssistance,
} from './adminAssistanceData.js'
import { adminText } from './adminTranslations.js'

function displayPerson(person, lang) {
  if (!person) return adminText(lang, 'Unassigned')
  return person.username || person.name || person.email || `${adminText(lang, 'Profile')} ${person.profile_id}`
}

function formatDate(value, lang) {
  if (!value) return '\u2014'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '\u2014' : date.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')
}

function statusLabel(status, lang) {
  return adminText(lang, status === 'resolved' ? 'Resolved status' : 'Open status')
}

function requestError(error, fallback, lang) {
  return apiErrorMessage(error, lang) || fallback
}

function AssistanceState({ loading, error, empty, onRetry, lang }) {
  const t = (text) => adminText(lang, text)
  if (loading) return <p className="admin-assistance-state" role="status">{t('Loading requests...')}</p>
  if (error) return <div className="admin-assistance-state" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>{t('Retry')}</button></div>
  if (empty) return <p className="admin-assistance-state" role="status">{t('No requests for this filter.')}</p>
  return null
}

export function AdminAssistanceListPage({ request, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  const [status, setStatus] = useState('open')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [result, setResult] = useState(null)
  const [failure, setFailure] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actingId, setActingId] = useState('')
  const reload = useCallback(() => setRefreshKey((value) => value + 1), [])
  const queryKey = `${status}:${page}:${refreshKey}`

  useEffect(() => {
    let active = true
    loadAdminAssistance(request, { status, page })
      .then((data) => { if (active) { setResult({ key: queryKey, data }); setFailure(null) } })
      .catch((error) => { if (active) setFailure({ key: queryKey, message: requestError(error, adminText(lang, 'Could not load the assistance inbox.'), lang) }) })
    return () => { active = false }
  }, [request, status, page, refreshKey, queryKey, lang])

  const loading = result?.key !== queryKey && failure?.key !== queryKey
  const error = failure?.key === queryKey ? failure.message : ''

  async function takeRequest(id) {
    setActingId(id)
    setActionError('')
    try {
      await takeAdminAssistance(request, id)
      reload()
    } catch (failure) {
      setActionError(requestError(failure, t('Could not take this request.'), lang))
    } finally {
      setActingId('')
    }
  }

  const rows = result?.key === queryKey ? result.data.data : []
  const pagination = result?.key === queryKey ? result.data.pagination : null
  return <section className="admin-page-panel admin-assistance-panel" aria-labelledby="admin-assistance-title">
    <h1 id="admin-assistance-title">{t('Assistance')}</h1>
    <div className="admin-assistance-toolbar">
      <label htmlFor="admin-assistance-status">{t('State')}</label>
      <select id="admin-assistance-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
        <option value="open">{t('Open requests')}</option><option value="resolved">{t('Resolved')}</option><option value="all">{t('All states')}</option>
      </select>
      <button type="button" onClick={reload} disabled={loading}>{t('Refresh')}</button>
    </div>
    {actionError && <p className="admin-assistance-error" role="alert">{actionError}</p>}
    <AssistanceState loading={loading} error={error} empty={!loading && !error && rows.length === 0} onRetry={reload} lang={lang}/>
    {!loading && !error && rows.length > 0 && <>
      <div className="admin-assistance-table-wrap">
        <table className="admin-assistance-table">
          <caption className="sr-only">{t('Shared assistance inbox requests')}</caption>
          <thead><tr><th scope="col">{t('Customer')}</th><th scope="col">{t('Subject')}</th><th scope="col">{t('Last message')}</th><th scope="col">{t('Date')}</th><th scope="col">{t('State')}</th><th scope="col">{t('Assignee')}</th><th scope="col">{t('Action')}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.conversation_id}>
            <td>{displayPerson(row.customer, lang)}</td>
            <td><a href={`/admin/assistance/${encodeURIComponent(row.conversation_id)}`}>{row.subject}</a></td>
            <td className="admin-assistance-preview">{row.last_message?.content || t('No message')}</td>
            <td>{formatDate(row.last_message?.created_at || row.updated_at, lang)}</td>
            <td><span className={`admin-assistance-status is-${row.status}`}>{statusLabel(row.status, lang)}</span></td>
            <td>{displayPerson(row.assigned_admin, lang)}</td>
            <td>{!row.assigned_admin && row.status === 'open'
              ? <button type="button" className="admin-assistance-action" disabled={Boolean(actingId)} onClick={() => void takeRequest(row.conversation_id)}>{actingId === row.conversation_id ? t('Taking...') : t('Take request')}</button>
              : <a className="admin-assistance-action-link" href={`/admin/assistance/${encodeURIComponent(row.conversation_id)}`}>{t('Open request')}</a>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="admin-assistance-pagination"><span>{pagination?.total ?? rows.length} {t('requests')}</span><div>
        <button type="button" disabled={!pagination || page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{t('Previous')}</button>
        <span>{t('Page')} {pagination?.page ?? page} / {pagination?.pages ?? 1}</span>
        <button type="button" disabled={!pagination || page >= pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>{t('Next')}</button>
      </div></div>
    </>}
  </section>
}

export function AdminAssistanceDetailPage({ request, id, currentAdminProfileId, lang = 'en' }) {
  const t = (text) => adminText(lang, text)
  const [loadedDetail, setLoadedDetail] = useState(null)
  const [failure, setFailure] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [nextAssignee, setNextAssignee] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const reload = useCallback(() => setRefreshKey((value) => value + 1), [])
  const queryKey = `${id}:${refreshKey}`

  useEffect(() => {
    let active = true
    loadAdminAssistanceDetail(request, id)
      .then((value) => {
        if (active) {
          setLoadedDetail({ key: queryKey, value })
          setFailure(null)
          const firstAlternative = value.active_admins.find((admin) => String(admin.profile_id) !== String(value.assigned_admin?.profile_id))
          setNextAssignee(firstAlternative?.profile_id ?? '')
        }
      })
      .catch((error) => { if (active) setFailure({ key: queryKey, message: requestError(error, adminText(lang, 'Could not load this request.'), lang) }) })
    return () => { active = false }
  }, [request, id, refreshKey, queryKey, lang])

  const loading = loadedDetail?.key !== queryKey && failure?.key !== queryKey
  const error = failure?.key === queryKey ? failure.message : ''
  const detail = loadedDetail?.key === queryKey ? loadedDetail.value : null

  async function runAction(action) {
    setBusy(true)
    setActionError('')
    try {
      await action()
      setDraft('')
      reload()
    } catch (failure) {
      setActionError(requestError(failure, t('This assistance action failed. Refresh the request and try again.'), lang))
    } finally {
      setBusy(false)
    }
  }

  if (loading || error || !detail) return <section className="admin-page-panel admin-assistance-panel" aria-labelledby="admin-assistance-detail-title">
    <a className="admin-inline-link" href="/admin/assistance">← {t('Back to assistance')}</a>
    <h1 id="admin-assistance-detail-title">{t('Assistance request')}</h1>
    <AssistanceState loading={loading} error={error} onRetry={reload} lang={lang}/>
  </section>

  const data = detail
  const isAssignedToCurrent = String(data.assigned_admin?.profile_id) === String(currentAdminProfileId)
  const canReply = isAssignedToCurrent && data.status === 'open'
  const currentAssignee = data.assigned_admin?.profile_id ?? ''
  return <section className="admin-page-panel admin-assistance-panel" aria-labelledby="admin-assistance-detail-title">
    <a className="admin-inline-link" href="/admin/assistance">← {t('Back to assistance')}</a>
    <header className="admin-assistance-detail-heading">
      <div><p className="admin-eyebrow">{t('Request')} #{data.conversation_id}</p><h1 id="admin-assistance-detail-title">{data.subject}</h1></div>
      <span className={`admin-assistance-status is-${data.status}`}>{statusLabel(data.status, lang)}</span>
    </header>
    <div className="admin-assistance-summary"><span><strong>{t('Customer')}:</strong> {displayPerson(data.customer, lang)} {data.customer.email ? `(${data.customer.email})` : ''}</span><span><strong>{t('Assignee')}:</strong> {displayPerson(data.assigned_admin, lang)}</span><span><strong>{t('Created:')}</strong> {formatDate(data.created_at, lang)}</span></div>
    {actionError && <p className="admin-assistance-error" role="alert">{actionError}</p>}
    <div className="admin-assistance-actions">
      {!data.assigned_admin && data.status === 'open' && <button type="button" disabled={busy} onClick={() => void runAction(() => takeAdminAssistance(request, id))}>{t('Take request')}</button>}
      <form className="admin-assistance-reassign" onSubmit={(event) => { event.preventDefault(); void runAction(() => reassignAdminAssistance(request, id, nextAssignee)) }}>
        <label htmlFor="admin-assistance-assignee">{t('Reassign to')}</label>
        <select id="admin-assistance-assignee" value={nextAssignee} onChange={(event) => setNextAssignee(event.target.value)} disabled={busy || data.active_admins.length === 0}>
          <option value="">{t('Choose an active admin')}</option>
          {data.active_admins.filter((admin) => String(admin.profile_id) !== String(currentAssignee)).map((admin) => <option key={admin.profile_id} value={admin.profile_id}>{displayPerson(admin, lang)}</option>)}
        </select>
        <button type="submit" disabled={busy || !nextAssignee}>{t('Reassign')}</button>
      </form>
      {canReply && <button type="button" className="admin-assistance-resolve" disabled={busy} onClick={() => void runAction(() => resolveAdminAssistance(request, id))}>{t('Mark as resolved')}</button>}
    </div>
    <section className="admin-assistance-thread" aria-labelledby="admin-assistance-messages-title">
      <h2 id="admin-assistance-messages-title">{t('Exchanges with the customer')}</h2>
      {data.messages.length === 0 ? <p className="admin-assistance-muted">{t('No messages.')}</p> : <ol className="admin-assistance-message-list">{data.messages.map((message) => <li key={message.id} className={message.author_role === 'admin' ? 'is-admin' : 'is-customer'}>
        <div><strong>{message.author_role === 'admin' ? 'Tany Support' : displayPerson(message.author, lang)}</strong><time dateTime={message.created_at}>{formatDate(message.created_at, lang)}</time></div><p>{message.content}</p>
      </li>)}</ol>}
      {canReply && <form className="admin-assistance-reply" onSubmit={(event) => { event.preventDefault(); void runAction(() => replyAdminAssistance(request, id, draft)) }}>
        <label htmlFor="admin-assistance-reply">{t('Reply to the customer')}</label><textarea id="admin-assistance-reply" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={10000} rows={4} required disabled={busy}/>
        <div><span>{draft.length}/10000</span><button type="submit" disabled={busy || !draft.trim()}>{busy ? t('Sending...') : t('Send reply')}</button></div>
      </form>}
      {!canReply && <p className="admin-assistance-muted">{data.status === 'resolved' ? t('This request is resolved.') : `${t('Only the assigned administrator')} (${displayPerson(data.assigned_admin, lang)}) ${t('can reply.')}`}</p>}
    </section>
    <section className="admin-assistance-history" aria-labelledby="admin-assistance-history-title">
      <h2 id="admin-assistance-history-title">{t('Assignment history')}</h2>
      {data.assignment_history.length === 0 ? <p className="admin-assistance-muted">{t('No assignments recorded.')}</p> : <ol>{data.assignment_history.map((entry) => <li key={entry.id}><span>{t(entry.change_kind === 'take' ? 'Taken' : 'Reassigned')} : {entry.previous_admin ? displayPerson(entry.previous_admin, lang) : t('Unassigned')} → {displayPerson(entry.new_admin, lang)}</span><small>{t('By')} {displayPerson(entry.changed_by, lang)} · {formatDate(entry.changed_at, lang)}</small></li>)}</ol>}
    </section>
  </section>
}
