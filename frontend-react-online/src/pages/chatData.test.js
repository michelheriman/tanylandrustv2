import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createAuthService } from '../auth/authService.js'
import {
  ADMIN_RECIPIENT,
  conversationMatchesSearch,
  conversationDisplay,
  conversationReplyBody,
  conversationsFromResponse,
  findRefreshedConversation,
  loadMessagePage,
  loadConversations,
  loadMessages,
  messagesFromResponse,
  otherUserEmail,
  participantDisplayName,
  sendAdminMessage,
  sendConversationReply,
} from './chatData.js'

const chatSource = await readFile(new URL('./Chat.jsx', import.meta.url), 'utf8')

const conversation = { objet: 'Parcel enquiry', main_user: 'buyer@example.test', uuid_post: 'parcel-42' }
const localConversation = {
  conversation_id: '73',
  current_profile_id: '12',
  other_profile_id: '27',
  other_user_email: 'seller@example.test',
  other_user_profile: { username: 'Seller' },
  parcel_name: 'Parcel 42',
}
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
  assert.deepEqual(result, { conversations: rows, unlinkedHistoryExcluded: false })
})

test('resolves the other participant when the signed-in user is the sender or receiver', () => {
  assert.equal(otherUserEmail({
    sender_id: 'signed-in@example.test',
    receiver_id: 'other@example.test',
  }, 'signed-in@example.test'), 'other@example.test')

  assert.equal(otherUserEmail({
    sender_id: 'other@example.test',
    receiver_id: 'signed-in@example.test',
  }, 'signed-in@example.test'), 'other@example.test')
})

test('uses the other participant username, then name, then email as display fallback', () => {
  assert.equal(participantDisplayName({ username: 'michel-raherimanantsoa', name: 'Michel' }, 'michel@example.test'), 'michel-raherimanantsoa')
  assert.equal(participantDisplayName({ name: 'Michel' }, 'michel@example.test'), 'Michel')
  assert.equal(participantDisplayName({}, 'michel@example.test'), 'michel@example.test')
})

