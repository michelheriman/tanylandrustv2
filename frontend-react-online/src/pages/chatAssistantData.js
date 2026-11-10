export const ASSISTANT_MAX_MESSAGE_CHARS = 2000
export const ASSISTANT_MAX_HISTORY_MESSAGES = 8
export const ASSISTANT_MAX_HISTORY_CHARS = 6000

const providerSafetyMetadataLine = /^\s*(?:(?:user|assistant)\s+)?safety\s*:\s*(?:safe|unsafe|allowed|blocked|filtered)\s*[.!]?\s*$/i
const validProvenance = new Set(['manual_grant', 'legacy_migration', 'test_grant'])

export function hasEffectiveLocalProAssistantAccess(offer, now = Date.now()) {
  if (!['local', 'supabase'].includes(offer?.mode) || offer.code !== 'pro' || offer.source !== 'subscription' ||
      offer.parcelLimit !== 20 || offer.canDeleteOwnedParcels !== true ||
      !validProvenance.has(offer.provenance)) return false
  const startsAt = Date.parse(offer.period?.starts_at ?? '')
  const endsAt = offer.period?.ends_at == null ? null : Date.parse(offer.period.ends_at)
  return Number.isFinite(startsAt) && startsAt <= now &&
    (endsAt === null || (Number.isFinite(endsAt) && now < endsAt))
}

export function assistantConversationKey(parcelId = null) {
  return parcelId == null ? 'general' : `parcel:${String(parcelId)}`
}

export async function sendAssistantMessage(request, message, history = [], parcelId = null) {
  const content = typeof message === 'string' ? message.trim() : ''
  if (!content) throw new Error('A message is required.')
  if (content.length > ASSISTANT_MAX_MESSAGE_CHARS) throw new Error('The message is too long.')

  const candidates = Array.isArray(history)
    ? history
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-ASSISTANT_MAX_HISTORY_MESSAGES)
      .map(({ role, content: text }) => ({ role, content: text.slice(0, ASSISTANT_MAX_MESSAGE_CHARS) }))
    : []
  const context = []
  let contextChars = 0
  for (const item of [...candidates].reverse()) {
    if (contextChars + item.content.length > ASSISTANT_MAX_HISTORY_CHARS) break
    context.push(item)
    contextChars += item.content.length
  }
  context.reverse()
  const payload = { message: content, history: context }
  if (parcelId != null) payload.parcel_id = parcelId
  const response = await request('/chatbot', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = response?.data
  const reply = typeof data?.reply === 'string'
    ? data.reply.split(/\r?\n/).filter((line) => !providerSafetyMetadataLine.test(line)).join('\n').trim()
    : ''
  if (response?.success !== true || !data || !reply) {
    throw Object.assign(new Error('The assistant returned an invalid response.'), { fallbackKey: 'assistantError' })
  }
  return {
    reply,
    offerSupport: data.offer_support === true,
  }
}
