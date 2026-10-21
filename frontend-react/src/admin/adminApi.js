import { ApiError } from '../api/client.js'
import {
  ADMIN_REGISTRATION_DEFAULT_MONTHS,
  ADMIN_REGISTRATION_MAX_MONTHS,
  isValidAdminDashboardMetrics,
  isValidAdminRegistrationDashboard,
} from './adminDashboardData.js'

export const ADMIN_ME_PATH = '/admin/me'
export const ADMIN_PARCELS_PATH = '/admin/parcels'
export const ADMIN_USERS_PATH = '/admin/users'
export const ADMIN_CONVERSATIONS_PATH = '/admin/conversations'
export const ADMIN_DASHBOARD_REGISTRATIONS_PATH = '/admin/dashboard/registrations'
export const ADMIN_DASHBOARD_METRICS_PATH = '/admin/dashboard/metrics'
export const ADMIN_CONVERSATION_REPORTS_PATH = '/admin/conversation-reports'
export const ADMIN_CONVERSATION_REPORT_MAX_LENGTH = 2000
export const ADMIN_PARCEL_VISIBILITY_REASON_MAX_LENGTH = 1000

// `request` is the shared AuthService request method. It attaches the saved
// Bearer and retries one 401 through the existing refresh-token flow.
export async function loadAdminIdentity(request) {
  if (typeof request !== 'function') {
    throw new ApiError('protocol', 'La vérification administrateur est indisponible.')
  }

  const response = await request(ADMIN_ME_PATH, { method: 'GET' })
  const data = response?.data
  if (!data || typeof data !== 'object' || !data.profile || typeof data.profile !== 'object' ||
      data.profile.id === undefined || !data.admin || data.admin.role !== 'admin') {
    throw new ApiError('protocol', 'Le serveur a renvoyé une réponse administrateur invalide.')
  }

  return {
    profile: {
      id: data.profile.id,
      name: typeof data.profile.name === 'string' ? data.profile.name : '',
      username: typeof data.profile.username === 'string' ? data.profile.username : '',
    },
    admin: { role: 'admin' },
  }
}

export async function loadAdminDashboardRegistrations(request, months = ADMIN_REGISTRATION_DEFAULT_MONTHS) {
  if (typeof request !== 'function' || !Number.isInteger(months) ||
      months < 1 || months > ADMIN_REGISTRATION_MAX_MONTHS) {
    throw new ApiError('protocol', 'La période des inscriptions est invalide.')
  }

  const params = new URLSearchParams({ months: String(months) })
  const response = await request(
    `${ADMIN_DASHBOARD_REGISTRATIONS_PATH}?${params.toString()}`,
    { method: 'GET' },
  )
  if (!isValidAdminRegistrationDashboard(response?.data)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé les statistiques d’inscription dans un format invalide.')
  }
  return response.data
}

export async function loadAdminDashboardMetrics(request) {
  if (typeof request !== 'function') {
    throw new ApiError('protocol', 'Le chargement du tableau de bord est indisponible.')
  }
  const response = await request(ADMIN_DASHBOARD_METRICS_PATH, { method: 'GET' })
  if (!isValidAdminDashboardMetrics(response?.data)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé des indicateurs administrateur invalides.')
  }
  return response.data
}

export async function loadAdminParcels(request, query = {}) {
  if (typeof request !== 'function') {
    throw new ApiError('protocol', 'Le chargement des parcelles est indisponible.')
  }
  const params = new URLSearchParams()
  for (const key of [
    'page', 'per_page', 'q', 'sort', 'direction', 'date_from', 'date_to',
    'sell_category', 'visibility', 'contacted_from', 'contacted_to',
  ]) {
    const value = query[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value))
    }
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  const response = await request(`${ADMIN_PARCELS_PATH}${suffix}`, { method: 'GET' })
  if (!Array.isArray(response?.data) || !isValidPagination(response?.pagination)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une liste de parcelles invalide.')
  }
  return { data: response.data, pagination: response.pagination }
}

export async function loadAdminParcel(request, id) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de parcelle est invalide.')
  }
  const response = await request(`${ADMIN_PARCELS_PATH}/${encodeURIComponent(String(id))}`, { method: 'GET' })
  if (!response?.data || typeof response.data !== 'object' || Array.isArray(response.data) || response.data.id === undefined) {
    throw new ApiError('protocol', 'Le serveur a renvoyé un détail de parcelle invalide.')
  }
  return response.data
}

async function changeAdminParcelVisibility(request, id, action, reason) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de parcelle est invalide.')
  }
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > ADMIN_PARCEL_VISIBILITY_REASON_MAX_LENGTH) {
    throw new ApiError('protocol', 'Une raison de 1 à 1000 caractères est requise.')
  }
  const response = await request(
    `${ADMIN_PARCELS_PATH}/${encodeURIComponent(String(id))}/visibility/${action}`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
  )
  const data = response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      String(data.parcel_id) !== String(id) || data.action !== action ||
      data.is_hidden !== (action === 'hide') || typeof data.reason !== 'string' ||
      typeof data.admin_id !== 'string' || typeof data.decision_id !== 'string' ||
      typeof data.created_at !== 'string' || Number.isNaN(Date.parse(data.created_at))) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une décision de visibilité invalide.')
  }
  return data
}

