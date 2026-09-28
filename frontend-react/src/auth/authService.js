import { ApiError, requestJson } from '../api/client.js'
import { createSessionStorage } from './storage.js'

export function normalizeUser(user) {
  const id = user?.id ?? user?.user_id
  if (!id || typeof user?.email !== 'string') throw new ApiError('protocol', 'Les informations utilisateur sont incomplètes.')
  return { id, email: user.email, name: user.name ?? '', username: user.username ?? '' }
}

function sessionFrom(data, user) {
  if (typeof data.token !== 'string' || !data.token ||
      typeof data.refresh_token !== 'string' || !data.refresh_token) {
    throw new ApiError('protocol', 'La réponse de session est incomplète.')
  }
  return { accessToken: data.token, refreshToken: data.refresh_token, user }
}

export function createAuthService({ storage = createSessionStorage(), fetchImpl } = {}) {
  const listeners = new Set()
  let state = { status: 'restoring', user: null, error: null }
  let session = null
  let generation = 0
  let refreshFlight = null
  let restoreFlight = null
  let initialized = false
  const api = (path, options) => requestJson(path, options, fetchImpl)
  const publish = (next) => { state = next; listeners.forEach((listener) => listener()) }
  const checkGeneration = (expected) => {
    if (generation !== expected) throw new ApiError('cancelled', 'La session a changé. Réessayez.')
  }
  const save = (next) => { storage.write(next); session = next }
  const clear = (error = null) => {
    generation += 1
    session = null
    refreshFlight = null
    try { storage.clear() } finally { publish({ status: 'anonymous', user: null, error }) }
  }
  async function refresh(expected, rejectedToken) {
    checkGeneration(expected)
    if (!session) throw new ApiError('auth', 'Connectez-vous à nouveau.', 401)
    // A delayed 401 can arrive after another request already rotated the tokens.
    if (session.accessToken !== rejectedToken) return
    if (refreshFlight) return refreshFlight
    const refreshToken = session.refreshToken
    const flight = (async () => {
      try {
        const data = await api('/refresh-token', {
          method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }),
        })
        checkGeneration(expected)
        save(sessionFrom(data, session.user))
      } catch (error) {
        if (generation === expected && error.kind === 'auth') clear(error)
        throw error
      }
    })()
    refreshFlight = flight
    try { await flight } finally { if (refreshFlight === flight) refreshFlight = null }
  }
  async function request(path, options = {}) {
    const expected = generation
    const token = session?.accessToken
    if (!token) throw new ApiError('auth', 'Connectez-vous pour continuer.', 401)
    try {
      const data = await api(path, { ...options, token })
      checkGeneration(expected)
      return data
    } catch (error) {
      checkGeneration(expected)
      if (error.kind !== 'auth') throw error
    }
    await refresh(expected, token)
    checkGeneration(expected)
    try {
      const data = await api(path, { ...options, token: session.accessToken })
      checkGeneration(expected)
      return data
    } catch (error) {
      if (generation === expected && error.kind === 'auth') clear(error)
      throw error
    }
  }
  function restore({ retry = false } = {}) {
    if (restoreFlight) return restoreFlight
    if (initialized && !retry) return Promise.resolve()
    initialized = true
    const expected = generation
    publish({ status: 'restoring', user: null, error: null })
    const flight = (async () => {
      try {
        session = storage.read()
        if (!session) { publish({ status: 'anonymous', user: null, error: null }); return }
        const data = await request('/current_user')
        checkGeneration(expected)
        const user = normalizeUser(data.data)
        save({ ...session, user })
        publish({ status: 'authenticated', user, error: null })
      } catch (error) {
        if (generation !== expected) return
        publish({ status: 'unavailable', user: null, error })
      }
    })()
    restoreFlight = flight
    // StrictMode mounts share the same restoration operation.
    return flight.finally(() => { if (restoreFlight === flight) restoreFlight = null })
  }
  async function login(email, password) {
    const expected = ++generation
    refreshFlight = null
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    checkGeneration(expected)
    const user = normalizeUser(data.user)
    save(sessionFrom(data, user))
    initialized = true
    publish({ status: 'authenticated', user, error: null })
  }
  async function logout() {
    const token = session?.accessToken
    generation += 1 // Pending refreshes must never recreate a logged-out session.
    publish({ ...state, status: 'signingOut', error: null })
    let warning = null
    try {
      if (token) await api('/logout', { method: 'POST', token })
    } catch {
      warning = new ApiError('logout', 'Session locale fermée. Le serveur n’a pas confirmé la déconnexion.')
    } finally {
      try { clear(warning) } catch (error) { publish({ status: 'anonymous', user: null, error }) }
    }
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    getSnapshot: () => state,
    login, logout, restore, request,
  }
}

export const authService = createAuthService()
