import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import {
  createAdminConversationReport,
  loadAdminConversation,
  loadAdminConversationReports,
  loadAdminConversations,
  loadAdminConversationReportList,
} from './adminApi.js'
import {
  adminConversationReportListViewState,
  buildAdminConversationListQuery,
  readAdminConversationReportPeriod,
  readAdminConversationListFilter,
} from './adminConversationData.js'

const PAGE_SIZE = 20
const UNAVAILABLE = 'Donnée indisponible'

function errorMessage(error) {
  const language = globalThis.document?.documentElement?.lang || 'en'
  return apiErrorMessage(error, language) || 'Conversation data could not be loaded. Please try again.'
}

function formatDate(value) {
  if (typeof value !== 'string' || !value) return UNAVAILABLE
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? UNAVAILABLE : new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)
}

function participantName(participant) {
  return participant?.name || participant?.username || UNAVAILABLE
}

function UnlinkedHistoryNote() {
  return <p className="admin-conversation-history-note" role="note">Unlinked historical messages are excluded from these conversations.</p>
}

function ConversationListState({ state, onRetry }) {
  if (state.kind === 'loading') return <p className="admin-conversation-state" role="status">Loading conversations…</p>
  if (state.kind === 'error') {
    return <div className="admin-conversation-state" role="alert"><p>{errorMessage(state.error)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button></div>
  }
  if (state.kind === 'empty') return <p className="admin-conversation-state" role="status">No conversations found.</p>
  return null
}

export function AdminConversationListView({ state, onRetry, onPageChange, awaitingFirstResponse = false }) {
  const ready = state.kind === 'ready'
  const pagination = state.pagination
  return (
    <section className="admin-page-panel admin-list-panel admin-conversation-list" aria-labelledby="admin-conversation-list-title">
      <h1 id="admin-conversation-list-title">Message</h1>
      {awaitingFirstResponse && <p className="admin-metric-filter-note">Filtered list · marketplace conversations with exactly two participants where the first message recipient has not replied. <a href="/admin/conversations">Clear filter</a></p>}
      {(ready || state.kind === 'empty') && state.unlinkedHistoryExcluded && <UnlinkedHistoryNote/>}
      <ConversationListState state={state} onRetry={onRetry}/>
      {ready && (
        <>
          <div className="admin-table-wrap admin-conversation-table-wrap">
            <table>
              <caption className="sr-only">Conversations</caption>
              <thead><tr><th scope="col">Parcel</th><th scope="col">Users</th><th scope="col">Last message</th><th scope="col">Action</th></tr></thead>
              <tbody>{state.conversations.map((conversation) => (
                <tr key={conversation.conversation_id}>
                  <td>{conversation.parcel_name || UNAVAILABLE}</td>
                  <td><div className="admin-conversation-participant-pair">
                    {conversation.participants.map((participant) => <span key={participant.profile_id}>{participantName(participant)}</span>)}
                    {conversation.participants.length === 0 && UNAVAILABLE}
                  </div></td>
                  <td><div className="admin-conversation-preview">
                    <span>{conversation.last_message?.content || 'No linked message'}</span>
                    {conversation.last_message?.created_at && <time dateTime={conversation.last_message.created_at}>{formatDate(conversation.last_message.created_at)}</time>}
                  </div></td>
                  <td><a className="admin-consult-link" href={`/admin/conversations/${encodeURIComponent(conversation.conversation_id)}`}>Consult <span aria-hidden="true">→</span></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="admin-parcel-pagination" aria-label="Conversation pagination">
            <span>{pagination.total} conversations</span>
            <div>
              <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
              <span aria-live="polite">Page {pagination.page} of {pagination.pages}</span>
              <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function AdminConversationListPage({ request }) {
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [resource, setResource] = useState(null)
  const awaitingFirstResponse = readAdminConversationListFilter(globalThis.location?.search || '')
  const queryKey = `${page}:${awaitingFirstResponse}:${retry}`

  useEffect(() => {
    let current = true
    loadAdminConversations(request, buildAdminConversationListQuery({
      page, perPage: PAGE_SIZE, awaitingFirstResponse,
    }))
      .then((result) => { if (current) setResource({ queryKey, result, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, result: null, error }) })
    return () => { current = false }
  }, [request, page, retry, awaitingFirstResponse, queryKey])

  const current = resource?.queryKey === queryKey ? resource : null
  let state = { kind: 'loading' }
  if (current?.error) state = { kind: 'error', error: current.error }
  else if (current?.result) {
    state = current.result.data.length
      ? { kind: 'ready', conversations: current.result.data, pagination: current.result.pagination, unlinkedHistoryExcluded: current.result.unlinkedHistoryExcluded }
      : { kind: 'empty', pagination: current.result.pagination, unlinkedHistoryExcluded: current.result.unlinkedHistoryExcluded }
  }

  return <AdminConversationListView state={state} onRetry={() => setRetry((value) => value + 1)} onPageChange={setPage} awaitingFirstResponse={awaitingFirstResponse}/>
}

export function AdminConversationReportsView({ state, onRetry, onPageChange }) {
  if (state.kind === 'loading') return <section className="admin-page-panel" role="status">Loading internal findings…</section>
  if (state.kind === 'error') return <section className="admin-page-panel" role="alert"><h1>Recent internal findings</h1><p>{errorMessage(state.error)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button></section>
  const pagination = state.pagination
  return (
    <section className="admin-page-panel admin-list-panel admin-conversation-report-list" aria-labelledby="admin-report-list-title">
      <h1 id="admin-report-list-title">Recent internal findings</h1>
      <p className="admin-metric-filter-note">UTC interval [{state.period?.start}, {state.period?.end}) · recorded findings only. This list does not indicate whether a finding has been processed.</p>
      {state.kind === 'empty' && <p className="admin-conversation-state" role="status">No findings recorded during this period.</p>}
      {state.kind === 'ready' && (
        <>
          <div className="admin-table-wrap">
            <table>
              <caption className="sr-only">Internal conversation findings in the selected period</caption>
              <thead><tr><th scope="col">Created (UTC)</th><th scope="col">Parcel</th><th scope="col">Conversation</th><th scope="col">Finding</th></tr></thead>
              <tbody>{state.reports.map((report) => (
                <tr key={report.id}>
                  <td><time dateTime={report.created_at}>{formatDate(report.created_at)}</time></td>
                  <td>{report.parcel_name || UNAVAILABLE}</td>
                  <td><a className="admin-inline-link" href={`/admin/conversations/${encodeURIComponent(report.conversation_id)}`}>Open {report.conversation_id}</a></td>
                  <td>{report.finding}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="admin-parcel-pagination" aria-label="Finding pagination">
            <span>{pagination.total} findings</span>
            <div>
              <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
              <span aria-live="polite">Page {pagination.page} of {pagination.pages}</span>
              <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Next</button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function AdminConversationReportsPage({ request }) {
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [resource, setResource] = useState(null)
  const period = readAdminConversationReportPeriod(globalThis.location?.search || '')
  const createdFrom = period?.created_from || ''
  const createdTo = period?.created_to || ''
  const queryKey = JSON.stringify([page, retry, createdFrom, createdTo])

  useEffect(() => {
    if (!createdFrom || !createdTo) return undefined
    let current = true
    loadAdminConversationReportList(request, {
      created_from: createdFrom, created_to: createdTo, page, per_page: PAGE_SIZE,
    })
      .then((result) => { if (current) setResource({ queryKey, result, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, result: null, error }) })
    return () => { current = false }
  }, [request, page, retry, queryKey, createdFrom, createdTo])

  const current = resource?.queryKey === queryKey ? resource : null
  const state = !createdFrom || !createdTo
    ? { kind: 'error', error: new Error('The requested finding period is invalid.') }
    : adminConversationReportListViewState({
      loading: !current,
      error: current?.error,
      result: current?.result,
    })
  return <AdminConversationReportsView state={state} onRetry={() => setRetry((value) => value + 1)} onPageChange={setPage}/>
}

function ConversationDetailState({ state, onRetry }) {
  if (state.kind === 'loading') return <section className="admin-page-panel admin-conversation-message" role="status"><p>Loading conversation…</p></section>
  if (state.kind === 'notFound') return <section className="admin-page-panel admin-conversation-message" role="status"><h1>Conversation not found</h1></section>
  if (state.kind === 'error') return <section className="admin-page-panel admin-conversation-message" role="alert"><p>{errorMessage(state.error)}</p><button className="admin-retry-button" type="button" onClick={onRetry}>Retry</button></section>
  return null
}

export function AdminConversationDetailView({
  state,
  onRetry,
  reportState = { kind: 'loading' },
  onRetryReports,
  finding = '',
  onFindingChange,
  onSubmitReport,
  reportSubmission = { kind: 'idle' },
}) {
  if (state.kind !== 'ready') return <ConversationDetailState state={state} onRetry={onRetry}/>

  const { conversation, participants, messages, unlinkedHistoryExcluded } = state.detail
  const participantById = new Map(participants.map((participant) => [participant.profile_id, participant]))
  const firstParticipantId = participants[0]?.profile_id
  return (
    <div className="admin-detail-stack admin-conversation-detail-stack">
      <a className="admin-inline-link" href="/admin/conversations">← Back to conversations</a>
      {unlinkedHistoryExcluded && <UnlinkedHistoryNote/>}
      <div className="admin-conversation-detail-grid">
        <section className="admin-detail-panel admin-conversation-panel" aria-labelledby="admin-conversation-detail-title">
          <div className="admin-conversation-heading">
            <h1 id="admin-conversation-detail-title">Conversation {conversation.conversation_id}</h1>
            <p>{participants.map(participantName).join(' · ') || UNAVAILABLE}</p>
          </div>
          <div className="admin-chat-message-list" aria-label="Linked messages">
            {messages.length === 0 && <p className="admin-conversation-state" role="status">No linked messages in this conversation.</p>}
            {messages.map((message) => {
              const sender = participantById.get(message.sender_profile_id)
              const side = message.sender_profile_id === firstParticipantId ? 'first' : 'second'
              return (
                <article className={`admin-chat-message is-${side}`} key={message.id}>
                  <p className="admin-chat-message-sender">{participantName(sender)}</p>
                  <p className="admin-chat-message-content">{message.content || UNAVAILABLE}</p>
                  <time dateTime={message.created_at || undefined}>{formatDate(message.created_at)}</time>
                </article>
              )
            })}
          </div>
        </section>
        <aside className="admin-conversation-aside">
          <section className="admin-detail-panel admin-conversation-parcel" aria-labelledby="admin-conversation-parcel-title">
            <h2 id="admin-conversation-parcel-title">Parcel</h2>
            <p>{conversation.parcel_name || UNAVAILABLE}</p>
            {conversation.parcel_id && <a className="admin-inline-link" href={`/admin/parcels/${encodeURIComponent(conversation.parcel_id)}`}>View parcel ↗</a>}
          </section>
          <section className="admin-report-slot" aria-labelledby="admin-report-title">
            <h2 id="admin-report-title">Report</h2>
            <form className="admin-report-form" onSubmit={(event) => {
              event.preventDefault()
              if (finding.trim()) onSubmitReport?.(finding.trim())
            }}>
              <label className="sr-only" htmlFor="admin-report-note">Internal conversation finding</label>
              <textarea
                id="admin-report-note"
                rows="4"
                placeholder="Describe the internal finding…"
                value={finding}
                maxLength={2000}
                disabled={reportSubmission?.kind === 'submitting'}
                aria-describedby="admin-report-help"
                onChange={(event) => onFindingChange?.(event.target.value)}
              />
              <p id="admin-report-help" className="admin-disabled-note">Internal note for administrators only. Maximum 2000 characters.</p>
              {reportSubmission?.kind === 'success' && <p className="admin-report-success" role="status">Report saved.</p>}
              {reportSubmission?.kind === 'error' && <p className="admin-report-error" role="alert">{errorMessage(reportSubmission.error)}</p>}
              <button
                className="admin-danger-button"
                type="submit"
                disabled={!finding.trim() || finding.trim().length > 2000 || reportSubmission?.kind === 'submitting'}
              >{reportSubmission?.kind === 'submitting' ? 'Saving…' : 'Report'}</button>
            </form>
            <section className="admin-report-list" aria-labelledby="admin-saved-reports-title">
              <h3 id="admin-saved-reports-title">Saved internal reports</h3>
              {reportState?.kind === 'loading' && <p role="status">Loading reports…</p>}
              {reportState?.kind === 'empty' && <p role="status">No reports recorded for this conversation.</p>}
              {reportState?.kind === 'error' && <div role="alert"><p>{errorMessage(reportState.error)}</p><button className="admin-retry-button" type="button" onClick={onRetryReports}>Retry</button></div>}
              {reportState?.kind === 'ready' && <ul>
                {reportState.reports.map((report) => <li key={report.id}>
                  <p>{report.finding}</p>
                  <time dateTime={report.created_at}>{formatDate(report.created_at)}</time>
                </li>)}
              </ul>}
            </section>
          </section>
          <section className="admin-detail-panel admin-conversation-users" aria-labelledby="admin-conversation-users-title">
            <h2 id="admin-conversation-users-title">Users</h2>
            {participants.length === 0 && <p>{UNAVAILABLE}</p>}
            {participants.map((participant) => (
              <a key={participant.profile_id} href={`/admin/users/${encodeURIComponent(participant.profile_id)}`}>
                <span className="admin-conversation-user-avatar" aria-hidden="true">{participantName(participant).slice(0, 1).toUpperCase()}</span>
                <span>{participantName(participant)}</span><span aria-hidden="true">↗</span>
              </a>
            ))}
          </section>
        </aside>
      </div>
    </div>
  )
}

export function AdminConversationDetailPage({ request, id }) {
  const [retry, setRetry] = useState(0)
  const [resource, setResource] = useState(null)
  const [reportRetry, setReportRetry] = useState(0)
  const [reportResource, setReportResource] = useState(null)
  const [finding, setFinding] = useState('')
  const [reportSubmission, setReportSubmission] = useState({ kind: 'idle' })
  const queryKey = `${id}:${retry}`
  const reportQueryKey = `${id}:${reportRetry}`

  useEffect(() => {
    let current = true
    loadAdminConversation(request, id)
      .then((detail) => { if (current) setResource({ queryKey, detail, error: null }) })
      .catch((error) => { if (current) setResource({ queryKey, detail: null, error }) })
    return () => { current = false }
  }, [request, id, retry, queryKey])

  useEffect(() => {
    let current = true
    loadAdminConversationReports(request, id)
      .then((reports) => { if (current) setReportResource({ queryKey: reportQueryKey, reports, error: null }) })
      .catch((error) => { if (current) setReportResource({ queryKey: reportQueryKey, reports: null, error }) })
    return () => { current = false }
  }, [request, id, reportRetry, reportQueryKey])

  const current = resource?.queryKey === queryKey ? resource : null
  let state = { kind: 'loading' }
  if (current?.error) state = current.error.status === 404 ? { kind: 'notFound' } : { kind: 'error', error: current.error }
  else if (current?.detail) state = { kind: 'ready', detail: current.detail }

  const currentReports = reportResource?.queryKey === reportQueryKey ? reportResource : null
  let reportState = { kind: 'loading' }
  if (currentReports?.error) reportState = { kind: 'error', error: currentReports.error }
  else if (currentReports?.reports) reportState = currentReports.reports.length
    ? { kind: 'ready', reports: currentReports.reports }
    : { kind: 'empty' }

  async function submitReport(note) {
    setReportSubmission({ kind: 'submitting' })
    try {
      await createAdminConversationReport(request, id, note)
      setFinding('')
      setReportSubmission({ kind: 'success' })
      setReportRetry((value) => value + 1)
    } catch (error) {
      setReportSubmission({ kind: 'error', error })
    }
  }

  return <AdminConversationDetailView
    state={state}
    onRetry={() => setRetry((value) => value + 1)}
    reportState={reportState}
    onRetryReports={() => setReportRetry((value) => value + 1)}
    finding={finding}
    onFindingChange={(value) => setFinding(value)}
    onSubmitReport={submitReport}
    reportSubmission={reportSubmission}
  />
}