export function hideAdminParcel(request, id, reason) {
  return changeAdminParcelVisibility(request, id, 'hide', reason)
}

export function restoreAdminParcel(request, id, reason) {
  return changeAdminParcelVisibility(request, id, 'restore', reason)
}

export async function loadAdminUsers(request, query = {}) {
  if (typeof request !== 'function') {
    throw new ApiError('protocol', 'Le chargement des utilisateurs est indisponible.')
  }
  const params = new URLSearchParams()
  for (const key of ['page', 'per_page', 'q', 'sort', 'direction', 'date_from', 'date_to']) {
    const value = query[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value))
    }
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  const response = await request(`${ADMIN_USERS_PATH}${suffix}`, { method: 'GET' })
  if (!Array.isArray(response?.data) || !isValidPagination(response?.pagination)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une liste d’utilisateurs invalide.')
  }
  return { data: response.data, pagination: response.pagination }
}

export async function loadAdminUser(request, id, query = {}) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de profil est invalide.')
  }
  const params = new URLSearchParams()
  for (const key of ['page', 'per_page']) {
    const value = query[key] ?? (key === 'page' ? 1 : 20)
    params.set(key, String(value))
  }
  const response = await request(
    `${ADMIN_USERS_PATH}/${encodeURIComponent(String(id))}?${params.toString()}`,
    { method: 'GET' },
  )
  if (!response?.data || typeof response.data !== 'object' || Array.isArray(response.data) ||
      response.data.id === undefined || !isValidParcelAssociation(response.data.parcel_association) ||
      !isValidEffectiveOffer(response.data.effective_offer)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé un détail utilisateur invalide.')
  }
  return response.data
}

export async function loadAdminConversations(request, query = {}) {
  if (typeof request !== 'function') {
    throw new ApiError('protocol', 'Le chargement des conversations est indisponible.')
  }
  const params = new URLSearchParams()
  for (const key of ['page', 'per_page', 'awaiting_first_response']) {
    if (key === 'awaiting_first_response' && query[key] === undefined) continue
    const value = query[key] ?? (key === 'page' ? 1 : 20)
    params.set(key, String(value))
  }
  const response = await request(`${ADMIN_CONVERSATIONS_PATH}?${params.toString()}`, { method: 'GET' })
  if (!Array.isArray(response?.data) || !isValidPagination(response?.pagination) ||
      response.unlinked_history_excluded !== true ||
      response.data.some((conversation) => !isValidConversationPreview(conversation))) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une liste de conversations invalide.')
  }
  return {
    data: response.data,
    pagination: response.pagination,
    unlinkedHistoryExcluded: true,
  }
}

export async function loadAdminConversationReportList(request, query = {}) {
  if (typeof request !== 'function' || !query.created_from || !query.created_to) {
    throw new ApiError('protocol', 'La période des constats administrateur est invalide.')
  }
  const params = new URLSearchParams()
  for (const key of ['created_from', 'created_to', 'page', 'per_page']) {
    const value = query[key] ?? (key === 'page' ? 1 : key === 'per_page' ? 20 : '')
    if (String(value).trim()) params.set(key, String(value))
  }
  const response = await request(`${ADMIN_CONVERSATION_REPORTS_PATH}?${params.toString()}`, { method: 'GET' })
  if (!Array.isArray(response?.data) || !isValidPagination(response?.pagination) ||
      !isValidPeriodPayload(response?.period) ||
      Date.parse(response.period.start) !== Date.parse(query.created_from) ||
      Date.parse(response.period.end) !== Date.parse(query.created_to) ||
      response.data.some((report) => !isValidDashboardConversationReport(report))) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une liste de constats invalide.')
  }
  return { data: response.data, pagination: response.pagination, period: response.period }
}

export async function loadAdminConversation(request, id) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de conversation est invalide.')
  }
  const response = await request(
    `${ADMIN_CONVERSATIONS_PATH}/${encodeURIComponent(String(id))}`,
    { method: 'GET' },
  )
  if (!response?.data || typeof response.data !== 'object' || Array.isArray(response.data) ||
      response.unlinked_history_excluded !== true || !isValidConversationDetail(response.data)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé un détail de conversation invalide.')
  }
  return { ...response.data, unlinkedHistoryExcluded: true }
}

export async function loadAdminConversationReports(request, id) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de conversation est invalide.')
  }
  const response = await request(
    `${ADMIN_CONVERSATIONS_PATH}/${encodeURIComponent(String(id))}/reports`,
    { method: 'GET' },
  )
  if (!Array.isArray(response?.data) || !response.data.every(isValidConversationReport)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé une liste de signalements invalide.')
  }
  return response.data
}

