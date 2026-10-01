import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import {
  conversationMatchesSearch,
  loadConversations,
  loadMessages,
  sendAdminMessage as postAdminMessage,
  sendConversationReply,
} from './chatData.js'
import './Chat.css'

const copy = {
  en: {
    title: 'Private Message', subtitle: 'Communicate securely with your network.', chat: 'Chat',
    search: 'Search conversations', admin: 'Write to Admin', online: 'Online', select: 'Select a conversation to view its messages.',
    loading: 'Loading conversations…', loadingMessages: 'Loading messages…', retry: 'Retry', noConversations: 'No conversations yet.',
    noSearchResults: 'No conversations match this search.', noMessages: 'No messages in this conversation yet.',
    placeholder: 'Write a message…', send: 'Send message', sending: 'Sending…', now: 'Now',
    adminTitle: 'Write to Admin', adminDescription: 'Your message will be sent directly to the admin team.',
    subject: 'Subject', subjectPlaceholder: 'e.g. Issue with my account', message: 'Message',
    adminPlaceholder: 'Describe your issue or question…', cancel: 'Cancel', sendAdmin: 'Send message',
  },
  fr: {
    title: 'Messages privés', subtitle: 'Communiquez en toute sécurité avec votre réseau.', chat: 'Messages',
    search: 'Rechercher une conversation', admin: 'Écrire à l’administration', online: 'En ligne', select: 'Sélectionnez une conversation pour afficher ses messages.',
    loading: 'Chargement des conversations…', loadingMessages: 'Chargement des messages…', retry: 'Réessayer', noConversations: 'Aucune conversation pour le moment.',
    noSearchResults: 'Aucune conversation ne correspond à cette recherche.', noMessages: 'Aucun message dans cette conversation.',
    placeholder: 'Écrire un message…', send: 'Envoyer', sending: 'Envoi…', now: 'À l’instant',
    adminTitle: 'Écrire à l’administration', adminDescription: 'Votre message sera envoyé directement à l’équipe d’administration.',
    subject: 'Sujet', subjectPlaceholder: 'Ex. : problème avec mon compte', message: 'Message',
    adminPlaceholder: 'Décrivez votre problème ou votre question…', cancel: 'Annuler', sendAdmin: 'Envoyer le message',
  },
}

function contactName(value) {
  const identifier = String(value ?? '')
  return identifier.includes('@') ? identifier.slice(0, identifier.indexOf('@')) : identifier
}

function initials(value) {
  return contactName(value).trim().slice(0, 2).toUpperCase() || '—'
}

function ChatError({ error, onRetry, retryLabel }) {
  return <div className="chat-react-error" role="alert"><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}>{retryLabel}</button>}</div>
}

