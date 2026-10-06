import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import {
  ADMIN_RECIPIENT,
  conversationMatchesSearch,
  conversationReplyBody,
  conversationsFromResponse,
  loadConversations,
  loadMessages,
  messagesFromResponse,
  sendAdminMessage,
  sendConversationReply,
} from './chatData.js'

const chatSource = await readFile(new URL('./Chat.jsx', import.meta.url), 'utf8')

const conversation = { objet: 'Parcel enquiry', main_user: 'buyer@example.test', uuid_post: 'parcel-42' }
const thread = [
  { sender_id: 'seller@example.test', receiver_id: 'buyer@example.test', uuid_post: 'parcel-42', content: 'Hello' },
  { sender_id: 'buyer@example.test', receiver_id: 'seller@example.test', uuid_post: 'parcel-42', content: 'Thanks' },
]

test('loads conversations through the authenticated React request with the legacy payload', async () => {
  let call
  const rows = [conversation]
  const result = await loadConversations(async (path, options) => {
    call = { path, options }
    return { success: true, data: rows }
  }, 'seller@example.test')

  assert.equal(call.path, '/load_object')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), { data: 'seller@example.test' })
  assert.deepEqual(result, rows)
})

test('loads the conversation list with the React session bearer token', async () => {
  const auth = createAuthService({
    storage: {
      read: () => ({ accessToken: 'chat-test-access', refreshToken: 'chat-test-refresh', user: null }),
      write() {},
      clear() {},
    },
    fetchImpl: async (path, options) => {
      if (path === '/api/current_user') {
        return Response.json({ success: true, data: { user_id: 3, email: 'seller@example.test' } })
      }
      assert.equal(path, '/api/load_object')
      assert.equal(options.headers.get('Authorization'), 'Bearer chat-test-access')
      assert.deepEqual(JSON.parse(options.body), { data: 'seller@example.test' })
      return Response.json({ success: true, data: [conversation] })
    },
  })
  await auth.restore()

  assert.deepEqual(await loadConversations(auth.request, 'seller@example.test'), [conversation])
})

test('loads a selected conversation using its subject and parses the message list', async () => {
  let call
  const result = await loadMessages(async (path, options) => {
    call = { path, options }
    return { success: true, data: thread }
  }, conversation)

  assert.equal(call.path, '/load_message')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), { data: 'Parcel enquiry' })
  assert.deepEqual(result, thread)
})

test('prevents duplicate in-flight loads for a conversation', async () => {
  let calls = 0
  let resolveRequest
  const request = () => {
    calls += 1
    return new Promise((resolve) => { resolveRequest = resolve })
  }
  const first = loadMessages(request, conversation)
  const second = loadMessages(request, conversation)
  resolveRequest({ success: true, data: thread })

  assert.deepEqual(await first, thread)
  assert.deepEqual(await second, thread)
  assert.equal(calls, 1)
})

test('builds and sends a reply to the other participant with the existing parcel/thread fields', async () => {
  let call
  const body = await sendConversationReply(async (path, options) => {
    call = { path, options }
    return { success: true }
  }, conversation, thread, 'buyer@example.test', 'Is it available?')

  assert.equal(call.path, '/messages_w')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), {
    sender_id: 'buyer@example.test',
    receiver_id: 'seller@example.test',
    content: 'Is it available?',
    uuid_post: 'parcel-42',
    objet: 'Parcel enquiry',
  })
  assert.deepEqual(body, JSON.parse(call.options.body))
})

test('sends an admin message with the existing recipient and rejects unsuccessful API results', async () => {
  let sentBody
  const result = await sendAdminMessage(async (path, options) => {
    assert.equal(path, '/messages_w')
    sentBody = JSON.parse(options.body)
    return { success: true }
  }, 'buyer@example.test', 'Account question', 'Please help.', 'message-uuid')

  assert.deepEqual(result, {
    sender_id: 'buyer@example.test',
    receiver_id: ADMIN_RECIPIENT,
    content: 'Please help.',
    uuid_post: 'message-uuid',
    objet: 'Account question',
  })
  assert.deepEqual(sentBody, result)
  await assert.rejects(sendAdminMessage(async () => ({ success: false, message: 'Denied' }), 'buyer@example.test', 'Subject', 'Body', 'id'), /Denied/)
})

test('rejects malformed conversation and message responses and filters by participant or subject', () => {
  assert.throws(() => conversationsFromResponse({ success: true, data: {} }), /data list/)
  assert.throws(() => messagesFromResponse({ success: false, message: 'Denied', data: [] }), /Denied/)
  assert.equal(conversationMatchesSearch(conversation, 'BUYER@EXAMPLE'), true)
  assert.equal(conversationMatchesSearch(conversation, 'enquiry'), true)
  assert.equal(conversationMatchesSearch(conversation, 'unrelated'), false)
  assert.throws(() => conversationReplyBody(conversation, [], 'buyer@example.test', 'Hello'), /with messages/)
})

test('Chat localizes API errors and fallbacks without rendering raw error messages', async () => {
  const englishStart = chatSource.indexOf('  en: {')
  const frenchStart = chatSource.indexOf('  fr: {', englishStart)
  const dictionaryEnd = chatSource.indexOf('function contactName', frenchStart)
  const english = chatSource.slice(englishStart, frenchStart)
  const french = chatSource.slice(frenchStart, dictionaryEnd)

  assert.match(english, /conversationsError: 'Unable to load conversations\.'/)
  assert.match(english, /messagesError: 'Unable to load messages\.'/)
  assert.match(english, /sendMessageError: 'Unable to send this message\.'/)
  assert.match(french, /conversationsError: 'Impossible de charger les conversations\.'/)
  assert.match(french, /messagesError: 'Impossible de charger les messages\.'/)
  assert.match(french, /sendMessageError: 'Impossible d’envoyer ce message\.'/)
  assert.match(english, /adminUuidUnavailable: 'A secure UUID generator is unavailable in this browser\.'/)
  assert.match(french, /adminUuidUnavailable: 'Un générateur d’UUID sécurisé n’est pas disponible dans ce navigateur\.'/)
  assert.match(chatSource, /const t = copy\[lang\]/)
  assert.match(chatSource, /setConversationsError\(failure \|\| \{ fallbackKey: 'conversationsError' \}\)/)
  assert.match(chatSource, /setMessagesError\(failure \|\| \{ fallbackKey: 'messagesError' \}\)/)
  assert.match(chatSource, /setSendError\(failure \|\| \{ fallbackKey: 'sendMessageError' \}\)/)
  assert.match(chatSource, /setAdminError\(failure \|\| \{ fallbackKey: 'sendMessageError' \}\)/)
  assert.match(chatSource, /function chatErrorText\(error, labels, fallbackKey, lang\)/)
  assert.match(chatSource, /apiErrorMessage\(error, lang\) \|\| labels\[error\?\.fallbackKey \|\| fallbackKey\]/)
  assert.doesNotMatch(chatSource, /return apiErrorMessage\(error, lang\) \|\| error\?\.message/)
  assert.match(chatSource, /throw Object\.assign\(new Error\(\), \{ fallbackKey: 'adminUuidUnavailable' \}\)/)

  assert.throws(() => conversationsFromResponse({ success: false, message: 'Backend conversation error' }), /Backend conversation error/)
  assert.throws(() => messagesFromResponse({ success: false, message: 'Backend message error' }), /Backend message error/)
  await assert.rejects(sendConversationReply(async () => ({ success: false, message: 'Backend send error' }), conversation, thread, 'buyer@example.test', 'Reply'), /Backend send error/)
})
