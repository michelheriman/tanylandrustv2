import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import {
  ASSISTANT_MAX_HISTORY_CHARS,
  ASSISTANT_MAX_MESSAGE_CHARS,
  assistantConversationKey,
  hasEffectiveLocalProAssistantAccess,
  sendAssistantMessage,
} from './chatAssistantData.js'

test('assistant access requires a current, coherent effective Pro subscription response in either build', () => {
  const now = Date.parse('2026-10-28T12:00:00Z')
  const pro = {
    mode: 'local', code: 'pro', parcelLimit: 20, canDeleteOwnedParcels: true,
    source: 'subscription', provenance: 'test_grant',
    period: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
  }
  assert.equal(hasEffectiveLocalProAssistantAccess(pro, now), true)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, code: 'free' }, now), false)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, source: 'free_fallback' }, now), false)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, period: { ...pro.period, ends_at: '2026-10-28T11:59:59Z' } }, now), false)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, period: { ...pro.period, starts_at: '2026-10-28T12:00:01Z' } }, now), false)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, parcelLimit: 2 }, now), false)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, mode: 'supabase' }, now), true)
  assert.equal(hasEffectiveLocalProAssistantAccess({ ...pro, mode: 'recorded-profile-account' }, now), false)
})

test('sends only the current user message and bounded user/assistant context', async () => {
  let call
  const result = await sendAssistantMessage(async (path, options) => {
    call = { path, options }
    return { success: true, data: { reply: 'I am Tany AI.', offer_support: true } }
  }, '  What is Tany?  ', [
    { role: 'system', content: 'untrusted system prompt' },
    { role: 'user', content: 'Earlier question' },
    { role: 'assistant', content: 'Earlier answer' },
  ])

  assert.equal(call.path, '/chatbot')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), {
    message: 'What is Tany?',
    history: [
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier answer' },
    ],
  })
  assert.deepEqual(result, { reply: 'I am Tany AI.', offerSupport: true })
})

test('uses the shared authenticated React request and does not expose provider settings', async () => {
  let session = { accessToken: 'test-access-token', refreshToken: 'test-refresh-token', user: null }
  const calls = []
  const auth = createAuthService({
    storage: {
      read: () => session,
      write: (next) => { session = next },
      clear: () => { session = null },
    },
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 12 } })
      if (path === '/api/chatbot') return Response.json({ success: true, data: { reply: 'AI answer', offer_support: false } })
      throw new Error(`Unexpected request ${path}`)
    },
  })
  await auth.restore()
  await sendAssistantMessage(auth.request, 'Question', [])

  assert.equal(calls[1].path, '/api/chatbot')
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'), 'Bearer test-access-token')
  assert.deepEqual(JSON.parse(calls[1].options.body), { message: 'Question', history: [] })
  assert.doesNotMatch(calls[1].options.body, /OPENROUTER|api[_-]?key|model/i)
})

test('bounds messages and context before making a request', async () => {
  let calls = 0
  const request = async () => { calls += 1; return { success: true, data: { reply: 'ok' } } }
  const history = Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: 'x'.repeat(1000),
  }))

  await sendAssistantMessage(request, 'Question', history)
  assert.equal(calls, 1)
  await assert.rejects(sendAssistantMessage(request, 'x'.repeat(ASSISTANT_MAX_MESSAGE_CHARS + 1)))
  assert.equal(calls, 1)

  let body
  await sendAssistantMessage(async (_path, options) => {
    body = JSON.parse(options.body)
    return { success: true, data: { reply: 'ok' } }
  }, 'Question', history)
  assert.ok(body.history.length <= 8)
  assert.ok(body.history.reduce((total, item) => total + item.content.length, 0) <= ASSISTANT_MAX_HISTORY_CHARS)
})

test('rejects invalid assistant protocol responses instead of showing a false answer', async () => {
  await assert.rejects(
    sendAssistantMessage(async () => ({ success: true, data: { reply: '' } }), 'Question'),
    /invalid response/i,
  )
  await assert.rejects(
    sendAssistantMessage(async () => ({ success: false, data: { reply: 'not a success' } }), 'Question'),
    /invalid response/i,
  )
})