export default function Chat({ lang = 'en' }) {
  const { request, user } = useAuth()
  const t = copy[lang]
  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationsError, setConversationsError] = useState('')
  const [conversationRetry, setConversationRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState('')
  const [messageRetry, setMessageRetry] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminSubject, setAdminSubject] = useState('')
  const [adminContent, setAdminContent] = useState('')
  const [adminSending, setAdminSending] = useState(false)
  const [adminError, setAdminError] = useState('')
  const endOfMessages = useRef(null)

  useEffect(() => {
    let active = true
    if (!user?.email) return () => { active = false }

    loadConversations(request, user.email)
      .then((rows) => {
        if (active) {
          setConversations(rows)
          setConversationsError('')
          setConversationsLoading(false)
        }
      })
      .catch((failure) => {
        if (active) {
          setConversationsError(failure.message || 'Unable to load conversations.')
          setConversationsLoading(false)
        }
      })

    return () => { active = false }
  }, [request, user?.email, conversationRetry])

  useEffect(() => {
    if (!selectedConversation) return undefined
    let active = true
    loadMessages(request, selectedConversation).then((rows) => {
      if (active) {
        setMessages(rows)
        setMessagesError('')
        setMessagesLoading(false)
      }
    }).catch((failure) => {
      if (active) {
        setMessagesError(failure.message || 'Unable to load messages.')
        setMessagesLoading(false)
      }
    })
    return () => { active = false }
  }, [request, selectedConversation, messageRetry])

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    if (!adminOpen) return undefined
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !adminSending) setAdminOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [adminOpen, adminSending])

  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => conversationMatchesSearch(conversation, query)),
    [conversations, query],
  )

  function selectConversation(conversation) {
    setSelectedConversation(conversation)
    setMessages([])
    setMessagesError('')
    setSendError('')
    setDraft('')
    setMessagesLoading(true)
  }

  async function sendReply(event) {
    event.preventDefault()
    if (sending || !selectedConversation || !user?.email || !draft.trim()) return
    setSending(true)
    setSendError('')
    try {
      const body = await sendConversationReply(request, selectedConversation, messages, user.email, draft)
      setMessages((current) => [...current, { ...body, created_at: t.now, localEcho: true }])
      setDraft('')
    } catch (failure) {
      setSendError(failure.message || 'Unable to send this message.')
    } finally {
      setSending(false)
    }
  }

  async function sendAdminMessage(event) {
    event.preventDefault()
    if (adminSending || !user?.email || !adminSubject.trim() || !adminContent.trim()) return
    setAdminSending(true)
    setAdminError('')
    try {
      if (!globalThis.crypto?.randomUUID) throw new Error('A secure UUID generator is unavailable in this browser.')
      await postAdminMessage(request, user.email, adminSubject, adminContent, globalThis.crypto.randomUUID())
      setAdminSubject('')
      setAdminContent('')
      setAdminOpen(false)
      setConversationsLoading(true)
      setConversationRetry((value) => value + 1)
    } catch (failure) {
      setAdminError(failure.message || 'Unable to send this message.')
    } finally {
      setAdminSending(false)
    }
  }

  return <section className="main-section chat-react-section" aria-labelledby="chat-react-title">
    <header className="main-title-card chat-react-title-card">
      <h1 id="chat-react-title">{t.title}</h1>
      <p>{t.subtitle}</p>
    </header>

    <div className="chat-react-workspace">
      <aside className="chat-react-sidebar" aria-label={t.chat}>
        <div className="chat-react-sidebar-heading">
          <h2>{t.chat}</h2>
          <button type="button" className="chat-react-admin-trigger" aria-label={t.admin} title={t.admin} onClick={() => { setAdminError(''); setAdminOpen(true) }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.2-4.4A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M8 11.5h8M12 8v7"/></svg>
          </button>
        </div>
        <label className="chat-react-search">
          <span className="sr-only">{t.search}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
        </label>

        <div className="chat-react-conversation-list" aria-live="polite" aria-busy={conversationsLoading}>
          {conversationsLoading && <p className="chat-react-list-state" role="status">{t.loading}</p>}
          {!conversationsLoading && conversationsError && <ChatError error={conversationsError} retryLabel={t.retry} onRetry={() => { setConversationsLoading(true); setConversationsError(''); setConversationRetry((value) => value + 1) }} />}
          {!conversationsLoading && !conversationsError && conversations.length === 0 && <p className="chat-react-list-state">{t.noConversations}</p>}
          {!conversationsLoading && !conversationsError && conversations.length > 0 && visibleConversations.length === 0 && <p className="chat-react-list-state">{t.noSearchResults}</p>}
          {!conversationsLoading && !conversationsError && visibleConversations.map((conversation, index) => {
            const isSelected = selectedConversation === conversation
            const key = `${conversation.uuid_post ?? ''}:${conversation.objet ?? ''}:${conversation.main_user ?? ''}:${index}`
            return <button key={key} type="button" className={`chat-react-conversation${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected} onClick={() => selectConversation(conversation)}>
              <span className="chat-react-avatar chat-react-conversation-avatar" aria-hidden="true">{initials(conversation.main_user)}</span>
              <span className="chat-react-conversation-copy"><strong>{contactName(conversation.main_user) || conversation.objet || '—'}</strong><small>{conversation.objet || conversation.main_user || '—'}</small></span>
            </button>
          })}
        </div>
      </aside>

      <section className="chat-react-thread" aria-label={selectedConversation?.objet || t.chat}>
        <header className="chat-react-thread-header">
          {selectedConversation ? <>
            <span className="chat-react-avatar chat-react-contact-avatar" aria-hidden="true">{initials(selectedConversation.main_user)}</span>
            <div className="chat-react-contact-copy"><h2>{contactName(selectedConversation.main_user) || selectedConversation.objet}</h2><p>{selectedConversation.main_user || selectedConversation.objet}</p></div>
            <span className="chat-react-online"><i aria-hidden="true" />{t.online}</span>
          </> : <div className="chat-react-unselected-title"><h2>{t.chat}</h2></div>}
        </header>

        {selectedConversation ? <>
          <div className="chat-react-messages" aria-live="polite" aria-busy={messagesLoading}>
            {messagesLoading && <p className="chat-react-thread-state" role="status">{t.loadingMessages}</p>}
            {!messagesLoading && messagesError && <ChatError error={messagesError} retryLabel={t.retry} onRetry={() => { setMessagesLoading(true); setMessagesError(''); setMessageRetry((value) => value + 1) }} />}
            {!messagesLoading && !messagesError && messages.length === 0 && <p className="chat-react-thread-state">{t.noMessages}</p>}
            {!messagesLoading && !messagesError && messages.map((message, index) => {
              const outgoing = message.sender_id === user?.email
              return <article className={`chat-react-message${outgoing ? ' is-outgoing' : ''}`} key={`${message.uuid_post ?? selectedConversation.uuid_post ?? 'message'}:${message.created_at ?? index}:${index}`}>
                {!outgoing && <span className="chat-react-avatar chat-react-message-avatar" aria-hidden="true">{initials(message.sender_id)}</span>}
                <div className="chat-react-bubble">
                  <strong>{message.sender_id || '—'}</strong>
                  <p>{message.content ?? ''}</p>
                  <time>{message.localEcho ? t.now : message.created_at || ''}</time>
                </div>
                {outgoing && <span className="chat-react-avatar chat-react-message-avatar" aria-hidden="true">{initials(message.sender_id)}</span>}
              </article>
            })}
            <div ref={endOfMessages} />
          </div>
          <form className="chat-react-compose" onSubmit={(event) => void sendReply(event)}>
            <label className="sr-only" htmlFor="chat-react-draft">{t.placeholder}</label>
            <input id="chat-react-draft" type="text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.placeholder} disabled={messagesLoading || Boolean(messagesError) || !messages.length || sending} />
            <button type="submit" aria-label={t.send} title={t.send} disabled={messagesLoading || Boolean(messagesError) || !messages.length || !draft.trim() || sending}>
              {sending ? <span className="chat-react-send-pending">…</span> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-6 18-3-8-9-2Z"/><path d="m12 13 9-10"/></svg>}
            </button>
            {sendError && <p className="chat-react-compose-error" role="alert">{sendError}</p>}
          </form>
        </> : <div className="chat-react-empty-thread"><p>{t.select}</p></div>}
      </section>
    </div>

    {adminOpen && <div className="chat-react-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !adminSending) setAdminOpen(false) }}>
      <section className="chat-react-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-react-admin-title">
        <button type="button" className="chat-react-modal-close" aria-label={t.cancel} disabled={adminSending} onClick={() => setAdminOpen(false)}>×</button>
        <h2 id="chat-react-admin-title">{t.adminTitle}</h2>
        <p>{t.adminDescription}</p>
        <form onSubmit={(event) => void sendAdminMessage(event)}>
          <label htmlFor="chat-react-admin-subject">{t.subject}</label>
          <input id="chat-react-admin-subject" value={adminSubject} onChange={(event) => setAdminSubject(event.target.value)} placeholder={t.subjectPlaceholder} required disabled={adminSending} />
          <label htmlFor="chat-react-admin-content">{t.message}</label>
          <textarea id="chat-react-admin-content" value={adminContent} onChange={(event) => setAdminContent(event.target.value)} placeholder={t.adminPlaceholder} rows="4" required disabled={adminSending} />
          {adminError && <p className="chat-react-admin-error" role="alert">{adminError}</p>}
          <div className="chat-react-admin-actions"><button type="button" disabled={adminSending} onClick={() => setAdminOpen(false)}>{t.cancel}</button><button type="submit" disabled={adminSending || !adminSubject.trim() || !adminContent.trim()}>{adminSending ? t.sending : t.sendAdmin}</button></div>
        </form>
      </section>
    </div>}
  </section>
}