export async function createAdminConversationReport(request, id, finding) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de conversation est invalide.')
  }
  if (typeof finding !== 'string' || !finding.trim() || finding.trim().length > ADMIN_CONVERSATION_REPORT_MAX_LENGTH) {
    throw new ApiError('protocol', 'Le constat doit contenir entre 1 et 2000 caractères.')
  }
  const response = await request(
    `${ADMIN_CONVERSATIONS_PATH}/${encodeURIComponent(String(id))}/reports`,
    { method: 'POST', body: JSON.stringify({ finding: finding.trim() }) },
  )
  if (!isValidConversationReport(response?.data)) {
    throw new ApiError('protocol', 'Le serveur a renvoyé un signalement invalide.')
  }
  return response.data
}

function isNullableString(value) {
  return value === null || typeof value === 'string'
}

function isValidConversationParticipant(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.profile_id === 'string' && isNullableString(value.name) && isNullableString(value.username)
}

function isValidConversationPreview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.conversation_id !== 'string' || !isNullableString(value.parcel_id) ||
      !isNullableString(value.parcel_name) || !isNullableString(value.created_at) ||
      !Array.isArray(value.participants) || !value.participants.every(isValidConversationParticipant)) return false
  if (value.last_message === null) return true
  return value.last_message && typeof value.last_message === 'object' && !Array.isArray(value.last_message) &&
    typeof value.last_message.id === 'string' && isNullableString(value.last_message.created_at) &&
    isNullableString(value.last_message.content)
}

function isValidConversationDetail(value) {
  const conversation = value.conversation
  return conversation && typeof conversation === 'object' && !Array.isArray(conversation) &&
    typeof conversation.conversation_id === 'string' && isNullableString(conversation.parcel_id) &&
    isNullableString(conversation.parcel_name) && isNullableString(conversation.created_at) &&
    Array.isArray(value.participants) && value.participants.every(isValidConversationParticipant) &&
    Array.isArray(value.messages) && value.messages.every((message) =>
      message && typeof message === 'object' && !Array.isArray(message) &&
      typeof message.id === 'string' && isNullableString(message.created_at) &&
      isNullableString(message.sender_profile_id) && isNullableString(message.receiver_profile_id) &&
      isNullableString(message.content))
}

function isValidConversationReport(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.id === 'string' && typeof value.finding === 'string' &&
    value.finding.trim().length > 0 && value.finding.length <= ADMIN_CONVERSATION_REPORT_MAX_LENGTH &&
    typeof value.created_at === 'string' && !Number.isNaN(Date.parse(value.created_at))
}

function isValidPeriodPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.start === 'string' && typeof value.end === 'string' &&
    !Number.isNaN(Date.parse(value.start)) && !Number.isNaN(Date.parse(value.end)) &&
    Date.parse(value.start) < Date.parse(value.end)
}

function isValidDashboardConversationReport(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.id === 'string' && typeof value.conversation_id === 'string' &&
    typeof value.finding === 'string' && value.finding.trim().length > 0 &&
    typeof value.created_at === 'string' && !Number.isNaN(Date.parse(value.created_at)) &&
    isNullableString(value.parcel_id) && isNullableString(value.parcel_name)
}

function isValidParcelAssociation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.available !== 'boolean' || !Array.isArray(value.data)) return false
  if (!value.available) {
    return value.total_associated === null && value.for_sale_count === null &&
      value.data.length === 0 && value.pagination === null
  }
  if (!Number.isSafeInteger(value.total_associated) || value.total_associated < 0 ||
      !Number.isSafeInteger(value.for_sale_count) || value.for_sale_count < 0 ||
      value.for_sale_count > value.total_associated || !isValidPagination(value.pagination) ||
      value.pagination.total !== value.total_associated || value.data.length > value.pagination.per_page) return false
  return value.data.every((parcel) => parcel && typeof parcel === 'object' && !Array.isArray(parcel) &&
    typeof parcel.id === 'string' &&
    ['parcel_name', 'location_name', 'sell_category', 'created_at'].every((key) =>
      parcel[key] === null || typeof parcel[key] === 'string'))
}

function isValidEffectiveOffer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value.code === 'free') {
    return value.parcel_limit === 2 && value.can_delete_owned_parcels === false
  }
  if (value.code === 'pro') {
    return value.parcel_limit === 20 && value.can_delete_owned_parcels === true
  }
  return false
}

function isValidPagination(value) {
  return value && typeof value === 'object' &&
    ['page', 'per_page', 'total', 'pages'].every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0) &&
    value.page >= 1 && value.per_page >= 1 && value.pages >= 1
}

export function getAdminFailureKind(error) {
  if (error?.status === 403) return 'denied'
  if (error?.status === 401 || error?.kind === 'auth') return 'anonymous'
  return 'unavailable'
}