test('removes provider safety metadata and rejects metadata-only answers', async () => {
  const result = await sendAssistantMessage(async () => ({
    success: true,
    data: { reply: 'User Safety: safe\nThis public offer has a clearly stated price.\nAssistant Safety: safe', offer_support: false },
  }), 'Question about an offer')
  assert.equal(result.reply, 'This public offer has a clearly stated price.')
  assert.doesNotMatch(result.reply, /User Safety/i)

  await assert.rejects(
    sendAssistantMessage(async () => ({
      success: true,
      data: { reply: 'User Safety: safe\nAssistant Safety: safe', offer_support: false },
    }), 'Question about an offer'),
    /invalid response/i,
  )
})

test('the selected stable parcel id is sent without trusting client-supplied parcel fields', async () => {
  let body
  await sendAssistantMessage(async (_path, options) => {
    body = JSON.parse(options.body)
    return { success: true, data: { reply: 'This is the selected listing.', offer_support: false } }
  }, 'Question about this listing', [], 842)

  assert.deepEqual(body, { message: 'Question about this listing', history: [], parcel_id: 842 })
  assert.equal(assistantConversationKey(null), 'general')
  assert.notEqual(assistantConversationKey(842), assistantConversationKey(843))
})

test('the shared panel is separate from human messages and keeps its AI and Assistance labels', async () => {
  const [chatSource, panelSource, mainSource, marketplaceSource, mainCss] = await Promise.all([
    readFile(new URL('./Chat.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./AssistantPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./Main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./Marketplace.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./Main.css', import.meta.url), 'utf8'),
  ])

  assert.doesNotMatch(chatSource, /assistantOpen|assistantMessages|Assistant IA Tany|Demander/)
  assert.match(panelSource, /role="dialog" aria-modal="true"/)
  assert.ok(panelSource.includes('Réponses générées par IA'))
  assert.ok(panelSource.includes('Contacter l’assistance'))
  assert.match(panelSource, /focusFirstDialogField\(dialogRef\.current\)/)
  assert.match(panelSource, /handleDialogKeydown\(event, dialogRef\.current, onClose\)/)
  assert.match(panelSource, /restoreDialogFocus\(trigger\)/)
  assert.match(panelSource, /failure\?\.status === 403\) onAccessDenied\?\./)
  assert.ok(mainSource.includes('Ouvrir l’assistant IA'))
  assert.ok(mainSource.includes('key={assistantConversationKey(assistantPanel.context?.parcelId ?? null)}'))
  assert.ok(mainSource.includes("title={lang === 'fr' ? 'Ouvrir l’assistant IA'"))
  assert.match(mainSource, /assistantAccess\.status === 'ready' && assistantAccess\.allowed/)
  assert.match(mainSource, /loadAccountOffer\(request, \{ localBackend \}\)/)
  assert.match(mainSource, /hasEffectiveLocalProAssistantAccess\(offer\)/)
  assert.match(mainSource, /if \(!assistantAvailable\) return/)
  assert.doesNotMatch(mainSource, /profiles\.account|user\?\.account/)
  assert.ok(mainSource.includes('<span className="main-assistant-label">'))
  assert.ok(mainCss.includes('.main-assistant-label { display: inline; }'))
  assert.match(mainSource, /<div className="main-header-actions">[\s\S]*?main-assistant-trigger[\s\S]*?<div className="main-account-menu"/)
  assert.match(mainSource, /supportRequestOpen=\{supportRequestOpen\}/)
  assert.match(marketplaceSource, /selectedParcel && <aside className="market-react-selected-detail"/)
  assert.match(marketplaceSource, /onOpenAssistant\(\{ parcelId: selectedParcel\.id, parcelName: selectedParcel\.parcel_name \}/)
  const cardActionsStart = marketplaceSource.indexOf('<div className="market-react-card-actions">')
  const cardActionsEnd = marketplaceSource.indexOf('</div>', cardActionsStart)
  assert.ok(cardActionsStart >= 0 && cardActionsEnd > cardActionsStart)
  assert.doesNotMatch(marketplaceSource.slice(cardActionsStart, cardActionsEnd), /askAssistant|market-react-selected-assistant/)
})
