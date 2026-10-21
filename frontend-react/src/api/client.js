export class ApiError extends Error {
  constructor(kind, message, status = 0, details = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.code = details.code ?? null
    this.quota = details.quota ?? null
  }
}

const BACKEND_ORIGIN = 'http://127.0.0.1:5000'
const STATIC_DEV_PORTS = new Set(['5500', '5501'])

export function apiUrl(path, location = globalThis.location) {
  // Live Server does not proxy the other API routes, while Vite does.
  const isLocalStaticServer = location &&
    ['localhost', '127.0.0.1'].includes(location.hostname) &&
    STATIC_DEV_PORTS.has(location.port)
  return isLocalStaticServer ? `${BACKEND_ORIGIN}${path}` : path
}

function parcelQuotaDetails(data) {
  if (data?.code !== 'parcel_quota_exceeded') return null
  const quota = data.quota
  if (!quota || !['free', 'pro'].includes(quota.plan) ||
      !Number.isSafeInteger(quota.limit) || !Number.isSafeInteger(quota.used) ||
      !Number.isSafeInteger(quota.requested) || quota.used < 0 || quota.requested < 1) return null
  const expectedLimit = quota.plan === 'free' ? 2 : 20
  if (quota.limit !== expectedLimit || quota.used + quota.requested <= quota.limit) return null
  return {
    code: data.code,
    quota: {
      plan: quota.plan,
      limit: quota.limit,
      used: quota.used,
      requested: quota.requested,
    },
  }
}

// Backend exceptions may contain authentication data; never display them.
export async function requestJson(path, { token, acceptStatusSuccess = false, ...options } = {}, fetchImpl = globalThis.fetch) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response
  try {
    response = await fetchImpl(apiUrl(`/api${path}`), { ...options, headers })
  } catch {
    throw new ApiError('network', 'Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.')
  }
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('auth', 'Authentification refusée. Connectez-vous à nouveau.', 401)
    if (response.status >= 500) throw new ApiError('server', 'Le serveur rencontre un problème. Réessayez plus tard.', response.status)
    if (response.status === 409) {
      let errorData = null
      try { errorData = await response.clone().json() } catch { /* Keep the generic request error. */ }
      const details = parcelQuotaDetails(errorData)
      if (details) throw new ApiError('quota', 'Parcel quota reached.', 409, details)
      const code = errorData?.code === 'legacy_references_require_review'
        ? 'legacy_references_require_review'
        : null
      throw new ApiError('request', 'La demande a été refusée par le serveur.', 409, { code })
    }
    throw new ApiError('request', 'La demande a été refusée par le serveur.', response.status)
  }
  let data
  try { data = await response.json() } catch {
    throw new ApiError('protocol', 'Le serveur a renvoyé une réponse inattendue.', response.status)
  }
  if (!data || (data.success !== true && !(acceptStatusSuccess && data.status === 'success'))) {
    throw new ApiError('protocol', 'Le serveur n’a pas confirmé la demande.', response.status)
  }
  return data
}
