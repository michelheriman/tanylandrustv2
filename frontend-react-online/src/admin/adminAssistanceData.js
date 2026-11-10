import { ApiError } from '../api/client.js'

export const ADMIN_ASSISTANCE_PATH = '/admin/assistance'
export const ADMIN_ASSISTANCE_MESSAGE_MAX_LENGTH = 10000

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isTimestamp(value, nullable = false) {
  return (nullable && value === null) ||
    (typeof value === 'string' && !Number.isNaN(Date.parse(value)))
}

function isPerson(value, { email = false } = {}) {
  return value === null || (isRecord(value) && typeof value.profile_id === 'string' &&
    (value.name === null || typeof value.name === 'string') &&
    (value.username === null || typeof value.username === 'string') &&
    (!email || value.email === undefined || value.email === null || typeof value.email === 'string'))
}

function isPagination(value) {
  return isRecord(value) && ['page', 'per_page', 'total', 'pages'].every((key) =>
    Number.isInteger(value[key]) && value[key] >= (key === 'total' ? 0 : 1))
}

function isPreview(value) {
  return isRecord(value) && typeof value.conversation_id === 'string' &&
    typeof value.subject === 'string' && ['open', 'resolved'].includes(value.status) &&
    isPerson(value.customer, { email: true }) && value.customer !== null &&
    isPerson(value.assigned_admin) && isTimestamp(value.created_at) &&
    isTimestamp(value.updated_at) && isTimestamp(value.resolved_at, true) &&
    (value.last_message === null || (isRecord(value.last_message) &&
      typeof value.last_message.content === 'string' && isTimestamp(value.last_message.created_at)))
}

function isDetail(value) {
  if (!isRecord(value) || !isPreview({
    conversation_id: value.conversation_id,
    subject: value.subject,
    status: value.status,
    customer: value.customer,
    assigned_admin: value.assigned_admin,
    created_at: value.created_at,
    updated_at: value.updated_at,
    resolved_at: value.resolved_at,
    last_message: null,
  }) || typeof value.current_admin_profile_id !== 'string' ||
      !Array.isArray(value.messages) || !Array.isArray(value.assignment_history) ||
      !Array.isArray(value.active_admins)) return false

  const validMessage = (message) => isRecord(message) && typeof message.id === 'string' &&
    typeof message.author_profile_id === 'string' && ['customer', 'admin'].includes(message.author_role) &&
    isPerson(message.author, { email: true }) && typeof message.content === 'string' &&
    isTimestamp(message.created_at)
  const validHistory = (entry) => isRecord(entry) && typeof entry.id === 'string' &&
    isPerson(entry.previous_admin) && isPerson(entry.new_admin) && entry.new_admin !== null &&
    isPerson(entry.changed_by) && entry.changed_by !== null &&
    ['take', 'reassign'].includes(entry.change_kind) && isTimestamp(entry.changed_at)

  return value.messages.every(validMessage) && value.assignment_history.every(validHistory) &&
    value.active_admins.every((admin) => isPerson(admin) && admin !== null)
}

function requireRequest(request) {
  if (typeof request !== 'function') {
    throw new ApiError('protocol', 'Le chargement de la boîte Assistance est indisponible.')
  }
}

function requireSuccess(response, label) {
  if (response?.success !== true || !isRecord(response.data)) {
    throw new ApiError('protocol', `Le serveur a renvoyé une réponse ${label} invalide.`)
  }
  return response.data
}

export async function loadAdminAssistance(request, { status = 'open', page = 1, perPage = 20 } = {}) {
  requireRequest(request)
  if (!['all', 'open', 'resolved'].includes(status) || !Number.isInteger(page) || page < 1 ||
      !Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new ApiError('protocol', 'Les filtres de la boîte Assistance sont invalides.')
  }
  const params = new URLSearchParams({ status, page: String(page), per_page: String(perPage) })
  const response = await request(`${ADMIN_ASSISTANCE_PATH}?${params}`, { method: 'GET' })
  if (response?.success !== true || !Array.isArray(response.data) ||
      !response.data.every(isPreview) || !isPagination(response.pagination) || response.status !== status) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une liste Assistance invalide.')
  }
  return { data: response.data, pagination: response.pagination, status }
}

export async function loadAdminAssistanceDetail(request, id) {
  requireRequest(request)
  if (id === undefined || id === null || !/^[1-9]\d*$/.test(String(id))) {
    throw new ApiError('protocol', 'La référence de la demande Assistance est invalide.')
  }
  const response = await request(`${ADMIN_ASSISTANCE_PATH}/${encodeURIComponent(String(id))}`, { method: 'GET' })
  if (response?.success !== true || !isDetail(response.data)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé un détail Assistance invalide.')
  }
  return response.data
}

async function postAction(request, id, action, body = {}) {
  requireRequest(request)
  if (id === undefined || id === null || !/^[1-9]\d*$/.test(String(id))) {
    throw new ApiError('protocol', 'La référence de la demande Assistance est invalide.')
  }
  const response = await request(
    `${ADMIN_ASSISTANCE_PATH}/${encodeURIComponent(String(id))}/${action}`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return requireSuccess(response, 'action Assistance')
}

export async function takeAdminAssistance(request, id) {
  const data = await postAction(request, id, 'take')
  if (String(data.conversation_id) !== String(id) || typeof data.assigned_admin_profile_id !== 'string') {
    throw new ApiError('protocol', 'Le serveur a renvoyé une prise en charge invalide.')
  }
  return data
}

export async function reassignAdminAssistance(request, id, assigneeProfileId) {
  if (!/^[1-9]\d*$/.test(String(assigneeProfileId ?? ''))) {
    throw new ApiError('protocol', 'Sélectionnez un administrateur actif.')
  }
  const data = await postAction(request, id, 'reassign', { assignee_profile_id: String(assigneeProfileId) })
  if (String(data.conversation_id) !== String(id) ||
      String(data.assigned_admin_profile_id) !== String(assigneeProfileId)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une réattribution invalide.')
  }
  return data
}

export async function replyAdminAssistance(request, id, content) {
  if (typeof content !== 'string' || !content.trim() || content.trim().length > ADMIN_ASSISTANCE_MESSAGE_MAX_LENGTH) {
    throw new ApiError('protocol', 'Le message doit contenir entre 1 et 10000 caractères.')
  }
  const data = await postAction(request, id, 'reply', { content: content.trim() })
  if (String(data.conversation_id) !== String(id) || !isRecord(data.message) ||
      typeof data.message.id !== 'string' || data.message.author_role !== 'admin' ||
      typeof data.message.author_profile_id !== 'string' || typeof data.message.content !== 'string') {
    throw new ApiError('protocol', 'Le serveur a renvoyé un message Assistance invalide.')
  }
  return data.message
}

export async function resolveAdminAssistance(request, id) {
  const data = await postAction(request, id, 'resolve')
  if (String(data.conversation_id) !== String(id) || data.status !== 'resolved') {
    throw new ApiError('protocol', 'Le serveur a renvoyé un état Assistance invalide.')
  }
  return data
}

export const assistanceValidators = Object.freeze({ isPreview, isDetail, isPagination })
