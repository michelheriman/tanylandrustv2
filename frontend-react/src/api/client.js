export class ApiError extends Error {
  constructor(kind, message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

// Backend exceptions may contain authentication data; never display them.
export async function requestJson(path, { token, ...options } = {}, fetchImpl = globalThis.fetch) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response
  try {
    response = await fetchImpl(`/api${path}`, { ...options, headers })
  } catch {
    throw new ApiError('network', 'Connexion au serveur impossible. Vérifiez votre connexion puis réessayez.')
  }
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('auth', 'Authentification refusée. Connectez-vous à nouveau.', 401)
    if (response.status >= 500) throw new ApiError('server', 'Le serveur rencontre un problème. Réessayez plus tard.', response.status)
    throw new ApiError('request', 'La demande a été refusée par le serveur.', response.status)
  }
  let data
  try { data = await response.json() } catch {
    throw new ApiError('protocol', 'Le serveur a renvoyé une réponse inattendue.', response.status)
  }
  if (!data || data.success !== true) throw new ApiError('protocol', 'Le serveur n’a pas confirmé la demande.', response.status)
  return data
}
