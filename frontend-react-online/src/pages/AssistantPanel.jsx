import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import Icon from '../components/Icon.jsx'
import { focusFirstDialogField, handleDialogKeydown, restoreDialogFocus } from './mainDialogFocus.js'
import { ASSISTANT_MAX_MESSAGE_CHARS, sendAssistantMessage } from './chatAssistantData.js'
import './AssistantPanel.css'

const copy = {
  en: {
    title: 'Tany AI Assistant', generated: 'AI-generated responses', generalIntro: 'Hello, I’m Tany’s AI assistant. I can answer general questions about Tany and current public listings.',
    parcelIntro: 'Ask about this public Marketplace listing. I’ll use its current public details.', selected: 'Selected listing:',
    input: 'Ask Tany AI…', send: 'Send question', sending: 'Thinking…', close: 'Close AI assistant',
    support: 'Contact Assistance', supportHint: 'Need help from the Tany team?', supportPrompt: 'I could not find reliable information for this. The Tany support team can help.',
    error: 'The AI assistant is temporarily unavailable.',
  },
  fr: {
    title: 'Assistant IA Tany', generated: 'Réponses générées par IA', generalIntro: 'Bonjour, je suis l’assistant IA de Tany. Je peux répondre aux questions générales sur Tany et aux questions sur les annonces publiques actuelles.',
    parcelIntro: 'Posez vos questions sur cette annonce publique du Marketplace. Je m’appuierai sur ses informations publiques actuelles.', selected: 'Annonce sélectionnée :',
    input: 'Poser une question à l’IA Tany…', send: 'Envoyer la question', sending: 'Réponse en cours…', close: 'Fermer l’assistant IA',
    support: 'Contacter l’assistance', supportHint: 'Besoin de l’aide de l’équipe Tany ?', supportPrompt: 'Je n’ai pas trouvé d’information fiable. L’équipe d’assistance Tany peut vous aider.',
    error: 'L’assistant IA est momentanément indisponible.',
  },
}

export default function AssistantPanel({ lang = 'en', context = null, triggerRef, onClose, onContactSupport, onAccessDenied }) {
  const { request } = useAuth()
  const t = copy[lang]
  const dialogRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const trigger = triggerRef?.current
    focusFirstDialogField(dialogRef.current)
    const onKeyDown = (event) => handleDialogKeydown(event, dialogRef.current, onClose)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      restoreDialogFocus(trigger)
    }
  }, [onClose, triggerRef])

  async function sendQuestion(event) {
    event.preventDefault()
    const content = draft.trim()
    if (sending || !content || content.length > ASSISTANT_MAX_MESSAGE_CHARS) return
    setSending(true)
    setError('')
    try {
      const answer = await sendAssistantMessage(request, content, messages, context?.parcelId ?? null)
      setMessages((current) => [
        ...current,
        { role: 'user', content },
        { role: 'assistant', content: answer.reply, offerSupport: answer.offerSupport },
      ].slice(-20))
      setDraft('')
    } catch (failure) {
      setError(apiErrorMessage(failure, lang) || t.error)
      if (failure?.status === 403) onAccessDenied?.()
    } finally {
      setSending(false)
    }
  }

  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')

  return <div className="tany-assistant-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className="tany-assistant-panel" role="dialog" aria-modal="true" aria-labelledby="tany-assistant-title" tabIndex={-1}>
      <header className="tany-assistant-header">
        <span className="tany-assistant-icon" aria-hidden="true"><Icon name="sparkles" size={20}/></span>
        <div><h2 id="tany-assistant-title">{t.title}</h2><p>{t.generated}</p></div>
        <button className="tany-assistant-close" type="button" aria-label={t.close} title={t.close} onClick={onClose}><Icon name="close" size={18}/></button>
      </header>
      {context && <div className="tany-assistant-context" aria-label={`${t.selected} ${context.parcelName}`}>
        <strong>{t.selected}</strong> <span>{context.parcelName || '—'}</span>
      </div>}
      <div className="tany-assistant-messages" aria-live="polite" aria-busy={sending}>
        <article className="tany-assistant-message">
          <strong>{t.title}</strong><p>{context ? t.parcelIntro : t.generalIntro}</p><small>{t.generated}</small>
        </article>
        {messages.map((message, index) => <article className={`tany-assistant-message${message.role === 'user' ? ' is-user' : ''}`} key={`${message.role}-${index}`}>
          <strong>{message.role === 'user' ? (lang === 'fr' ? 'Vous' : 'You') : t.title}</strong><p>{message.content}</p>
          {message.role === 'assistant' && <small>{t.generated}</small>}
        </article>)}
        {sending && <p className="tany-assistant-status" role="status">{t.sending}</p>}
        {lastAssistantMessage?.offerSupport && <p className="tany-assistant-support-prompt">{t.supportPrompt}</p>}
        {error && <p className="tany-assistant-error" role="alert">{error}</p>}
      </div>
      <footer className="tany-assistant-footer">
        <p>{t.supportHint}</p>
        <button className="tany-assistant-support" type="button" onClick={onContactSupport}>{t.support}</button>
        <form onSubmit={(event) => void sendQuestion(event)}>
          <label className="sr-only" htmlFor="tany-assistant-draft">{t.input}</label>
          <input id="tany-assistant-draft" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t.input} maxLength={ASSISTANT_MAX_MESSAGE_CHARS} disabled={sending} />
          <button type="submit" aria-label={t.send} title={t.send} disabled={sending || !draft.trim()}><Icon name="arrow-up" size={18}/></button>
        </form>
      </footer>
    </section>
  </div>
}
