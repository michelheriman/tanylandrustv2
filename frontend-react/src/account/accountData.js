import { ApiError } from '../api/client.js'

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function textOrEmpty(value) {
  return typeof value === 'string' ? value : ''
}

export async function loadAccountProfile(request) {
  const response = await request('/current_user')
  const profile = response?.data
  if (response?.success !== true || !isRecord(profile)) {
    throw new ApiError('protocol', 'Profile response was incomplete.')
  }
  return {
    name: textOrEmpty(profile.name),
    username: textOrEmpty(profile.username),
    email: textOrEmpty(profile.email),
  }
}

const expectedPlan = {
  free: { limit: 2, canDelete: false },
  pro: { limit: 20, canDelete: true },
}
const knownProvenance = new Set(['manual_grant', 'legacy_migration', 'test_grant'])

function validPeriod(period) {
  if (period === null) return true
  if (!isRecord(period) || typeof period.starts_at !== 'string' || !Number.isFinite(Date.parse(period.starts_at))) return false
  return period.ends_at === null || (typeof period.ends_at === 'string' && Number.isFinite(Date.parse(period.ends_at)))
}

function normalizeLocalOffer(response) {
  const data = response?.data
  const plan = data?.code
  const expected = expectedPlan[plan]
  if (response?.success !== true || !isRecord(data) || !expected ||
      data.parcel_limit !== expected.limit ||
      data.can_delete_owned_parcels !== expected.canDelete ||
      !Number.isSafeInteger(data.active_parcel_count) || data.active_parcel_count < 0 ||
      !['free_fallback', 'subscription'].includes(data.source) ||
      !(data.provenance === null || knownProvenance.has(data.provenance)) ||
      !validPeriod(data.subscription_period) ||
      (data.source === 'free_fallback' && (data.provenance !== null || data.subscription_period !== null)) ||
      (data.source === 'subscription' && (data.provenance === null || data.subscription_period === null))) {
    throw new ApiError('protocol', 'Effective offer response was incomplete.')
  }
  return {
    mode: 'local',
    code: plan,
    parcelLimit: data.parcel_limit,
    parcelCount: data.active_parcel_count,
    canDeleteOwnedParcels: data.can_delete_owned_parcels,
    source: data.source,
    provenance: data.provenance,
    period: data.subscription_period,
  }
}

async function loadSupabaseOffer(request) {
  // Supabase still exposes the existing profile.account contract. It is shown
  // as a recorded value only; no local subscription or billing facts are inferred.
  const response = await request('/account')
  if (response?.success !== true || !Array.isArray(response.data) || response.data.length !== 1 ||
      !isRecord(response.data[0]) || typeof response.data[0].account !== 'string' || !response.data[0].account.trim()) {
    throw new ApiError('protocol', 'Recorded offer response was incomplete.')
  }
  return { mode: 'supabase', recordedPlan: response.data[0].account.trim() }
}

export async function loadAccountOffer(request, { localBackend }) {
  if (typeof request !== 'function') throw new ApiError('protocol', 'Account data is unavailable.')
  if (!localBackend) return loadSupabaseOffer(request)
  return normalizeLocalOffer(await request('/account/offer'))
}
