export const ADMIN_RECIPIENT = 'raherimanantsoa.consult@gmail.com'

function responseList(response, label) {
  if (response?.success === false) {
    throw new Error(response.message || `The ${label} request was rejected.`)
  }
  if (!Array.isArray(response?.data)) {
    throw new Error(`The ${label} response did not contain a data list.`)
  }
  return response.data
}

export function conversationsFromResponse(response) {
  return responseList(response, 'conversation list')
}

export function messagesFromResponse(response) {
  return responseList(response, 'conversation messages')
}

export function messageSent(response) {
  if (response?.success !== true) {
    throw new Error(response?.message || 'The message was not accepted.')
  }
  return response
}

export function conversationsRequestBody(email) {
  return { data: email }
}

export function messagesRequestBody(conversation) {
  return { data: conversation?.objet }
}

export function conversationReplyBody(conversation, messages, sender, content) {
  const firstMessage = Array.isArray(messages) ? messages[0] : null
  if (!conversation || !firstMessage || !sender || !String(content ?? '').trim()) {
    throw new Error('Select a conversation with messages and enter a reply before sending.')
  }

  const receiver = sender === firstMessage.sender_id ? firstMessage.receiver_id : firstMessage.sender_id
  if (!receiver) throw new Error('The selected conversation does not identify a reply recipient.')

  return {
    sender_id: sender,
    receiver_id: receiver,
    content,
    uuid_post: firstMessage.uuid_post ?? conversation.uuid_post,
    objet: conversation.objet,
  }
}

export function adminMessageBody(sender, subject, content, uuid) {
  return {
    sender_id: sender,
    receiver_id: ADMIN_RECIPIENT,
    content,
    uuid_post: uuid,
    objet: subject,
  }
}

export function conversationMatchesSearch(conversation, query) {
  const needle = String(query ?? '').trim().toLocaleLowerCase()
  if (!needle) return true
  return [conversation?.main_user, conversation?.objet]
    .some((value) => String(value ?? '').toLocaleLowerCase().includes(needle))
}

function conversationIdentity(conversation) {
  const uuidPost = String(conversation?.uuid_post ?? '').trim()
  const subject = String(conversation?.objet ?? '').trim()
  const participant = String(conversation?.main_user ?? '').trim()
  if (!uuidPost || !subject || !participant) return null
  return JSON.stringify([uuidPost, subject, participant])
}

export function findRefreshedConversation(selected, rows) {
  const identity = conversationIdentity(selected)
  if (!identity || !Array.isArray(rows)) return null
  const matches = rows.filter((row) => conversationIdentity(row) === identity)
  return matches.length === 1 ? matches[0] : null
}

const conversationFlights = new Map()
const messageFlights = new Map()

export function loadConversations(request, email) {
  if (conversationFlights.has(email)) return conversationFlights.get(email)

  const flight = request('/load_object', {
    method: 'POST',
    body: JSON.stringify(conversationsRequestBody(email)),
  }).then(conversationsFromResponse)
    .finally(() => conversationFlights.delete(email))

  conversationFlights.set(email, flight)
  return flight
}

export function loadMessages(request, conversation) {
  const key = String(conversation?.objet ?? '')
  if (!key) return Promise.reject(new Error('The selected conversation has no subject.'))
  if (messageFlights.has(key)) return messageFlights.get(key)

  const flight = request('/load_message', {
    method: 'POST',
    body: JSON.stringify(messagesRequestBody(conversation)),
  }).then(messagesFromResponse)
    .finally(() => messageFlights.delete(key))

  messageFlights.set(key, flight)
  return flight
}

export async function sendConversationReply(request, conversation, messages, sender, content) {
  const body = conversationReplyBody(conversation, messages, sender, content)
  const response = await request('/messages_w', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  messageSent(response)
  return body
}

export async function sendAdminMessage(request, sender, subject, content, uuid) {
  const body = adminMessageBody(sender, subject, content, uuid)
  const response = await request('/messages_w', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  messageSent(response)
  return body
}