test('conversation title excludes the signed-in user and uses the parcel name instead of objet', () => {
  const row = {
    main_user: 'signed-in@example.test',
    objet: 'buyer@example.test | Ampefy 2 | signed-in@example.test',
  }
  const display = conversationDisplay(row, 'signed-in@example.test')

  assert.equal(display.title, 'buyer@example.test')
  assert.equal(display.subtitle, 'Ampefy 2')
  assert.notEqual(display.title, 'signed-in@example.test')
  assert.notEqual(display.title, row.objet)
  assert.match(chatSource, /<strong>\{display\.title\}<\/strong>/)
  assert.match(chatSource, /<small>\{display\.subtitle\}<\/small>/)
  assert.doesNotMatch(chatSource, /<strong>\{[^}]*\.objet[^}]*<\/strong>/)
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

  assert.deepEqual(await loadConversations(auth.request, 'seller@example.test'), {
    conversations: [conversation],
    unlinkedHistoryExcluded: false,
  })
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

test('loads local conversation messages by stable ID rather than any legacy grouping field', async () => {
  let call
  const result = await loadMessages(async (path, options) => {
    call = { path, options }
    return { success: true, data: thread }
  }, { ...localConversation, objet: 'same legacy subject', uuid_post: 'same legacy UUID' })

  assert.equal(call.path, '/load_message')
  assert.deepEqual(JSON.parse(call.options.body), { conversation_id: '73' })
  assert.deepEqual(result, thread)
})

test('requests older local history by stable message cursor and returns pagination metadata', async () => {
  let call
  const result = await loadMessagePage(async (path, options) => {
    call = { path, options }
    return {
      success: true,
      data: thread,
      pagination: { has_more: true, older_cursor: '12' },
    }
  }, localConversation, { beforeId: '12' })

  assert.equal(call.path, '/load_message')
  assert.deepEqual(JSON.parse(call.options.body), { conversation_id: '73', before_id: '12' })
  assert.deepEqual(result, {
    messages: thread,
    pagination: { has_more: true, older_cursor: '12' },
  })
})

test('uses conversation_id as selection identity and refuses malformed local IDs', async () => {
  const selected = { ...localConversation, objet: 'old subject', uuid_post: 'old uuid' }
  const refreshed = { ...localConversation, objet: 'changed legacy subject', uuid_post: 'changed legacy uuid' }
  assert.strictEqual(findRefreshedConversation(selected, [refreshed]), refreshed)
  await assert.rejects(loadMessages(async () => ({ success: true, data: [] }), {
    conversation_id: 'not-a-bigint',
  }), /invalid ID/)
  assert.match(chatSource, /conversation_id != null/)
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

test('reconciles a selected conversation to its refreshed row without assuming subject uniqueness', () => {
  const selected = { ...conversation }
  const refreshedSameSubject = { ...conversation, uuid_post: 'another-parcel', main_user: 'other@example.test' }
  const refreshedSelected = { ...conversation }
  const rows = [refreshedSameSubject, refreshedSelected]

  assert.strictEqual(findRefreshedConversation(selected, rows), refreshedSelected)
  assert.equal(findRefreshedConversation(selected, [refreshedSameSubject]), null)
  assert.equal(findRefreshedConversation(selected, [refreshedSelected, { ...refreshedSelected }]), null)
  assert.equal(findRefreshedConversation({ objet: 'Parcel enquiry', main_user: 'buyer@example.test' }, rows), null)
  assert.match(chatSource, /findRefreshedConversation\(selectedConversationRef\.current, rows\)/)
  assert.match(chatSource, /setSelectedConversation\(refreshedSelection\)/)
  assert.match(chatSource, /if \(!selectedConversation\) return undefined/)
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

test('builds and sends a local reply with the selected thread and participant IDs', async () => {
  let call
  const persisted = {
    id: '44', conversation_id: '73', sender_profile_id: '12', receiver_profile_id: '27',
    sender_id: 'buyer@example.test', receiver_id: 'seller@example.test', content: 'Reply',
    created_at: '2026-07-01T10:00:00+00:00',
  }
  const result = await sendConversationReply(async (path, options) => {
    call = { path, options }
    return { success: true, data: [persisted] }
  }, localConversation, [], 'buyer@example.test', 'Reply')

  assert.equal(call.path, '/messages_w')
  assert.deepEqual(JSON.parse(call.options.body), {
    conversation_id: '73',
    sender_profile_id: '12',
    receiver_profile_id: '27',
    sender_id: 'buyer@example.test',
    receiver_id: 'seller@example.test',
    content: 'Reply',
  })
  assert.deepEqual(result, persisted)
})

test('sends a support reply by thread ID without client supplied sender or recipient identities', async () => {
  const supportConversation = {
    conversation_id: '88',
    conversation_type: 'support',
    current_profile_id: '12',
    other_profile_id: null,
    other_user_email: 'Assistance Tany',
    other_user_profile: { username: 'Assistance Tany' },
    parcel_name: 'Account access',
  }
  const body = conversationReplyBody(supportConversation, [], 'client@example.test', 'Please help')
  assert.deepEqual(body, { conversation_id: '88', content: 'Please help' })
  assert.deepEqual(conversationDisplay(supportConversation, 'client@example.test'), {
    email: 'Assistance Tany', title: 'Assistance Tany', subtitle: 'Account access',
  })
})

test('local thread display and list explain that unlinked history is excluded without merging it', async () => {
  assert.deepEqual(conversationDisplay(localConversation, 'buyer@example.test'), {
    email: 'seller@example.test', title: 'Seller', subtitle: 'Parcel 42',
  })
  let result
  result = await loadConversations(async () => ({
    success: true,
    data: [localConversation],
    unlinked_history_excluded: true,
  }), 'buyer@example.test')
  assert.equal(result.unlinkedHistoryExcluded, true)
  assert.deepEqual(result.conversations, [localConversation])
  assert.match(chatSource, /unlinkedHistory: 'Les anciens messages sans lien de conversation sont conservés à part/)
  assert.match(chatSource, /role="note">\{t\.unlinkedHistory\}/)
  assert.match(chatSource, /conversation\.conversation_id != null/)
  assert.match(chatSource, /String\(message\.sender_profile_id\) === String\(selectedConversation\.current_profile_id\)/)
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

test('sends a local admin request without client supplied identity fields', async () => {
  let sentBody
  const result = await sendAdminMessage(async (path, options) => {
    assert.equal(path, '/messages_w')
    sentBody = JSON.parse(options.body)
    return { success: true }
  }, 'buyer@example.test', 'Account question', 'Please help.', undefined, { localBackend: true })

  assert.deepEqual(result, {
    support_request: true,
    subject: 'Account question',
    content: 'Please help.',
  })
  assert.deepEqual(sentBody, result)
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
